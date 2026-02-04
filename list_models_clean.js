const API_KEY = "AIzaSyDf-yIX2VEmBVA5OPaBUpxajJ8ZcRDOA20";

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        const modelNames = data.models.map(m => m.name.replace('models/', ''));
        console.log("CLEAN MODEL NAMES:");
        modelNames.forEach(name => console.log(name));
    } catch (e) {
        console.log("ERROR:", e.message);
    }
}

listModels();
