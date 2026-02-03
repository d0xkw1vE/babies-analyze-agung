import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from 'multer';

const app = express();

// Inisialisasi Google GenAI dengan API Key dari environment variable
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// **Set your default Gemini model here:**
// Menggunakan gemini-2.5-flash karena lebih stabil dan tersedia umum
const GEMINI_MODEL = "gemini-2.5-flash";
const aiModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const upload = multer();


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

        const region = req.body.region || 'US';

        // Base prompt (English)
        let prompt = `
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

        // Localize prompt based on region
        if (region === 'ID') {
            prompt = `
            Analisis audio ini dan tentukan apakah berisi suara bayi menangis.
            
            Kembalikan objek JSON dengan struktur berikut:
            {
                "is_baby_cry": boolean,
                "cause": string (misal: "Lapar", "Lelah", "Tidak Nyaman", "Sakit", "Overstimulasi", atau "Tidak Diketahui"),
                "confidence": number (0-100),
                "actions": string[] (daftar rekomendasi tindakan),
                "message": string (opsional, konteks atau penjelasan)
            }

            Jika INI BUKAN tangisan bayi, set "is_baby_cry" ke false dan berikan deskripsi di "message".
            Jika INI ADALAH tangisan bayi, analisis kemungkinan penyebab berdasarkan karakteristik suara (nada, ritme, intensitas), berikan skor kepercayaan (confidence), dan sarankan tindakan praktis.
            Gunakan Bahasa Indonesia untuk semua nilai string dalam respon JSON.
            `;
        }

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
