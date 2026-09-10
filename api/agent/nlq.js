// /api/agent/nlq.js — KroBi NLQ + Smalltalk + Historial + Dimensiones de producto + TTS hints
export const config = { runtime: "nodejs" };

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/* ===================== OpenAI client + SHIM ===================== */

const MODELS = {
    planner: process.env.OPENAI_PLANNER_MODEL || "gpt-4o",      // antes "gpt-4o-mini"
    smalltalk: process.env.OPENAI_SMALLTALK_MODEL || "gpt-4o",  // antes "gpt-4o-mini"
    tts: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts"
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
if (!openai.responses?.create) {
    openai.responses = {
        create: async (args) => {
            const input = Array.isArray(args?.messages)
                ? args.messages
                : Array.isArray(args?.input)
                    ? args.input
                    : [];
            const sys = (input.find(p => p?.role === "system")?.content ?? "").toString();
            const usr = (input.find(p => p?.role === "user")?.content ?? "").toString();
            const r = await openai.chat.completions.create({
                model: args?.model || "gpt-4o-mini",
                temperature: 0,
                messages: [
                    { role: "system", content: sys },
                    { role: "user", content: usr + "\nDevuelve SOLO JSON válido, sin fences ```." }
                ]
            });
            const text = (r?.choices?.[0]?.message?.content || "").trim();
            return { output_text: text, usage: r?.usage, model: r?.model || (args?.model || "gpt-4o-mini") };
        }
    };
}

/* ===================== Supabase ===================== */
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE,
    { db: { schema: "public" } }
);

/* ===================== Catálogo de vistas / columnas ===================== */
/* Nota: estas vistas incluyen los campos de producto (coleccion, tipo_prenda, silueta, color, print, talla, categoria)
   y métricas (total, cantidad, facturas, clientes_unicos). */
const CATALOG = {
    v_ventas_por_tienda: {
        columns: [
            "anio", "mes_num", "mes_en", "nombre_tienda", "tipo_canal",
            "categoria", "talla", "silueta", "tipo_prenda", "print", "color", "coleccion",
            "cats", "cats_json", "total", "cantidad", "facturas", "clientes_unicos"
        ],
        defaults: {
            select: ["nombre_tienda", "tipo_canal", "total", "cantidad", "facturas", "clientes_unicos"],
            order: [{ column: "total", dir: "desc" }],
            limit: 1000
        },
        likeColumns: ["nombre_tienda", "tipo_canal", "categoria", "coleccion", "color", "print", "silueta", "tipo_prenda"]
    },
    v_ventas_por_canal: {
        columns: [
            "anio", "mes_num", "mes_en", "tipo_canal",
            "categoria", "talla", "silueta", "tipo_prenda", "print", "color", "coleccion",
            "cats", "cats_json", "total", "cantidad", "facturas", "clientes_unicos"
        ],
        defaults: {
            select: ["tipo_canal", "total", "cantidad", "facturas", "clientes_unicos"],
            order: [{ column: "total", dir: "desc" }],
            limit: 1000
        },
        likeColumns: ["tipo_canal", "categoria", "coleccion", "color", "print", "silueta", "tipo_prenda"]
    },
    v_ventas_detalle: {
        columns: [
            "fecha_emision", "numero", "nombre_tienda", "tipo_canal",
            "categoria", "silueta", "tipo_prenda", "talla", "print", "color", "coleccion",
            "cantidad", "precio_unitario", "total", "cats", "cats_json", "public_url"
        ],
        defaults: {
            select: ["fecha_emision", "numero", "nombre_tienda", "tipo_prenda", "talla", "color", "cantidad", "precio_unitario", "total", "public_url"],
            order: [{ column: "total", dir: "desc" }],
            limit: 2000
        },
        likeColumns: ["categoria", "tipo_prenda", "silueta", "print", "color", "coleccion", "nombre_tienda", "tipo_canal", "numero"]
    },
    v_ventas_por_vendedor: {
        columns: [
            "anio", "mes_num", "mes_en", "nombre_tienda", "tipo_canal",
            "nombre_vendedor", "id_vendedor", "total", "cantidad", "facturas", "clientes_unicos"
        ],
        defaults: {
            select: ["nombre_vendedor", "nombre_tienda", "tipo_canal", "total", "cantidad", "facturas", "clientes_unicos"],
            order: [{ column: "total", dir: "desc" }],
            limit: 1000
        },
        likeColumns: ["nombre_vendedor", "nombre_tienda", "tipo_canal"]
    }
};
const ALLOWED_VIEWS = Object.keys(CATALOG);
const ALLOWED_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "is", "in"];

/* ===================== Sinónimos simples (para planificador) ===================== */
const SYNONYMS = {
    año: "anio", anho: "anio", year: "anio",
    mes: "mes_num", mes_num: "mes_num", mes_en: "mes_en",
    tienda: "nombre_tienda", local: "nombre_tienda", sucursal: "nombre_tienda",
    canal: "tipo_canal",
    vendedor: "nombre_vendedor",
    ventas: "total", valor: "total", importe: "total",
    unidades: "cantidad", cantidad: "cantidad", facturas: "facturas", tickets: "facturas",
    clientes: "clientes_unicos",
    producto: "categoria", referencia: "categoria",
    categoria: "categoria", tipo_prenda: "tipo_prenda", silueta: "silueta", print: "print", color: "color", coleccion: "coleccion", talla: "talla"
};

/* ===================== Schemas para Structured Outputs ===================== */
const PLAN_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["table"],
    properties: {
        table: { type: "string", enum: ALLOWED_VIEWS },
        select: { type: "array", items: { type: "string" } },
        filters: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["column", "op", "value"],
                properties: {
                    column: { type: "string" },
                    op: { type: "string", enum: ALLOWED_OPS },
                    value: {}
                }
            }
        },
        sort: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["column", "dir"],
                properties: { column: { type: "string" }, dir: { type: "string", enum: ["asc", "desc"] } }
            }
        },
        limit: { type: "integer", minimum: 1, maximum: 10000, default: 1000 },
        free_text: { type: "string" },
        needs_clarification: { type: "boolean", default: false },
        clarifying_question: { type: "string" }
    }
};

const INTENT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        intent: { type: "string", enum: ["data_query", "smalltalk", "help", "other"] },
        topic: { type: "string" }
    },
    required: ["intent"]
};

/* ===================== Utils ===================== */
const toArray = (x) => Array.isArray(x) ? x : (x == null ? [] : [x]);
const normField = (c) => SYNONYMS[String(c || "").trim()] || String(c || "").trim();
const stripFences = (s) => /^```/i.test(s) ? s.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim() : s;

/* ===================== Identidad de KroBi ===================== */
const SYSTEM_PERSONA = `
Eres **KroBi**, el asistente de datos de la empresa Agua María. No eres María Clara ni hablas en su nombre.
Tu rol: responder preguntas de ventas y producto en español (Colombia), de forma clara, breve y accionable.
Reglas:
- María Clara es la dueña/gerente; tú eres KroBi (asistente).
- Si el usuario no da período, usa el último mes disponible en los datos y dilo explícitamente.
- Da KPIs (ventas, unidades, facturas, clientes) y, cuando corresponda, 1 insight + 1 acción.
- Ofrece *drill-down* (p.ej. “¿Quieres ver una tienda/colección específica?”).
`;

/* ===================== Parser de intención/dimensión/métrica/período ===================== */
const MONTHS_ES = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

// Dimensiones soportadas: clave → { view, field, synonyms[] }
const DIMENSION_MAP = [
    {
        key: 'tienda', view: 'v_ventas_por_tienda', field: 'nombre_tienda',
        synonyms: ['tienda', 'tiendas', 'punto', 'pdv', 'sucursal', 'local']
    },
    {
        key: 'canal', view: 'v_ventas_por_canal', field: 'tipo_canal',
        synonyms: ['canal', 'canales']
    },
    {
        key: 'coleccion', view: 'v_ventas_por_canal', field: 'coleccion',
        synonyms: ['coleccion', 'colecciones']
    },
    {
        key: 'tipo_prenda', view: 'v_ventas_por_canal', field: 'tipo_prenda',
        synonyms: ['tipo de prenda', 'tipo_prenda', 'tipo', 'prenda']
    },
    {
        key: 'silueta', view: 'v_ventas_por_canal', field: 'silueta',
        synonyms: ['silueta', 'corte']
    },
    {
        key: 'color', view: 'v_ventas_por_canal', field: 'color',
        synonyms: ['color', 'colores']
    },
    {
        key: 'print', view: 'v_ventas_por_canal', field: 'print',
        synonyms: ['print', 'estampado', 'estampados']
    },
    {
        key: 'talla', view: 'v_ventas_por_canal', field: 'talla',
        synonyms: ['talla', 'tallas']
    },
    {
        key: 'categoria', view: 'v_ventas_por_canal', field: 'categoria',
        synonyms: ['categoria', 'categoría', 'genero', 'género', 'linea', 'línea', 'producto']
    }
];

function resolveDimension(text) {
    const q = (text || '').toLowerCase();
    for (const def of DIMENSION_MAP) {
        for (const s of def.synonyms) {
            if (q.includes(s)) return def;
        }
    }
    // por defecto cae a tiendas
    return DIMENSION_MAP.find(x => x.key === 'tienda');
}

function parseMetric(text) {
    const q = (text || '').toLowerCase();
    if (/\bunidades?\b/.test(q)) return { key: 'unidades', field: 'cantidad', label: 'unidades' };
    if (/\bfacturas?\b/.test(q)) return { key: 'facturas', field: 'facturas', label: 'facturas' };
    if (/\bclientes?\b/.test(q)) return { key: 'clientes', field: 'clientes_unicos', label: 'clientes' };
    return { key: 'total', field: 'total', label: 'ventas' };
}

function parsePeriod(text) {
    const q = (text || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const yearMatch = q.match(/\b(20[1-5][0-9])\b/);
    const year = yearMatch ? Number(yearMatch[1]) : null;
    const monthKey = Object.keys(MONTHS_ES).find(m => q.includes(m));
    const month = monthKey ? MONTHS_ES[monthKey] : null;
    return { year, month };
}

function parseDimensionValue(text) {
    const q = text || '';
    const quoted = q.match(/["“](.+?)["”]/);                    // "SHOW ROOM"
    if (quoted) return quoted[1].trim();
    const p = q.match(/\b(?:en|de|por)\s+([A-Za-z0-9ÁÉÍÓÚáéíóúñÑ\-\._\s]{2,})$/i); // en Show Room
    if (p) return p[1].trim();
    return null;
}

/* ===================== Historial / Auth / Uso ===================== */
async function ensureConversation(userId, conversationId) {
    if (conversationId) {
        const { data, error } = await supabase
            .from("chat_conversations").select("id,user_id").eq("id", conversationId).single();
        if (!error && data && data.user_id === userId) return { conversationId };
    }
    const { data, error } = await supabase
        .from("chat_conversations").insert({ user_id: userId, title: "KroBi" }).select("id").single();
    if (error) throw error;
    return { conversationId: data.id };
}
async function saveMessage({ conversationId, userId, role, content, metadata }) {
    await supabase.from("chat_messages").insert({ conversation_id: conversationId, user_id: userId, role, content, metadata: metadata || null });
}
async function loadRecentMessages({ conversationId, limit = 12 }) {
    const { data, error } = await supabase
        .from("chat_messages").select("role,content,metadata")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error) throw error; return (data || []).reverse();
}
async function getAuthUserIdFromRequest(req) {
    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
        if (!token) return null;
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user) return null;
        return data.user.id;
    } catch { return null; }
}
async function saveUsage({ userId, conversationId, stage, model, usage }) {
    if (!usage) return;
    const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = usage || {};
    await supabase.from("usage_tokens").insert({
        user_id: userId, conversation_id: conversationId || null, stage, model,
        prompt_tokens, completion_tokens, total_tokens
    });
}
async function getQuota(userId) {
    const { data } = await supabase.from("user_quotas").select("*").eq("user_id", userId).single();
    return data || { daily_token_limit: 200000, monthly_token_limit: 2000000, hard_stop: true };
}
async function getUsageTotals(userId) {
    const today = new Date();
    const dayStr = today.toISOString().slice(0, 10);
    const monthStr = today.toISOString().slice(0, 7) + "-01";
    const { data: dayData } = await supabase
        .from("usage_tokens_daily").select("total").eq("user_id", userId).gte("day", dayStr).limit(1);
    const { data: monthData } = await supabase
        .from("usage_tokens_monthly").select("total").eq("user_id", userId).gte("month", monthStr).limit(1);
    return { daily: dayData?.[0]?.total ?? 0, monthly: monthData?.[0]?.total ?? 0 };
}
async function enforceQuotaOrThrow(userId) {
    const quota = await getQuota(userId);
    const usage = await getUsageTotals(userId);
    const overDaily = usage.daily >= quota.daily_token_limit;
    const overMonthly = usage.monthly >= quota.monthly_token_limit;
    if (quota.hard_stop && (overDaily || overMonthly)) {
        const reason = overDaily ? "límite diario" : "límite mensual";
        const e = new Error(`Has superado tu ${reason} de tokens.`); e.status = 402; throw e;
    }
    return { quota, usage };
}

/* ===================== Intent / Smalltalk ===================== */
async function classifyIntent(message, memoryBrief) {
    const sys = "Clasifica la intención del usuario. Devuelve JSON {intent, topic}. Intent ∈ data_query, smalltalk, help, other.";
    const user = "Mensaje: " + message + "\nContexto breve: " + (memoryBrief || "");
    try {
        const r = await openai.responses.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: sys }, { role: "user", content: user }],
            response_format: { type: "json_schema", json_schema: { name: "intent", schema: INTENT_SCHEMA, strict: true } }
        });
        const txt = stripFences(r.output_text || "{}");
        return JSON.parse(txt);
    } catch {
        if (/hola|buenas|qué tal|como estas|saludo/i.test(message)) return { intent: "smalltalk", topic: "greeting" };
        if (/ayuda|como usar|qué puedes/i.test(message)) return { intent: "help", topic: "help" };
        return { intent: "data_query", topic: "unknown" };
    }
}
async function answerSmalltalk({ message, history }) {
    const sys = SYSTEM_PERSONA + "\nSé breve (máx 80 palabras).";
    const context = history.map(h => h.role + ": " + h.content).join("\n");
    const usr = "Historial reciente:\n" + context + "\n\nUsuario: " + message;
    const r = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [{ role: "system", content: sys }, { role: "user", content: usr }]
    });
    return { text: r.choices?.[0]?.message?.content || "", usage: r?.usage, model: r?.model || "gpt-4o-mini" };
}

/* ===================== Data Query determinística por dimensión ===================== */
function monthLabel(m) {
    const k = Object.keys(MONTHS_ES).find(k => MONTHS_ES[k] === m);
    return k ? k.replace(/^./, c => c.toUpperCase()) : null;
}

// async function runDimensionQuery({ message }) {
//     // 1) Intención
//     const dimDef = resolveDimension(message);
//     const metDef = parseMetric(message);
//     const period = parsePeriod(message);
//     const dimValue = parseDimensionValue(message); // opcional

//     const BASE_VIEW = dimDef.view;
//     const DIM_FIELD = dimDef.field;

//     const SELECT_FIELDS = [
//         DIM_FIELD, "anio", "mes_num", "cantidad", "total", "facturas", "clientes_unicos", "tipo_canal"
//     ];

//     // 2) Consulta
//     let q = supabase.from(BASE_VIEW).select(SELECT_FIELDS.join(",")).limit(5000);
//     if (period.year) q = q.eq("anio", period.year);
//     if (period.month) q = q.eq("mes_num", period.month);
//     if (dimValue) q = q.ilike(DIM_FIELD, `%${dimValue}%`);

//     const { data: rowsRaw, error: qerr } = await q;
//     if (qerr) throw qerr;
//     let rows = rowsRaw || [];

//     // 3) Último período si no vino uno explícito
//     if (!period.year || !period.month) {
//         const periods = rows.map(r => ({ y: +r.anio || 0, m: +r.mes_num || 0 })).filter(p => p.y && p.m);
//         if (periods.length) {
//             const latestY = Math.max(...periods.map(p => p.y));
//             const latestM = Math.max(...periods.filter(p => p.y === latestY).map(p => p.m));
//             rows = rows.filter(r => +r.anio === latestY && +r.mes_num === latestM);
//             period.year = latestY; period.month = latestM;
//         }
//     }

//     // 4) Agregación determinística
//     const acc = new Map();
//     for (const r of rows) {
//         const key = r[DIM_FIELD] || `Sin ${dimDef.key}`;
//         const curr = acc.get(key) || { key, total: 0, unidades: 0, facturas: 0, clientes: 0 };
//         curr.total += Number(r.total || 0);
//         curr.unidades += Number(r.cantidad || 0);
//         curr.facturas += Number(r.facturas || 0);
//         curr.clientes += Number(r.clientes_unicos || 0);
//         acc.set(key, curr);
//     }
//     const agg = Array.from(acc.values());

//     const KPI = {
//         total: agg.reduce((s, a) => s + a.total, 0),
//         unidades: agg.reduce((s, a) => s + a.unidades, 0),
//         facturas: agg.reduce((s, a) => s + a.facturas, 0),
//         clientes: agg.reduce((s, a) => s + a.clientes, 0)
//     };

//     // 5) Top 3 por métrica pedida
//     agg.sort((a, b) => (b[metDef.key] || 0) - (a[metDef.key] || 0));
//     const top3 = agg.slice(0, 3);

//     // 6) Texto
//     const tituloDim = (
//         dimDef.key === "tienda" ? "Tiendas" :
//             dimDef.key === "canal" ? "Canales" :
//                 dimDef.key === "coleccion" ? "Colecciones" :
//                     dimDef.key === "tipo_prenda" ? "Tipos de prenda" :
//                         dimDef.key === "silueta" ? "Siluetas" :
//                             dimDef.key === "color" ? "Colores" :
//                                 dimDef.key === "print" ? "Prints" :
//                                     dimDef.key === "talla" ? "Tallas" : "Categorías"
//     );

//     const periodo = (period.year && period.month)
//         ? `${monthLabel(period.month)} ${period.year}`
//         : (period.year ? String(period.year) : "último período");

//     const kpiText = metDef.key === "total"
//         ? `$${KPI.total.toLocaleString("es-CO")}`
//         : `${KPI[metDef.key].toLocaleString("es-CO")} ${metDef.label}`;

//     const lines = top3.map((x, i) => {
//         const metricVal = metDef.key === "total"
//             ? `$${x.total.toLocaleString("es-CO")}`
//             : `${x[metDef.key].toLocaleString("es-CO")} ${metDef.label}`;
//         return `${i + 1}. **${x.key}**: ${metricVal} — (${x.unidades.toLocaleString("es-CO")} unidades, ${x.facturas.toLocaleString("es-CO")} facturas, ${x.clientes.toLocaleString("es-CO")} clientes)`;
//     });

//     const replyText =
//         `**${metDef.label[0].toUpperCase() + metDef.label.slice(1)} por ${tituloDim} (${periodo})**
// **Total ${metDef.label}:** ${kpiText}

// **Top 3 ${tituloDim}:**
// ${lines.join("\n")}

// ¿Quieres ver una ${dimDef.key} específica, cambiar la métrica (ventas/unidades/facturas/clientes) o desglosar por canal?`;

//     // Sugerencias de drill-down para el front
//     const suggestions = top3.map(x => ({
//         label: `${x.key}`,
//         followUp: `Muéstrame ${metDef.label} de "${x.key}" en ${periodo}`
//     }));

//     return {
//         ok: true,
//         replyText,
//         meta: {
//             dimension: dimDef.key,
//             field: DIM_FIELD,
//             view: BASE_VIEW,
//             metric: metDef.key,
//             period
//         },
//         kpi: KPI,
//         top3,
//         suggestions
//     };
// }

async function runDimensionQuery({ message }) {
    // -------- 0) Detectar intención ----------
    const dimDef = resolveDimension(message);         // {key, view, field}
    const metDef = parseMetric(message);              // ventas/unidades/facturas/clientes
    const period = parsePeriod(message);              // {year, month} o null
    const dimValue = parseDimensionValue(message);      // filtro de valor ("en Show Room")
    const isCatalogQuery = /\b(que|qué|cuales|cu[aá]les|lista|conocer|tienen)\b/i.test(message)
        && !/\b(ventas?|unidades?|facturas?|clientes?)\b/i.test(message);

    const BASE_VIEW = dimDef.view;
    const DIM_FIELD = dimDef.field;
    const SELECT_FIELDS = [
        DIM_FIELD, "anio", "mes_num", "cantidad", "total", "facturas", "clientes_unicos", "tipo_canal"
    ];

    // -------- 1) Traer datos base (varios meses) ----------
    let q = supabase.from(BASE_VIEW).select(SELECT_FIELDS.join(",")).limit(8000);
    if (period.year) q = q.eq("anio", period.year);
    if (period.month) q = q.eq("mes_num", period.month);
    if (dimValue) q = q.ilike(DIM_FIELD, `%${dimValue}%`);

    const { data: rowsRaw, error: qerr } = await q;
    if (qerr) throw qerr;
    let rows = rowsRaw || [];

    if (!rows.length) {
        return {
            ok: true,
            replyText: `No encuentro datos para esa consulta. ¿Quieres que lo intente con todo 2025 o el último trimestre?`,
            meta: { dimension: dimDef.key, field: DIM_FIELD, view: BASE_VIEW, metric: metDef.key, period },
            kpi: { total: 0, unidades: 0, facturas: 0, clientes: 0 },
            top3: [],
            suggestions: []
        };
    }

    // -------- 2) Selección de período inteligente ----------
    // Mapear sumas por (anio, mes_num)
    const monthly = new Map();  // "YYYY-MM" -> {y, m, total, unidades, facturas, clientes}
    for (const r of rows) {
        const y = +r.anio || 0, m = +r.mes_num || 0;
        if (!y || !m) continue;
        const key = `${y}-${String(m).padStart(2, '0')}`;
        const acc = monthly.get(key) || { y, m, total: 0, unidades: 0, facturas: 0, clientes: 0 };
        acc.total += Number(r.total || 0);
        acc.unidades += Number(r.cantidad || 0);
        acc.facturas += Number(r.facturas || 0);
        acc.clientes += Number(r.clientes_unicos || 0);
        monthly.set(key, acc);
    }

    // Ordenar meses más recientes primero
    const monthsSorted = Array.from(monthly.values())
        .sort((a, b) => (b.y - a.y) || (b.m - a.m));

    // Si no especificó periodo: usa el último mes con total > 0; si ninguno, toma el último con cualquier dato.
    let chosen = null;
    if (!period.year || !period.month) {
        chosen = monthsSorted.find(x => x.total > 0) || monthsSorted[0] || null;
        if (chosen) { period.year = chosen.y; period.month = chosen.m; }
    } else {
        chosen = monthsSorted.find(x => x.y === period.year && x.m === period.month) || null;
    }

    // Si sigue sin “chosen” (sin meses válidos), devolvemos catálogo global
    if (!chosen) {
        const set = new Set(rows.map(r => r[DIM_FIELD]).filter(Boolean));
        const list = Array.from(set).slice(0, 30).map(v => `• ${v}`).join("\n");
        const replyText = isCatalogQuery
            ? `Estos son algunos ${dimDef.key === 'tipo_prenda' ? 'tipos de prenda' : dimDef.key}s que manejamos (con o sin ventas recientes):\n${list}\n\n¿Te muestro ventas o unidades de alguno en particular?`
            : `No encuentro un período con ventas. Puedo mostrarte el catálogo de ${dimDef.key}s:\n${list}\n\n¿Deseas filtrar por un valor específico?`;
        return {
            ok: true,
            replyText,
            meta: { dimension: dimDef.key, field: DIM_FIELD, view: BASE_VIEW, metric: metDef.key, period },
            kpi: { total: 0, unidades: 0, facturas: 0, clientes: 0 },
            top3: [],
            suggestions: []
        };
    }

    // Filtrar filas al período elegido
    let periodRows = rows.filter(r => +r.anio === period.year && +r.mes_num === period.month);

    // -------- 3) Modo Catálogo (lista de valores) ----------
    if (isCatalogQuery) {
        // Catálogo del período (si quedó vacío, cae a catálogo de todo el set)
        let source = periodRows.length ? periodRows : rows;
        const set = new Set(source.map(r => r[DIM_FIELD]).filter(Boolean));
        const list = Array.from(set).sort((a, b) => String(a).localeCompare(String(b))).slice(0, 40);
        const title = dimDef.key === 'tipo_prenda' ? 'Tipos de prenda' :
            dimDef.key === 'coleccion' ? 'Colecciones' :
                dimDef.key === 'silueta' ? 'Siluetas' :
                    dimDef.key === 'color' ? 'Colores' :
                        dimDef.key === 'print' ? 'Prints' :
                            dimDef.key === 'talla' ? 'Tallas' :
                                dimDef.key === 'categoria' ? 'Categorías' : 'Opciones';

        const periodo = (period.year && period.month)
            ? `${monthLabel(period.month)} ${period.year}` : "último período";

        const replyText =
            `**${title} (${periodo})**
  ${list.map(v => `• ${v}`).join("\n")}
  
  ¿Quieres ver ventas o unidades de alguno en particular, o filtrar por tienda/canal?`;

        // Sugerencias: 5 primeras como follow-ups
        const suggestions = list.slice(0, 5).map(v => ({
            label: v, followUp: `Muéstrame ventas de "${v}" en ${periodo}`
        }));

        return {
            ok: true,
            replyText,
            meta: { dimension: dimDef.key, field: DIM_FIELD, view: BASE_VIEW, metric: metDef.key, period },
            kpi: null, top3: null, suggestions
        };
    }

    // -------- 4) Agregación determinística por dimensión ----------
    const acc = new Map();
    for (const r of periodRows) {
        const key = r[DIM_FIELD] || `Sin ${dimDef.key}`;
        const curr = acc.get(key) || { key, total: 0, unidades: 0, facturas: 0, clientes: 0 };
        curr.total += Number(r.total || 0);
        curr.unidades += Number(r.cantidad || 0);
        curr.facturas += Number(r.facturas || 0);
        curr.clientes += Number(r.clientes_unicos || 0);
        acc.set(key, curr);
    }
    const agg = Array.from(acc.values());

    // Si el período elegido da todo 0, probamos fallback: “últimos 3 meses con ventas”
    const sumMetric = (k) => agg.reduce((s, a) => s + (a[k] || 0), 0);
    if (!agg.length || (sumMetric(metDef.key) === 0 && monthsSorted.length > 1)) {
        const withSales = monthsSorted.filter(m => m.total > 0).slice(0, 12); // últimos 3 meses con ventas
        const validKeys = new Set(withSales.map(m => `${m.y}-${String(m.m).padStart(2, '0')}`));
        periodRows = rows.filter(r => validKeys.has(`${+r.anio}-${String(+r.mes_num).padStart(2, '0')}`));

        acc.clear();
        for (const r of periodRows) {
            const key = r[DIM_FIELD] || `Sin ${dimDef.key}`;
            const curr = acc.get(key) || { key, total: 0, unidades: 0, facturas: 0, clientes: 0 };
            curr.total += Number(r.total || 0);
            curr.unidades += Number(r.cantidad || 0);
            curr.facturas += Number(r.facturas || 0);
            curr.clientes += Number(r.clientes_unicos || 0);
            acc.set(key, curr);
        }
    }

    const agg2 = Array.from(acc.values());
    const KPI = {
        total: agg2.reduce((s, a) => s + a.total, 0),
        unidades: agg2.reduce((s, a) => s + a.unidades, 0),
        facturas: agg2.reduce((s, a) => s + a.facturas, 0),
        clientes: agg2.reduce((s, a) => s + a.clientes, 0)
    };

    // Ordenar por la métrica pedida y Top 3
    agg2.sort((a, b) => (b[metDef.key] || 0) - (a[metDef.key] || 0));
    const top3 = agg2.slice(0, 3);

    // -------- 5) Texto respuesta ----------
    // ---------- Formato TEXTO PLANO (sin Markdown) ----------
    const tituloDim = (
        dimDef.key === "tienda" ? "Tiendas" :
            dimDef.key === "canal" ? "Canales" :
                dimDef.key === "coleccion" ? "Colecciones" :
                    dimDef.key === "tipo_prenda" ? "Tipos de prenda" :
                        dimDef.key === "silueta" ? "Siluetas" :
                            dimDef.key === "color" ? "Colores" :
                                dimDef.key === "print" ? "Prints" :
                                    dimDef.key === "talla" ? "Tallas" : "Categorías"
    );

    const periodo = (period.year && period.month)
        ? `${monthLabel(period.month)} ${period.year}`
        : "último período";

    const kpiText = metDef.key === "total"
        ? `$${KPI.total.toLocaleString("es-CO")}`
        : `${KPI[metDef.key].toLocaleString("es-CO")} ${metDef.label}`;

    const lines = top3.map((x, i) => {
        const metricVal = metDef.key === "total"
            ? `$${x.total.toLocaleString("es-CO")}`
            : `${x[metDef.key].toLocaleString("es-CO")} ${metDef.label}`;
        return `${i + 1}) ${x.key}: ${metricVal}  —  (${x.unidades.toLocaleString("es-CO")} unidades, ${x.facturas.toLocaleString("es-CO")} facturas, ${x.clientes.toLocaleString("es-CO")} clientes)`;
    });

    const replyText =
        `${metDef.label[0].toUpperCase() + metDef.label.slice(1)} por ${tituloDim} (${periodo})\n` +
        `Total ${metDef.label}: ${kpiText}\n\n` +
        (top3.length ? `Top 3 ${tituloDim}:\n${lines.join("\n")}\n\n` : "") +
        `¿Quieres ver una ${dimDef.key} específica, cambiar la métrica (ventas/unidades/facturas/clientes) o desglosar por canal?`;


    const suggestions = top3.slice(0, 3).map(x => ({
        label: `${x.key}`,
        followUp: `Muéstrame ${metDef.label} de "${x.key}" en ${periodo}`
    }));

    return {
        ok: true,
        replyText,
        meta: { dimension: dimDef.key, field: DIM_FIELD, view: BASE_VIEW, metric: metDef.key, period },
        kpi: KPI,
        top3,
        suggestions
    };
}


/* ===================== Planificador NLQ (fallback) ===================== */
function buildPlannerSystemHint() {
    return [
        "Eres un generador de planes SQL para PostgREST/Supabase.",
        "Usa SOLO estas vistas/columnas: " + Object.entries(CATALOG).map(([t, v]) => t + "(" + v.columns.join(", ") + ")").join(" ; "),
        "No uses 'producto' ni 'tienda' como columnas; usa los nombres reales (nombre_tienda, categoria, tipo_prenda, silueta, print, color, coleccion, talla).",
        "'año' es 'anio'. Mes: 'mes_en' (texto) o 'mes_num' (1-12).",
        "Devuelve JSON que cumple el schema sin fences (sin ```)."
    ].join(" ");
}
function guessViewFromMessage(msg) {
    const m = (msg || "").toLowerCase();
    if (/vendedor|asesor/.test(m)) return "v_ventas_por_vendedor";
    if (/canal/.test(m)) return "v_ventas_por_canal";
    if (/detalle|factura|numero|sku|producto|referencia/.test(m)) return "v_ventas_detalle";
    return "v_ventas_por_tienda";
}
function normalizePlan(raw) {
    const p = { ...raw };
    p.table = ALLOWED_VIEWS.includes(p.table) ? p.table : guessViewFromMessage(p.__message || "");
    const cols = new Set(CATALOG[p.table].columns);

    p.select = toArray(p.select).map(normField).filter((c) => cols.has(c));
    if (!p.select.length) p.select = CATALOG[p.table].defaults.select.slice(0);

    p.filters = toArray(p.filters).map((f) => ({
        column: normField(f?.column),
        op: ((f?.op || "eq").toLowerCase()),
        value: f?.value
    })).filter((f) => cols.has(f.column) && ALLOWED_OPS.includes(f.op));

    p.sort = toArray(p.sort).map((s) => ({ column: normField(s?.column), dir: (s?.dir === "asc" ? "asc" : "desc") }))
        .filter((s) => cols.has(s.column));
    if (!p.sort.length) p.sort = CATALOG[p.table].defaults.order.slice(0);

    p.limit = Number.isInteger(p.limit) ? Math.min(Math.max(p.limit, 1), 10000) : CATALOG[p.table].defaults.limit;

    if (typeof p.free_text === "string" && !p.free_text.trim()) delete p.free_text;

    return p;
}
async function createPlanFromNL(message) {
    const r = await openai.responses.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: buildPlannerSystemHint() }, { role: "user", content: message }],
        response_format: { type: "json_schema", json_schema: { name: "sql_plan", schema: PLAN_SCHEMA, strict: true } }
    });
    const raw = stripFences(r.output_text || "{}");
    const json = JSON.parse(raw || "{}");
    json.__message = message;
    return { plan: normalizePlan(json), usage: r?.usage, model: r?.model || "gpt-4o-mini" };
}
function toPostgrestQuery(q, plan) {
    q = q.select(plan.select.join(",")).limit(plan.limit);
    for (const f of plan.filters) {
        const v = f.value;
        switch (f.op) {
            case "eq": q = q.eq(f.column, v); break;
            case "neq": q = q.neq(f.column, v); break;
            case "gt": q = q.gt(f.column, v); break;
            case "gte": q = q.gte(f.column, v); break;
            case "lt": q = q.lt(f.column, v); break;
            case "lte": q = q.lte(f.column, v); break;
            case "ilike": q = q.ilike(f.column, `%${v}%`); break;
            case "is": q = q.is(f.column, v); break;
            case "in": q = q.in(f.column, Array.isArray(v) ? v : [v]); break;
            default: q = q.eq(f.column, v);
        }
    }
    for (const s of plan.sort) q = q.order(s.column, { ascending: s.dir === "asc" });
    if (plan.free_text) {
        const L = CATALOG[plan.table].likeColumns || [];
        const word = String(plan.free_text).trim();
        const allowed = L.filter(c => CATALOG[plan.table].columns.includes(c));
        if (allowed.length) q = q.or(allowed.map(c => `${c}.ilike.%${word}%`).join(","));
    }
    return q;
}
async function runPlan(plan) {
    let q = toPostgrestQuery(supabase.from(plan.table), plan);
    const { data, error } = await q;
    if (!error) return { rows: data || [] };
    return { error };
}

/* ===================== Handler ===================== */
function fail(res, stage, err) { const msg = (err?.message || err || "").toString(); return res.status(500).json({ error: "FAILED", stage, message: msg }); }

export default async function handler(req, res) {
    try {
        // CORS
        const origin = req.headers.origin;
        if (origin) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Vary", "Origin");
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        }
        if (req.method === "OPTIONS") return res.status(204).end();

        // === GET: historial por conversationId ===
        if (req.method === "GET") {
            const { conversationId, limit = 30 } = req.query || {};
            if (!conversationId) return res.status(400).json({ error: "missing_conversationId" });

            const { data, error } = await supabase
                .from("chat_messages")
                .select("role, content, created_at")
                .eq("conversation_id", conversationId)
                .order("created_at", { ascending: true })
                .limit(Number(limit));

            if (error) return res.status(500).json({ error: "history_fetch_failed", message: error.message });

            const messages = (data || []).map(m => ({
                type: m.role === "user" ? "user" : "bot",
                text: m.content,
                ts: m.created_at
            }));
            return res.status(200).json({ conversationId, messages });
        }

        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
        if (!process.env.OPENAI_API_KEY) return fail(res, "env:openai", new Error("OPENAI_API_KEY missing"));
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) return fail(res, "env:supabase", new Error("Supabase envs missing"));

        // Body
        const { message, conversationId: bodyConvId } = req.body || {};

        // 1) Auth + cuotas
        const authUserId = await getAuthUserIdFromRequest(req);
        const userId = authUserId || req.body?.userId || "anon";
        try { await enforceQuotaOrThrow(userId); } catch (e) {
            return res.status(e.status || 402).json({ error: "quota_exceeded", message: e.message });
        }

        // 2) Conversación y guardar mensaje del usuario
        const { conversationId: convId } = await ensureConversation(userId, bodyConvId);
        await saveMessage({ conversationId: convId, userId, role: "user", content: message });

        // 3) Historial breve
        const history = await loadRecentMessages({ conversationId: convId, limit: 12 });

        // 4) Intent
        const intent = await classifyIntent(message, "");

        // 5) Smalltalk/help/other → LLM con persona KroBi
        if (intent.intent !== "data_query") {
            const st = await answerSmalltalk({ message, history });
            await saveUsage({ userId, conversationId: convId, stage: "smalltalk", model: st.model, usage: st.usage });
            await saveMessage({ conversationId: convId, userId, role: "assistant", content: st.text, metadata: { intent } });
            return res.status(200).json({
                ok: true, intent, answer: st.text, reply: st.text, rows: [],
                conversationId: convId,
                tts: {
                    strategy: "client_webspeech",
                    lang: "es-CO",
                    female: true,
                    hints: ["Google español (Latinoamérica)", "Microsoft Sabina Spanish (Mexico) Female"]
                },
                usage: { smalltalk: st.usage }
            });
        }

        // 6) Camino determinístico por dimensión (agregado exacto)
        try {
            const dq = await runDimensionQuery({ message });
            const answer = dq.replyText;

            await saveMessage({
                conversationId: convId, userId, role: "assistant", content: answer,
                metadata: { intent: "data_query", dimension: dq.meta.dimension, period: dq.meta.period, metric: dq.meta.metric }
            });

            return res.status(200).json({
                ok: true,
                intent: { intent: "data_query", topic: dq.meta.dimension },
                answer, reply: answer,
                data: { kpi: dq.kpi, top3: dq.top3, period: dq.meta.period, dimension: dq.meta.dimension, field: dq.meta.field, view: dq.meta.view },
                suggestions: dq.suggestions,
                conversationId: convId,
                // Sugerencias de voz femenina para el front (Web Speech API)
                tts: {
                    strategy: "client_webspeech",
                    lang: "es-CO",
                    female: true,
                    rate: 1.02, pitch: 1.02,
                    hints: ["Google español (Latinoamérica)", "Microsoft Sabina Spanish (Mexico) Female", "Google español de Estados Unidos"]
                }
            });
        } catch (e) {
            // 7) Fallback: Planificador NLQ + resumen LLM con persona (por si el usuario pide algo muy libre)
            const planPkg = await createPlanFromNL(message);
            const { plan, usage: planUsage, model: planModel } = planPkg;

            // Heurística: mensaje muy corto → free_text en detalle
            const wc = String(message || "").trim().split(/\s+/).filter(Boolean).length;
            if (wc <= 2 && !plan.filters.length) {
                plan.free_text = message.trim();
                if (plan.table === "v_ventas_por_tienda") plan.table = "v_ventas_detalle";
            }

            const exec = await runPlan(plan);
            if (exec.error) return fail(res, "postgrest", exec.error);
            const rows = exec.rows;

            // Último período para el resumen
            let rowsForSummary = rows;
            try {
                const periods = rows.map(r => ({ y: +r.anio || 0, m: +r.mes_num || 0 })).filter(p => p.y && p.m);
                if (periods.length) {
                    const latestY = Math.max(...periods.map(p => p.y));
                    const latestM = Math.max(...periods.filter(p => p.y === latestY).map(p => p.m));
                    rowsForSummary = rows.filter(r => +r.anio === latestY && +r.mes_num === latestM);
                }
            } catch { }

            const sys = SYSTEM_PERSONA + "\nDa KPIs claros y 1 insight + 1 acción. 120-160 palabras máx.";
            const usr = [
                "Pregunta: " + message,
                "Vista: " + plan.table,
                "Select: " + plan.select.join(", "),
                "Filtros: " + JSON.stringify(plan.filters || []),
                "Filas (muestra): " + JSON.stringify(rowsForSummary.slice(0, 40))
            ].join("\n");

            const final = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                temperature: 0.25,
                messages: [{ role: "system", content: sys }, { role: "user", content: usr }]
            });

            const answer = final.choices?.[0]?.message?.content || "";

            await saveUsage({ userId, conversationId: convId, stage: "plan", model: planModel, usage: planUsage });
            await saveUsage({ userId, conversationId: convId, stage: "summary", model: final?.model || "gpt-4o-mini", usage: final?.usage });
            await saveMessage({ conversationId: convId, userId, role: "assistant", content: answer, metadata: { intent: "data_query", plan } });

            return res.status(200).json({
                ok: true, intent: { intent: "data_query", topic: "fallback" },
                answer, reply: answer, plan, rows, conversationId: convId,
                tts: {
                    strategy: "client_webspeech",
                    lang: "es-CO",
                    female: true,
                    rate: 1.02, pitch: 1.02,
                    hints: ["Google español (Latinoamérica)", "Microsoft Sabina Spanish (Mexico) Female"]
                },
                usage: { plan: planUsage, summary: final?.usage }
            });
        }

    } catch (e) {
        return fail(res, "top-level", e);
    }
}
