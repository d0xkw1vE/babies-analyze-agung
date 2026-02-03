import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from 'multer';

const app = express();

// Inisialisasi Google GenAI dengan API Key dari environment variable
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// **Set your default Gemini model here:**
// Menggunakan gemini-1.5-flash karena lebih stabil dan tersedia umum
const GEMINI_MODEL = "gemini-2.5-flash";
const aiModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const upload = multer();


app.post('/api/chat', async (req, res) => {
    const { conversation, config } = req.body;
    const { temperature = 0.9, systemInstruction = `
Kamu adalah AI chef ramah dan berpengalaman.
Kamu membantu pengguna memasak dengan cara yang praktis, sederhana, dan menyenangkan.

Gaya menjawab:
- Bahasa Indonesia santai dan sopan
- Fokus ke solusi praktis
- Beri tips kecil agar masakan lebih enak
- Jika bahan tidak lengkap, beri alternatif

Batasan:
- Hanya menjawab seputar masak, resep, dan dapur
- Tidak menjawab topik di luar kuliner
    ` } = config || {};

    try {
        if (!Array.isArray(conversation)) {
            throw new Error('Messages must be an array!');
        }

        // Format history for the chat session
        const history = conversation.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text || msg.content }]
        }));

        const lastMessage = history.pop();
        if (!lastMessage || lastMessage.role !== 'user') {
            return res.status(400).json({ error: "Last message must be from user" });
        }

        const chat = aiModel.startChat({
            history: history,
            generationConfig: {
                temperature: Number(temperature),
            },
            systemInstruction: systemInstruction.trim()
        });

        const result = await chat.sendMessage(lastMessage.parts[0].text);
        const response = await result.response;
        const text = response.text();

        res.status(200).json({ result: text });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.post("/analyze-baby-cry", upload.single("audio"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No audio file uploaded." });
    }

    const base64Audio = req.file.buffer.toString("base64");

    try {
        const model = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
        Analyze this audio and determine if it contains a baby crying.
        
        Return a JSON object with the following structure:
        {
            "is_baby_cry": boolean,
            "cause": string (e.g., "Hunger", "Tiredness", "Discomfort", "Pain", "Overstimulation", or "Unknown"),
            "confidence": number (0-100),
            "actions": string[] (list of recommended actions),
            "message": string (optional, context or explanation)
        }

        If it is NOT a baby crying, set "is_baby_cry" to false and provide a description in "message".
        If it IS a baby crying, analyze the likely cause based on the sound characteristics (pitch, rhythm, intensity), provide a confidence score, and suggest practical actions.
        `;

        const audioPart = {
            inlineData: {
                data: base64Audio,
                mimeType: req.file.mimetype
            }
        };

        const result = await model.generateContent([
            prompt,
            audioPart
        ]);

        const response = await result.response;
        const text = response.text();

        try {
            const jsonResponse = JSON.parse(text);
            res.status(200).json(jsonResponse);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            res.status(200).json({ result: text });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

const PORT = process.env.PORT || 3000;

// Only listen when running locally (not in Vercel)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server ready on http://localhost:${PORT}`);
    });
}

// Export the Express API
export default app;
