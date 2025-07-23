const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:5000', 'https://jens-kosmetik-labor.web.app'],
    credentials: true
}));
app.use(express.json());

// Rate limiting (einfache Implementierung)
const rateLimitMap = new Map();
const RATE_LIMIT = 10; // 10 Anfragen pro Minute
const RATE_WINDOW = 60 * 1000; // 1 Minute

function checkRateLimit(ip) {
    const now = Date.now();
    const userRequests = rateLimitMap.get(ip) || [];
    
    // Entferne alte Anfragen
    const validRequests = userRequests.filter(time => now - time < RATE_WINDOW);
    
    if (validRequests.length >= RATE_LIMIT) {
        return false;
    }
    
    validRequests.push(now);
    rateLimitMap.set(ip, validRequests);
    return true;
}

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Kosmetik Labor AI Backend läuft' });
});

// Gemini AI Endpoint für Zutatenbefüllung
app.post('/api/ai-ingredient', async (req, res) => {
    try {
        // Rate Limiting
        if (!checkRateLimit(req.ip)) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded. Bitte warten Sie eine Minute.'
            });
        }

        const { name, inci } = req.body;
        
        // Validierung
        if (!name && !inci) {
            return res.status(400).json({
                success: false,
                error: 'Name oder INCI-Name erforderlich'
            });
        }

        // API Key prüfen
        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY nicht in Umgebungsvariablen gesetzt');
            return res.status(500).json({
                success: false,
                error: 'API-Konfiguration fehlt'
            });
        }

        const prompt = `Du bist ein Experte für kosmetische Inhaltsstoffe. Analysiere die folgende Zutat und gib die Informationen im JSON-Format zurück:

Zutat: ${name}
INCI: ${inci}

Bitte gib folgende Informationen zurück:
{
  "beschreibung": "Detaillierte Beschreibung der Zutat",
  "einsatzkonzentration": "Typische Konzentration (z.B. 1-5%)",
  "lagerung": "Eine der Optionen: Kühl & trocken, Kühlschrank, Raumtemperatur, Dunkel & kühl, Vor Licht schützen, Luftdicht verschlossen",
  "einarbeitungsphase": "Eine der Optionen: Fettphase, Wasserphase, Wirkstoffphase, Kühlphase, Kaltphase, Beliebig",
  "hauttyp": ["Array mit passenden Hauttypen: Alle Hauttypen, Normale Haut, Trockene Haut, Fettige Haut, Mischhaut, Sensible Haut, Reife Haut, Problemhaut"],
  "wirkung": "Beschreibung der Wirkung auf die Haut",
  "kategorie": ["Array mit passenden Kategorien: Basis, Öl, Butter, Wachs, Emulgator, Wirkstoff, Konservierung, Duft, Farbstoff, Sonstiges"]
}

Antworte nur mit dem JSON, ohne zusätzlichen Text.`;

        // Gemini API aufrufen
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 1000
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response from Gemini API');
        }

        const aiResponse = data.candidates[0].content.parts[0].text;
        
        // Response bereinigen
        const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
        
        // JSON parsen und validieren
        let aiData;
        try {
            aiData = JSON.parse(cleanResponse);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error('Invalid JSON response from AI');
        }

        // Erfolgreiche Antwort
        res.json({
            success: true,
            data: aiData,
            timestamp: new Date().toISOString()
        });

        // Logging (ohne sensitive Daten)
        console.log(`AI request successful for ingredient: ${name || inci}`);

    } catch (error) {
        console.error('AI ingredient error:', error);
        
        res.status(500).json({
            success: false,
            error: 'AI-Service temporär nicht verfügbar',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Interner Serverfehler'
    });
});

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint nicht gefunden'
    });
});

// Server starten
app.listen(PORT, () => {
    console.log(`🚀 Kosmetik Labor AI Backend läuft auf Port ${PORT}`);
    console.log(`📱 Gesundheitscheck: http://localhost:${PORT}/health`);
    console.log(`🤖 AI Endpoint: http://localhost:${PORT}/api/ai-ingredient`);
    
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  WARNUNG: GEMINI_API_KEY nicht gesetzt!');
    }
});

module.exports = app;