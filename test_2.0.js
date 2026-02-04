const API_KEY = "AIzaSyDf-yIX2VEmBVA5OPaBUpxajJ8ZcRDOA20";

async function test() {
    console.log("Testing gemini-2.0-flash...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
        });
        const data = await response.json();
        console.log("OK:", response.ok);
        if (data.candidates) {
            console.log("Success!");
        } else {
            console.log("Fail:", JSON.stringify(data));
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}

test();
