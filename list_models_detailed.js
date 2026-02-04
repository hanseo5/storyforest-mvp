const API_KEY = "AIzaSyDf-yIX2VEmBVA5OPaBUpxajJ8ZcRDOA20";

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        console.log("FULL MODEL LIST:");
        if (data.models) {
            data.models.forEach(m => {
                console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods.join(', ')})`);
            });
        } else {
            console.log("No models found in response:", JSON.stringify(data));
        }
    } catch (e) {
        console.log("ERROR LISTING MODELS:", e.message);
    }
}

listModels();
