// /api/tts.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') return res.status(405).end();
        const { text, voiceId } = req.body || {};
        const vid = voiceId || process.env.ELEVEN_VOICE_ID;

        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
            method: 'POST',
            headers: {
                'xi-api-key': process.env.ELEVEN_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2', // o flash/turbo si prefieres costo/latencia
                voice_settings: { stability: 0.5, similarity_boost: 0.7, style: 0.0, use_speaker_boost: true }
            })
        });

        if (!r.ok) {
            const err = await r.text();
            return res.status(500).json({ error: 'TTS failed', details: err });
        }
        const buf = Buffer.from(await r.arrayBuffer());
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.end(buf);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
