const API_KEY = "AIzaSyDf-yIX2VEmBVA5OPaBUpxajJ8ZcRDOA20";

async function testModel(version, model) {
    console.log(`Testing ${version} with ${model}...`);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
        });
        const data = await response.json();
        if (response.ok) {
            console.log(`✅ ${version}/${model} WORKS!`);
            return true;
        } else {
            console.log(`❌ ${version}/${model} FAILED: ${data.error?.message || response.statusText}`);
            return false;
        }
    } catch (e) {
        console.log(`❌ ${version}/${model} ERROR: ${e.message}`);
        return false;
    }
}

async function run() {
    const models = ["gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro"];
    const versions = ["v1", "v1beta"];

    for (const v of versions) {
        for (const m of models) {
            await testModel(v, m);
        }
    }
}

run();
