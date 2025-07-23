// Test script to verify Gemini API key
require('dotenv').config();
const fetch = require('node-fetch');

async function testGeminiAPI() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        console.error('❌ GEMINI_API_KEY nicht gesetzt in .env');
        return;
    }
    
    console.log('🔍 Teste Gemini API...');
    console.log('API Key (erste 10 Zeichen):', apiKey.substring(0, 10) + '...');
    
    // First, list available models
    console.log('\n📋 Verfügbare Modelle abfragen...');
    try {
        const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
        if (modelsResponse.ok) {
            const modelsData = await modelsResponse.json();
            console.log('Verfügbare Modelle:');
            modelsData.models.forEach(model => {
                console.log('- ' + model.name);
            });
        }
    } catch (error) {
        console.error('Fehler beim Abrufen der Modelle:', error.message);
    }
    
    console.log('\n🧪 Teste Content Generation...');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: 'Antworte mit "Hallo" auf Deutsch.'
                    }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 100
                }
            })
        });

        console.log('Response Status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Fehler:', errorText);
            return;
        }

        const data = await response.json();
        console.log('✅ API Test erfolgreich!');
        console.log('Response:', JSON.stringify(data, null, 2));
        
        if (data.candidates && data.candidates[0]) {
            console.log('AI Antwort:', data.candidates[0].content.parts[0].text);
        }
        
    } catch (error) {
        console.error('❌ Network Error:', error.message);
    }
}

testGeminiAPI();