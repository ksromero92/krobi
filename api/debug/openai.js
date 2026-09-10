import OpenAI from "openai";

export default async function handler(req, res) {
    try {
        const key = process.env.OPENAI_API_KEY;
        if (!key) return res.status(500).json({ error: "OPENAI_API_KEY missing" });

        const openai = new OpenAI({ apiKey: key });

        // Petición mínima (barata). Si hay problema de cuota, aquí se verá claramente.
        const r = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 5,
            messages: [
                { role: "system", content: "Di 'ok' y nada más." },
                { role: "user", content: "saluda" }
            ],
        });

        res.status(200).json({
            ok: true,
            key_prefix: key.slice(0, 10) + "••••",
            model_used: "gpt-4o-mini",
            reply: r.choices?.[0]?.message?.content ?? null
        });
    } catch (e) {
        // Devuelve información exacta del error de OpenAI
        res.status(200).json({
            ok: false,
            error_name: e?.name,
            error_message: e?.message,
            error_status: e?.status,
            // si el SDK trae más detalle:
            error_payload: e?.response?.data || null,
            key_prefix: (process.env.OPENAI_API_KEY || "").slice(0, 10) + "••••"
        });
    }
}
