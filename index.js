import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import mime from 'mime-types';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

/* ================================
   CONFIG
================================ */
const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = 'gemini-2.5-flash';

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const upload = multer({
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/* ================================
   HELPERS
================================ */

// 🔥 Fix utama: normalize MIME
function resolveMimeType(file) {
    let type = file.mimetype;

    // kalau Flutter kirim octet-stream → detect dari nama file
    if (!type || type === 'application/octet-stream') {
        type = mime.lookup(file.originalname) || 'audio/wav';
    }

    return type;
}

function getPrompt(region = 'US') {
    if (region === 'ID') {
        return `
Analisis audio ini dan tentukan apakah berisi suara bayi menangis.

Kembalikan objek JSON dengan struktur:
{
  "is_baby_cry": boolean,
  "cause": string,
  "confidence": number (0-100),
  "actions": string[],
  "message": string
}

Gunakan Bahasa Indonesia untuk semua nilai string.
`;
    }

    return `
Analyze this audio and determine if it contains a baby crying.

Return JSON:
{
  "is_baby_cry": boolean,
  "cause": string,
  "confidence": number (0-100),
  "actions": string[],
  "message": string
}
`;
}

/* ================================
   ROUTES
================================ */

app.post('/analyze-baby-cry', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No audio file uploaded.' });
        }

        const base64Audio = req.file.buffer.toString('base64');

        const mimeType = resolveMimeType(req.file);

        console.log('📁 File:', req.file.originalname);
        console.log('📦 MIME:', mimeType);

        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                responseMimeType: 'application/json'
            }
        });

        const prompt = getPrompt(req.body.region);

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Audio,
                    mimeType
                }
            }
        ]);

        const text = result.response.text();

        try {
            const parsed = JSON.parse(text);
            return res.json(parsed);
        } catch {
            return res.json({ raw: text });
        }
    } catch (err) {
        console.error('🔥 ERROR:', err);
        res.status(500).json({
            message: err.message
        });
    }
});

/* ================================
   START SERVER
================================ */

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server ready → http://localhost:${PORT}`);
    });
}

export default app;
