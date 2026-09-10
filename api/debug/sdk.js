// /api/debug/sdk.js
import OpenAI from "openai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

export default async function handler(req, res) {
    try {
        const { version } = require("openai/package.json");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const hasResponses = !!openai.responses?.create;

        res.status(200).json({
            sdk_version: version,
            has_responses: hasResponses,
            node: process.version,
            cwd: process.cwd()
        });
    } catch (e) {
        res.status(500).json({ error: e?.message });
    }
}
