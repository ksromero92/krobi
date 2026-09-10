import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import IconKrobi from "../components/IconKrobi";

/**
 * ✅ Endpoint del agente (n8n)
 * - VITE_AGENT_API_BASE = https://krodev.app.n8n.cloud/webhook-test
 * - Endpoint final = {base}/api/agent/nlq
 */
const getAgentEndpoint = () => {
    const base = import.meta.env?.VITE_AGENT_API_BASE;
    if (!base) throw new Error("Falta VITE_AGENT_API_BASE en .env.local");
    return `${String(base).replace(/\/$/, "")}/api/agent/nlq`;
};

// Supabase (frontend)
const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

const PERSONA_KEY = "maria-clara";

export default function AgenteIA() {
    const [messages, setMessages] = useState([
        {
            type: "bot",
            text:
                "¡Hola! Soy KroBi 👋. Puedo mostrarte KPIs por tienda/canal, detectar siluetas y prints ganadores, y exportar reportes.",
        },
    ]);

    const [input, setInput] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const [user, setUser] = useState(null);

    // OJO: ya no confiamos a ciegas en localStorage; lo validamos contra agent_sessions
    const [conversationId, setConversationId] = useState(null);

    const [usage, setUsage] = useState(null);

    const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
    const recRef = useRef(null);

    const AGENT_ENDPOINT = getAgentEndpoint();

    // 1) Cargar sesión Supabase
    useEffect(() => {
        let mounted = true;

        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (mounted) setUser(session?.user || null);
        })();

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null);
        });

        return () => {
            mounted = false;
            sub?.subscription?.unsubscribe?.();
        };
    }, []);

    /**
     * 2) Bootstrap de conversationId desde la NUEVA tabla agent_sessions
     * Reglas:
     * - Si en localStorage hay un id, lo VALIDAMOS: debe existir y pertenecer al user (y persona)
     * - Si no es válido, buscamos el último session id por usuario/persona
     * - Si no hay ninguno, conversationId = null (n8n lo creará en el primer POST)
     */
    useEffect(() => {
        if (!user?.id) return;

        let canceled = false;

        (async () => {
            try {
                const stored = localStorage.getItem("krobi:conv") || null;

                // A) Si hay stored, validarlo contra agent_sessions
                if (stored) {
                    const { data: validRow, error: validErr } = await supabase
                        .from("agent_sessions")
                        .select("id")
                        .eq("id", stored)
                        .eq("user_id", user.id)
                        .eq("persona", PERSONA_KEY)
                        .maybeSingle();

                    if (!validErr && validRow?.id) {
                        if (!canceled) setConversationId(validRow.id);
                        return;
                    }

                    // stored era inválido para este user/persona → límpialo
                    try {
                        localStorage.removeItem("krobi:conv");
                    } catch { }
                }

                // B) Si no hay stored válido, trae la última sesión por user/persona
                const { data: lastRow, error: lastErr } = await supabase
                    .from("agent_sessions")
                    .select("id, created_at")
                    .eq("user_id", user.id)
                    .eq("persona", PERSONA_KEY)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastErr) {
                    // Si falla, no bloqueamos el chat. Simplemente dejamos null.
                    if (!canceled) setConversationId(null);
                    return;
                }

                if (lastRow?.id) {
                    if (!canceled) {
                        setConversationId(lastRow.id);
                        try {
                            localStorage.setItem("krobi:conv", lastRow.id);
                        } catch { }
                    }
                } else {
                    if (!canceled) setConversationId(null);
                }
            } catch {
                if (!canceled) setConversationId(null);
            }
        })();

        return () => {
            canceled = true;
        };
    }, [user?.id]);

    // 3) Rehidratación: cache local + GET a n8n (cuando ya hay conversationId válido)
    useEffect(() => {
        if (!conversationId) return;

        try {
            const cached = localStorage.getItem(`krobi:msgs:${conversationId}`);
            if (cached) setMessages(JSON.parse(cached));
        } catch { }

        fetchHistory(conversationId);
    }, [conversationId]);

    // 4) Cache local de mensajes
    useEffect(() => {
        if (!conversationId) return;
        const id = setTimeout(() => {
            try {
                localStorage.setItem(`krobi:msgs:${conversationId}`, JSON.stringify(messages));
            } catch { }
        }, 150);
        return () => clearTimeout(id);
    }, [messages, conversationId]);

    // Dictado por voz
    useEffect(() => {
        document.body.classList.toggle("dark", localStorage.getItem("theme") === "dark");

        if (typeof window !== "undefined") {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SR) {
                const rec = new SR();
                rec.lang = "es-CO";
                rec.interimResults = false;
                rec.maxAlternatives = 1;
                rec.onresult = (e) => {
                    const text = e.results[0][0].transcript;
                    setInput(text);
                    setTimeout(() => handleSend(text), 50);
                };
                recRef.current = rec;
            }
        }
    }, []);

    const handleSend = async (forcedText) => {
        const msg = (forcedText ?? input).trim();
        if (!msg) return;

        setInput("");
        setMessages((prev) => [...prev, { type: "user", text: msg }]);
        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setMessages((prev) => [
                    ...prev,
                    { type: "bot", text: "No hay sesión activa. Inicia sesión nuevamente." },
                ]);
                return;
            }

            // ✅ Si no hay conversationId, enviamos null para que n8n cree agent_sessions
            const res = await fetch(AGENT_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: msg,
                    conversationId: conversationId || null,
                    personaKey: PERSONA_KEY,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                const stage = data?.stage ? ` (${data.stage})` : "";
                const detail = data?.message ? `: ${data.message}` : "";
                setMessages((prev) => [
                    ...prev,
                    { type: "bot", text: `Error del servidor${stage}${detail}.` },
                ]);
                return;
            }

            // ✅ Si n8n devuelve conversationId nuevo, lo persistimos
            if (data?.conversationId && data.conversationId !== conversationId) {
                setConversationId(data.conversationId);
                try {
                    localStorage.setItem("krobi:conv", data.conversationId);
                } catch { }
            }

            if (data?.clarification) {
                setMessages((prev) => [...prev, { type: "bot", text: data.clarification }]);
                return;
            }

            if (data?.error) {
                const detail = data?.message ? ` Detalle: ${data.message}` : "";
                setMessages((prev) => [
                    ...prev,
                    { type: "bot", text: `Hubo un problema consultando los datos.${detail}` },
                ]);
                return;
            }

            const replyText = data.answer || data.reply || "Consulta realizada.";
            setMessages((prev) => [...prev, { type: "bot", text: replyText }]);
            setRows(Array.isArray(data.rows) ? data.rows : []);
            setUsage(data.usage || null);
        } catch {
            setMessages((prev) => [...prev, { type: "bot", text: "Error de red o servidor." }]);
        } finally {
            setLoading(false);
        }
    };

    async function fetchHistory(convId) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return;

            const res = await fetch(
                `${AGENT_ENDPOINT}?conversationId=${encodeURIComponent(convId)}&limit=40`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Si hay error auth, no intentes setear mensajes
            if (res.status === 401 || res.status === 403) {
                // opcional: mostrar un mensaje en el chat o limpiar convId
                // setMessages((prev) => [...prev, { type: "bot", text: "No tienes acceso al historial." }]);
                return;
            }

            const raw = await res.json().catch(() => null);

            // ✅ Normaliza: si viene como array, toma el primer item
            const data = Array.isArray(raw) ? raw[0] : raw;

            const msgs = data?.messages;

            if (res.ok && Array.isArray(msgs)) {
                setMessages(msgs);

                try {
                    localStorage.setItem(`krobi:msgs:${convId}`, JSON.stringify(msgs));
                } catch { }
                return;
            }

            // conversación válida pero sin mensajes
            if (res.ok && Array.isArray(msgs) && msgs.length === 0) {
                // puedes dejarlo así, o setear un mensaje inicial
                // setMessages([{ type: "bot", text: "Aún no hay mensajes en esta conversación." }]);
                return;
            }

            // si res.ok pero formato inesperado, no rompas UI
        } catch {
            // no-op
        }
    }


    const startMic = () => {
        if (!recRef.current) {
            setMessages((p) => [
                ...p,
                { type: "bot", text: "Tu navegador no soporta dictado por voz (prueba Chrome)." },
            ]);
            return;
        }
        synthRef.current?.cancel();
        recRef.current.start();
    };

    const resetConversation = () => {
        // Limpia conversación local y UI (n8n creará una nueva al próximo POST)
        try {
            if (conversationId) localStorage.removeItem(`krobi:msgs:${conversationId}`);
            localStorage.removeItem("krobi:conv");
        } catch { }
        setConversationId(null);
        setRows([]);
        setUsage(null);
        setMessages([
            {
                type: "bot",
                text: "Listo ✅. Iniciemos una conversación nueva. ¿Qué quieres consultar?",
            },
        ]);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
                <IconKrobi size={28} className="animate-fade-in" />
                <h1 className="text-2xl font-bold text-krobi dark:text-krobi-light tracking-wide">
                    Habla con KroBi
                </h1>

                <div className="ml-auto flex items-center gap-3 text-xs opacity-80">
                    {user ? (
                        <span>
                            Sesión: <b>{user.email || user.id}</b>
                        </span>
                    ) : (
                        <span className="italic">Invitado (sin sesión)</span>
                    )}

                    <button
                        onClick={resetConversation}
                        className="border dark:border-gray-600 px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Nueva conversación"
                    >
                        Nueva
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 overflow-y-auto space-y-2">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex gap-2 max-w-[80%] px-4 py-2 rounded-xl text-sm ${msg.type === "user"
                            ? "bg-krobi text-white ml-auto"
                            : "bg-white dark:bg-gray-700 border dark:border-gray-600 text-gray-700 dark:text-gray-100"
                            }`}
                    >
                        {msg.type === "bot" && <IconKrobi size={20} />}
                        <span>{msg.text}</span>
                    </div>
                ))}

                {rows?.length > 0 && (
                    <div className="mt-3 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl overflow-auto">
                        <table className="min-w-full text-xs">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    {Object.keys(rows[0]).slice(0, 10).map((h) => (
                                        <th key={h} className="px-3 py-2 text-left font-semibold">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(0, 20).map((r, i) => (
                                    <tr key={i} className="border-t dark:border-gray-700">
                                        {Object.keys(rows[0])
                                            .slice(0, 10)
                                            .map((h) => (
                                                <td key={h} className="px-3 py-1 whitespace-nowrap">
                                                    {`${r[h] ?? ""}`}
                                                </td>
                                            ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {usage && (
                    <div className="text-[11px] mt-2 opacity-80">
                        <div className="font-semibold">Uso de tokens</div>
                        {usage.plan && (
                            <div>
                                Plan → prompt: {usage.plan.prompt_tokens ?? 0}, completion:{" "}
                                {usage.plan.completion_tokens ?? 0}, total: {usage.plan.total_tokens ?? 0}
                            </div>
                        )}
                        {usage.summary && (
                            <div>
                                Resumen → prompt: {usage.summary.prompt_tokens ?? 0}, completion:{" "}
                                {usage.summary.completion_tokens ?? 0}, total: {usage.summary.total_tokens ?? 0}
                            </div>
                        )}
                    </div>
                )}

                {loading && <div className="text-xs opacity-70 mt-2">Consultando datos…</div>}
            </div>

            <div className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Escribe tu pregunta..."
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-krobi bg-white dark:bg-gray-900 text-gray-800 dark:text-white"
                />
                <button
                    onClick={() => handleSend()}
                    disabled={loading}
                    className="bg-krobi text-white px-4 py-2 rounded-lg text-sm hover:bg-krobi-dark transition disabled:opacity-60"
                >
                    Enviar
                </button>
                <button
                    onClick={startMic}
                    className="border dark:border-gray-600 px-3 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Hablar por micrófono"
                >
                    🎙️
                </button>
            </div>
        </div>
    );
}
