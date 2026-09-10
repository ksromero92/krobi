// /api/tts-openai.js
export const config = { runtime: "nodejs" };

import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// util CORS simple
function setCors(res, origin) {
    if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
    try {
        setCors(res, req.headers.origin);
        if (req.method === "OPTIONS") return res.status(204).end();

        // 1) extrae texto/voz/formato de GET o POST
        let text = "";
        let voice = "verse";
        let format = "mp3";

        if (req.method === "GET") {
            text = (req.query?.text || "Hola, soy KroBi. ¿Listo para análisis de ventas?").toString();
            voice = (req.query?.voice || voice).toString();
            format = (req.query?.format || format).toString();
        } else if (req.method === "POST") {
            const isJson = (req.headers["content-type"] || "").includes("application/json");
            const body = isJson ? req.body : {};
            text = (body?.text || "").toString();
            voice = (body?.voice || voice).toString();
            format = (body?.format || format).toString();
        } else {
            return res.status(405).json({ error: "method_not_allowed" });
        }

        if (!text.trim()) return res.status(400).json({ error: "missing_text" });

        // 2) estilo para “colombianizar” la prosodia
        const style =
            "Habla español de Colombia (es-CO), voz femenina, tono cálido y natural, ritmo conversacional. " +
            "En números, usa 'mil' y 'millones' y pausas cortas amistosas.";

        // 3) llamada TTS OpenAI
        const resp = await openai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            voice,                   // verse | coral | sage | shimmer | ...
            input: text,
            format                   // mp3 | wav | ogg
        });

        const ab = await resp.arrayBuffer();
        const buff = Buffer.from(ab);

        // 4) headers de audio correctos
        const ct = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
        res.setHeader("Content-Type", ct);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(buff);
    } catch (e) {
        // devuelve JSON si hay error (el front NO intentará reproducirlo)
        return res.status(500).json({ error: "tts_failed", message: e.message });
    }
}
