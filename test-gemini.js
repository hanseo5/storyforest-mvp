import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ No API Key found in .env");
    process.exit(1);
}

console.log(`🔑 Testing API Key: ${API_KEY.substring(0, 5)}...`);

const genAI = new GoogleGenerativeAI(API_KEY);

async function run() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        console.log("🤖 Sending prompt to Gemini...");
        const result = await model.generateContent("Say hello and tell me a one sentence story.");
        const response = await result.response;
        const text = response.text();

        console.log("✅ Success! Response:");
        console.log(text);
    } catch (error) {
        console.error("❌ Failed to generate content.");
        console.error(error);
    }
}

run();
