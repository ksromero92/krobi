export default async function handler(req, res) {
    try {
        const key = process.env.OPENAI_API_KEY || "";
        const supa = process.env.SUPABASE_URL || "";
        const role = process.env.SUPABASE_SERVICE_ROLE || "";

        res.status(200).json({
            openai_key_prefix: key ? key.slice(0, 10) + "••••" : null,
            has_openai_key: !!key,
            supabase_url_prefix: supa ? supa.slice(0, 30) + "…" : null,
            has_supabase_url: !!supa,
            has_service_role: !!role,
            vercel_env: process.env.VERCEL_ENV || "local",
            vercel_url: process.env.VERCEL_URL || null,
            node: process.version,
            now_iso: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ error: e?.message || "env error" });
    }
}
