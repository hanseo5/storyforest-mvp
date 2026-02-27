"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminLogin = exports.geminiGenerate = exports.generateImageCF = exports.translateContent = exports.generatePhotoStory = exports.generateStory = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// Define the secret for Gemini API key
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
// Art style ID to detailed prompt mapping
const ART_STYLE_PROMPTS = {
    watercolor: 'Soft watercolor with warm pastel tones and dreamy, gentle lighting',
    cartoon: 'Bright colorful cartoon style with bold outlines and cheerful expressions',
    crayon: 'Children\'s crayon drawing style with textured strokes and vivid colors',
    digital: 'Clean digital illustration with smooth gradients and modern aesthetic',
    pencil: 'Delicate pencil sketch with fine cross-hatching and soft shadows',
    papercut: 'Layered paper cut-out collage style with textured paper and depth',
};
const getArtStylePrompt = (styleId) => {
    return ART_STYLE_PROMPTS[styleId || 'watercolor'] || ART_STYLE_PROMPTS.watercolor;
};
/**
 * Robustly parse JSON from Gemini response.
 * Gemini sometimes returns JSON with trailing commas, single quotes,
 * or other non-standard formatting. This function attempts multiple
 * cleanup strategies before failing.
 */
const parseGeminiJson = (rawText, fnName) => {
    // Step 1: Strip markdown code fences
    let jsonStr = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    // Step 2: Extract JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch)
        jsonStr = jsonMatch[0];
    // Step 3: Try parsing as-is
    try {
        return JSON.parse(jsonStr);
    }
    catch {
        console.warn(`[${fnName}] Direct JSON.parse failed, attempting cleanup...`);
    }
    // Step 4: Fix common issues
    let cleaned = jsonStr
        // Remove trailing commas before } or ]
        .replace(/,\s*([\]}])/g, '$1')
        // Replace single quotes with double quotes (careful with apostrophes in text)
        .replace(/(?<=[\[{,:])\s*'([^']*)'\s*(?=[,\]}:])/g, '"$1"')
        // Remove control characters
        .replace(/[\x00-\x1F\x7F]/g, (c) => c === '\n' || c === '\t' ? c : '')
        // Fix unquoted property names like { title: "..." }
        .replace(/(\{|,)\s*([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
    try {
        return JSON.parse(cleaned);
    }
    catch {
        console.warn(`[${fnName}] Cleanup attempt 1 failed, trying more aggressive cleanup...`);
    }
    // Step 5: More aggressive - extract title and pages manually
    try {
        const titleMatch = cleaned.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const pagesMatch = cleaned.match(/"pages"\s*:\s*\[([\s\S]*)\]\s*\}?\s*$/);
        if (titleMatch && pagesMatch) {
            const title = titleMatch[1];
            const pagesStr = pagesMatch[1];
            // Extract individual page objects
            const pageRegex = /\{\s*"pageNumber"\s*:\s*(\d+)\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
            const pages = [];
            let match;
            while ((match = pageRegex.exec(pagesStr)) !== null) {
                pages.push({ pageNumber: parseInt(match[1]), text: match[2] });
            }
            if (pages.length > 0) {
                console.log(`[${fnName}] Manually extracted ${pages.length} pages from malformed JSON`);
                return { title, pages };
            }
        }
    }
    catch {
        // Fall through to error
    }
    console.error(`[${fnName}] All JSON parsing attempts failed. Raw text (first 2000 chars):`, rawText.substring(0, 2000));
    throw new https_1.HttpsError('internal', `Failed to parse Gemini response as JSON in ${fnName}`);
};
const INTEREST_LABELS = {
    dinosaur: '공룡',
    car: '자동차',
    space: '우주',
    animal: '동물',
    princess: '공주',
    superhero: '슈퍼히어로',
    robot: '로봇',
    ocean: '바다',
    fairy: '요정',
    dragon: '용',
    train: '기차',
    food: '음식',
};
const MESSAGE_LABELS = {
    sleep: '오늘은 일찍 자자',
    eat: '편식하지 말자',
    brave: '용기를 내자',
    love: '사랑해',
    friend: '친구와 사이좋게',
    clean: '정리정돈 잘하자',
    share: '나눠 쓰자',
};
exports.generateStory = (0, https_1.onCall)({
    secrets: [geminiApiKey],
    timeoutSeconds: 540,
    enforceAppCheck: false,
    cors: true,
    memory: '2GiB',
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const variables = request.data;
    const generationId = variables.generationId;
    if (!variables.childName || !variables.childAge) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields: childName, childAge');
    }
    const API_KEY = geminiApiKey.value();
    if (!API_KEY) {
        throw new https_1.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    // Helper to update Firestore progress (fire-and-forget)
    const updateProgress = (data) => {
        if (!generationId)
            return;
        db.collection('story_generations').doc(generationId).set(data, { merge: true }).catch(() => { });
    };
    // Mark generation as started
    updateProgress({ status: 'generating', phase: 'text', startedAt: admin.firestore.FieldValue.serverTimestamp() });
    const style = getArtStylePrompt(variables.artStyle);
    // Convert interests to labels
    const interestLabels = variables.interests.map(id => INTEREST_LABELS[id] || id);
    const messageLabel = variables.message === 'custom'
        ? variables.customMessage
        : MESSAGE_LABELS[variables.message] || variables.message;
    // Build prompt based on target language
    const targetLanguage = variables.targetLanguage || 'Korean';
    let storyPrompt;
    if (targetLanguage === 'English') {
        storyPrompt = `You are a world-renowned children's picture book author. Create a short story with 10 to 15 pages based on the following information. Choose the optimal page count for best story flow.

Protagonist: ${variables.childName} (${variables.childAge} years old)
Interests: ${interestLabels.join(', ')}
Message to convey: "${messageLabel}"

📚 Writing Rules:
1. Always use the protagonist's name "${variables.childName}"
2. The interests (${interestLabels.join(', ')}) should naturally appear in the story
3. Each page should have only 1-2 sentences (picture book style)
4. Naturally incorporate the message "${messageLabel}" in the ending
5. Use simple vocabulary that a ${variables.childAge}-year-old can understand
6. Warm and positive atmosphere

Story Structure (adjust proportionally to total page count):
- ~15% Introduction (introduce protagonist)
- ~40% Development (adventure/events)
- ~30% Climax
- ~15% Conclusion (deliver the message)

IMPORTANT: Write the entire story in English. Create 10 to 15 pages.

Return format (JSON only, no markdown):
{"title": "Title", "pages": [{"pageNumber": 1, "text": "..."}, ...]}`;
    }
    else if (targetLanguage === 'Japanese') {
        storyPrompt = `あなたは世界的な児童絵本作家です。以下の情報に基づいて10〜15ページの短い物語を作成してください。物語の自然な流れに合わせて最適なページ数を選んでください。

主人公: ${variables.childName} (${variables.childAge}歳)
好きなもの: ${interestLabels.join(', ')}
伝えたいメッセージ: "${messageLabel}"

📚 作成ルール:
1. 主人公の名前「${variables.childName}」を必ず使用してください
2. 好きなもの（${interestLabels.join(', ')}）が物語に自然に登場する必要があります
3. 各ページは1-2文のみ（絵本スタイル）
4. 教訓「${messageLabel}」を結末に自然に組み込んでください
5. ${variables.childAge}歳の子供が理解できる簡単な言葉
6. 温かく前向きな雰囲気

物語の構造（総ページ数に合わせて比率を調整）:
- 約15% 導入（主人公紹介）
- 約40% 展開（冒険/出来事）
- 約30% クライマックス
- 約15% 結末（教訓を伝える）

重要: 物語全体を日本語で書いてください。10〜15ページで作成してください。

返却形式（JSONのみ、マークダウンなし）:
{"title": "タイトル", "pages": [{"pageNumber": 1, "text": "..."}, ...]}`;
    }
    else {
        // Default: Korean
        storyPrompt = `당신은 세계적인 아동 그림책 작가입니다. 아래 정보를 기반으로 10~15페이지 분량의 짧은 동화를 만들어주세요. 이야기의 자연스러운 흐름에 맞게 최적의 페이지 수를 선택해주세요.

주인공: ${variables.childName} (${variables.childAge}세)
좋아하는 것: ${interestLabels.join(', ')}
전달하고 싶은 메시지: "${messageLabel}"

📚 작성 규칙:
1. 주인공 이름 "${variables.childName}"을 반드시 사용해주세요
2. 관심사 (${interestLabels.join(', ')})가 이야기에 자연스럽게 등장하도록 해주세요
3. 각 페이지는 1~2문장만 (그림책 스타일)
4. 교훈 "${messageLabel}"을 결말에 자연스럽게 녹여주세요
5. ${variables.childAge}세 아이가 이해할 수 있는 쉬운 단어를 사용해주세요
6. 따뜻하고 긍정적인 분위기
7. 대화체를 40% 이상 포함해주세요
8. 의성어/의태어를 적극 활용해주세요

이야기 구조 (총 페이지 수에 맞게 비율 조정):
- 약 15%: 도입 (주인공 소개)
- 약 40%: 전개 (모험/사건)
- 약 30%: 클라이맥스
- 약 15%: 결말 (메시지 전달)

중요: 이야기 전체를 한국어로 작성해주세요. 10~15페이지로 만들어주세요.

반환 형식 (JSON만, 마크다운 없이):
{"title": "동화 제목", "pages": [{"pageNumber": 1, "text": "..."}, ...]}`;
    }
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: storyPrompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 4096,
                },
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('[generateStory] Gemini API error:', errorBody);
            throw new https_1.HttpsError('internal', `Gemini API error: ${response.status}`);
        }
        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        // Parse JSON from response (with robust cleanup)
        const storyData = parseGeminiJson(text, 'generateStory');
        console.log('[generateStory] Story generated:', storyData.title);
        // Update progress: text done, starting images
        updateProgress({ phase: 'images', totalPages: storyData.pages.length, currentPage: 0 });
        // Build character description for visual consistency across all pages
        const characterDesc = `A ${variables.childAge}-year-old child named ${variables.childName} with a round, friendly face and bright curious eyes`;
        // Generate images sequentially for character/style consistency
        const generatedPages = [];
        for (let i = 0; i < storyData.pages.length; i++) {
            const page = storyData.pages[i];
            updateProgress({ currentPage: i + 1 });
            try {
                const imagePrompt = `Children's picture book illustration, ${style}:
Scene: ${page.text}
Main character: ${characterDesc}
Elements: ${interestLabels.join(', ')}
Page ${i + 1} of ${storyData.pages.length} - maintain consistent character appearance throughout the book
Style: Warm, inviting, child-friendly, full page illustration with no text`;
                const imageUrl = await generateImageInternal(imagePrompt, style, API_KEY);
                generatedPages.push({ pageNumber: page.pageNumber, text: page.text, imageUrl });
                console.log(`[generateStory] Image ${i + 1}/${storyData.pages.length} generated`);
            }
            catch (error) {
                console.error(`[generateStory] Image generation failed for page ${i + 1}:`, error);
                generatedPages.push({ pageNumber: page.pageNumber, text: page.text, imageUrl: undefined });
            }
        }
        const result = {
            title: storyData.title,
            style,
            pages: generatedPages,
        };
        // Save completed result to Firestore
        updateProgress({
            status: 'completed',
            phase: 'complete',
            result,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return result;
    }
    catch (error) {
        console.error('[generateStory] Error:', error);
        updateProgress({ status: 'error', error: String(error) });
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', 'Failed to generate story');
    }
});
// Internal helper for image generation
async function generateImageInternal(prompt, style, apiKey) {
    const enhancedPrompt = `You are a film director creating a storyboard frame for a children's picture book.

Art style: ${style}.

🎬 CURRENT SCENE: "${prompt}"

INSTRUCTIONS:
1. Create a beautiful, high-quality children's book illustration in 16:9 widescreen landscape aspect ratio (1920x1080)
2. Use vibrant colors and engaging compositions
3. Make characters expressive and appealing to children
4. Ensure the image is suitable for a picture book
5. Do NOT include any text in the image
6. The image MUST be in landscape orientation with 16:9 aspect ratio

Generate an illustration that captures this scene perfectly.`;
    const requestBody = JSON.stringify({
        contents: [
            {
                parts: [
                    {
                        text: enhancedPrompt,
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 1.0,
            topK: 64,
            topP: 0.98,
        },
    });
    // Retry logic: up to 3 attempts with exponential backoff
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
        });
        if (response.ok) {
            const data = await response.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
                if (part.inlineData?.mimeType?.startsWith('image/')) {
                    console.log(`[generateImageInternal] Image generated successfully (attempt ${attempt})`);
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
            throw new Error('No image in response');
        }
        const errBody = await response.text();
        console.warn(`[generateImageInternal] Attempt ${attempt}/${MAX_RETRIES} failed: ${response.status}`, errBody.substring(0, 200));
        // Don't retry on 4xx client errors (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`Image generation failed: ${response.status}`);
        }
        if (attempt === MAX_RETRIES) {
            throw new Error(`Image generation failed after ${MAX_RETRIES} retries: ${response.status}`);
        }
        const delay = attempt === 1 ? 3000 : 8000;
        console.log(`[generateImageInternal] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error('Image generation failed: exhausted retries');
}
exports.generatePhotoStory = (0, https_1.onCall)({
    secrets: [geminiApiKey],
    timeoutSeconds: 540,
    enforceAppCheck: false,
    cors: true,
    memory: '2GiB',
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const variables = request.data;
    const generationId = variables.generationId;
    console.log('[generatePhotoStory] Called with:', {
        childName: variables.childName,
        childAge: variables.childAge,
        interests: variables.interests,
        artStyle: variables.artStyle,
        message: variables.message,
        targetLanguage: variables.targetLanguage,
        hasPhoto: !!(variables.photoBase64),
        photoMimeType: variables.photoMimeType,
        photoDescLength: variables.photoDescription?.length,
        generationId,
    });
    if (!variables.childName || !variables.childAge) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields: childName, childAge');
    }
    const API_KEY = geminiApiKey.value();
    if (!API_KEY) {
        throw new https_1.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    // Helper to update Firestore progress (fire-and-forget)
    const updateProgress = (data) => {
        if (!generationId)
            return;
        db.collection('story_generations').doc(generationId).set(data, { merge: true }).catch(() => { });
    };
    // Mark generation as started
    updateProgress({ status: 'generating', phase: 'text', startedAt: admin.firestore.FieldValue.serverTimestamp() });
    const style = getArtStylePrompt(variables.artStyle);
    const targetLanguage = variables.targetLanguage || 'Korean';
    const interestLabels = (variables.interests || []).map(id => INTEREST_LABELS[id] || id);
    const messageLabel = variables.message === 'custom'
        ? variables.customMessage
        : MESSAGE_LABELS[variables.message] || variables.message;
    // Build request parts (with optional photo)
    const parts = [];
    if (variables.photoBase64 && variables.photoMimeType) {
        parts.push({
            inlineData: {
                mimeType: variables.photoMimeType,
                data: variables.photoBase64,
            }
        });
    }
    parts.push({
        text: `당신은 세계적인 아동 그림책 작가입니다.
첨부된 사진과 아래 정보를 기반으로 10~15페이지 분량의 아이를 위한 동화책을 만들어주세요.
스토리의 자연스러운 흐름에 맞게 최적의 페이지 수를 선택해주세요.

📸 사진 설명: "${variables.photoDescription || '가족과 함께한 특별한 순간'}"
👶 아이 이름: ${variables.childName}
🎂 나이: ${variables.childAge}세
⭐ 관심사: ${interestLabels.join(', ')}
💌 담고 싶은 메시지: ${messageLabel}
🌍 언어: ${targetLanguage}

📚 작성 규칙:
1. 사진 속 실제 상황을 동화적으로 재구성해주세요
2. 아이의 이름(${variables.childName})을 주인공으로 해주세요
3. 사진 속 경험을 마법같은 모험으로 변환해주세요
4. 각 페이지는 1~3문장으로 짧고 리듬감 있게 작성해주세요
5. 대화체를 40% 이상 포함해주세요
6. 의성어/의태어를 적극 활용해주세요
7. 교육적 메시지를 자연스럽게 녹여주세요
8. ${targetLanguage}로 작성해주세요

📖 스토리 구조 (총 페이지 수에 맞게 비율 조정):
- 약 15%: 사진 속 장면으로 시작 (도입)
- 약 40%: 모험의 시작
- 약 30%: 클라이맥스
- 약 15%: 교훈과 마무리

10~15페이지로 만들어주세요.
다음 JSON 형식만 반환해주세요 (마크다운 없이):
{"title": "동화 제목", "pages": [{"pageNumber": 1, "text": "..."}, {"pageNumber": 2, "text": "..."}, ...]}`
    });
    try {
        console.log('[generatePhotoStory] Calling Gemini text API...');
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                },
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('[generatePhotoStory] Gemini API error:', response.status, errorBody);
            throw new https_1.HttpsError('internal', `Gemini API error: ${response.status}`);
        }
        const data = await response.json();
        console.log('[generatePhotoStory] Got text response, parsing...');
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.error('[generatePhotoStory] No text in response:', JSON.stringify(data).substring(0, 500));
            throw new https_1.HttpsError('internal', 'No text generated from Gemini');
        }
        // Parse JSON from response (with robust cleanup)
        const storyData = parseGeminiJson(text, 'generatePhotoStory');
        console.log('[generatePhotoStory] Story generated:', storyData.title);
        // Update progress: text done, starting images
        updateProgress({ phase: 'images', totalPages: storyData.pages.length, currentPage: 0 });
        // Build character description for visual consistency across all pages
        const characterDesc = `A ${variables.childAge}-year-old child named ${variables.childName} with a round, friendly face and bright curious eyes`;
        // Generate images sequentially for character/style consistency
        const generatedPages = [];
        console.log(`[generatePhotoStory] Starting image generation for ${storyData.pages.length} pages (sequential)`);
        for (let i = 0; i < storyData.pages.length; i++) {
            const page = storyData.pages[i];
            updateProgress({ currentPage: i + 1 });
            try {
                console.log(`[generatePhotoStory] Generating image ${i + 1}/${storyData.pages.length}...`);
                const imagePrompt = `Children's picture book illustration, ${style}:
Scene: ${page.text}
Main character: ${characterDesc}
Elements: ${interestLabels.join(', ')}
Page ${i + 1} of ${storyData.pages.length} - maintain consistent character appearance throughout the book
Style: Warm, inviting, child-friendly, full page illustration with no text`;
                const imageUrl = await generateImageInternal(imagePrompt, style, API_KEY);
                generatedPages.push({ pageNumber: page.pageNumber, text: page.text, imageUrl });
                console.log(`[generatePhotoStory] Image ${i + 1} generated successfully`);
            }
            catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                console.error(`[generatePhotoStory] Image generation failed for page ${i + 1}:`, errMsg);
                generatedPages.push({ pageNumber: page.pageNumber, text: page.text, imageUrl: undefined });
            }
        }
        const result = {
            title: storyData.title,
            style,
            pages: generatedPages,
        };
        // Save completed result to Firestore
        updateProgress({
            status: 'completed',
            phase: 'complete',
            result,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return result;
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        updateProgress({ status: 'error', error: errMsg });
        const errStack = error instanceof Error ? error.stack : '';
        console.error('[generatePhotoStory] Error:', errMsg);
        console.error('[generatePhotoStory] Stack:', errStack);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', `Failed to generate photo-based story: ${errMsg}`);
    }
});
// Translation function
exports.translateContent = (0, https_1.onCall)({
    secrets: [geminiApiKey],
    timeoutSeconds: 60,
    enforceAppCheck: false,
    cors: true,
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { text, targetLanguage } = request.data;
    if (!text || !targetLanguage) {
        throw new https_1.HttpsError('invalid-argument', 'Missing text or targetLanguage');
    }
    const API_KEY = geminiApiKey.value();
    if (!API_KEY) {
        throw new https_1.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    const prompt = `Translate the following text to ${targetLanguage}. Keep it natural and child-friendly. Return ONLY the translated text, no explanations.

Text: ${text}`;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1024,
                },
            }),
        });
        if (!response.ok) {
            throw new https_1.HttpsError('internal', `Translation failed: ${response.status}`);
        }
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    }
    catch (error) {
        console.error('[translateContent] Error:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', 'Translation failed');
    }
});
exports.generateImageCF = (0, https_1.onCall)({
    secrets: [geminiApiKey],
    timeoutSeconds: 120,
    enforceAppCheck: false,
    cors: true,
    memory: '1GiB',
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { prompt, style, referenceImages, context, aspectRatio } = request.data;
    // Aspect ratio configuration
    const ratioConfig = aspectRatio === '3:4'
        ? { label: '3:4 portrait', size: '768x1024', orientation: 'portrait' }
        : aspectRatio === '1:1'
            ? { label: '1:1 square', size: '1024x1024', orientation: 'square' }
            : { label: '16:9 widescreen landscape', size: '1920x1080', orientation: 'landscape' };
    if (!prompt) {
        throw new https_1.HttpsError('invalid-argument', 'Missing prompt');
    }
    const API_KEY = geminiApiKey.value();
    if (!API_KEY) {
        throw new https_1.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    // Build context section
    let contextInfo = '';
    if (context) {
        const prevTextsStr = context.previousTexts?.length > 0
            ? `\nPREVIOUS PAGES:\n${context.previousTexts.map((t, i) => `  Page ${context.pageNumber - context.previousTexts.length + i}: "${t}"`).join('\n')}`
            : '';
        contextInfo = `\n📖 STORY CONTEXT:\nTitle: "${context.title}"\nCurrent Page: ${context.pageNumber} of ${context.totalPages}\n${prevTextsStr}\n`;
    }
    // Build parts array
    const parts = [];
    parts.push({
        text: `You are a film director creating a storyboard frame for a children's picture book.

Art style: ${style || 'Soft watercolor with warm pastel tones'}.
${contextInfo}
🎬 CURRENT SCENE: "${prompt}"

INSTRUCTIONS:
1. Create a beautiful, high-quality children's book illustration in ${ratioConfig.label} aspect ratio (${ratioConfig.size})
2. Use vibrant colors and engaging compositions
3. Make characters expressive and appealing to children
4. Ensure the image is suitable for a picture book
5. Do NOT include any text in the image
6. The image MUST be in ${ratioConfig.orientation} orientation with ${ratioConfig.label} aspect ratio

Generate an illustration that captures this scene perfectly.`
    });
    // Add reference images if provided
    if (referenceImages && referenceImages.length > 0) {
        for (const img of referenceImages) {
            if (img.data && img.mimeType) {
                parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
            }
        }
    }
    try {
        console.log('[generateImageCF] Generating image for:', prompt.substring(0, 80));
        console.log('[generateImageCF] Parts count:', parts.length, 'Reference images:', referenceImages?.length || 0);
        const requestBody = {
            contents: [{ parts }],
            generationConfig: {
                temperature: 1.0,
                topK: 64,
                topP: 0.98,
            },
        };
        const bodyStr = JSON.stringify(requestBody);
        console.log('[generateImageCF] Request body size:', bodyStr.length, 'bytes');
        // Retry logic: up to 3 attempts with exponential backoff
        const MAX_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: bodyStr,
            });
            if (response.ok) {
                const data = await response.json();
                const responseParts = data.candidates?.[0]?.content?.parts || [];
                for (const part of responseParts) {
                    if (part.inlineData?.mimeType?.startsWith('image/')) {
                        console.log(`[generateImageCF] Image generated successfully (attempt ${attempt})`);
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
                throw new https_1.HttpsError('internal', 'No image in Gemini response');
            }
            const errBody = await response.text();
            console.warn(`[generateImageCF] Attempt ${attempt}/${MAX_RETRIES} failed: ${response.status}`, errBody.substring(0, 200));
            // Don't retry on 4xx client errors (except 429 rate limit)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                throw new https_1.HttpsError('internal', `Image generation failed: ${response.status}`);
            }
            // Last attempt — give up
            if (attempt === MAX_RETRIES) {
                throw new https_1.HttpsError('internal', `Image generation failed after ${MAX_RETRIES} retries: ${response.status}`);
            }
            // Wait before retry: 3s, 8s
            const delay = attempt === 1 ? 3000 : 8000;
            console.log(`[generateImageCF] Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        throw new https_1.HttpsError('internal', 'No image in Gemini response');
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[generateImageCF] Error:', errMsg);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', `Image generation failed: ${errMsg}`);
    }
});
exports.geminiGenerate = (0, https_1.onCall)({
    secrets: [geminiApiKey],
    timeoutSeconds: 120,
    enforceAppCheck: false,
    cors: true,
    memory: '256MiB',
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { prompt, generationConfig, safetySettings } = request.data;
    if (!prompt) {
        throw new https_1.HttpsError('invalid-argument', 'Missing prompt');
    }
    const API_KEY = geminiApiKey.value();
    if (!API_KEY) {
        throw new https_1.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: generationConfig || {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                },
                safetySettings: safetySettings || [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                ],
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[geminiGenerate] Gemini API error:', response.status, errorText.substring(0, 300));
            throw new https_1.HttpsError('internal', `Gemini API error: ${response.status}`);
        }
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            throw new https_1.HttpsError('internal', 'No text in Gemini response');
        }
        return text;
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        const errMsg = error instanceof Error ? error.message : String(error);
        throw new https_1.HttpsError('internal', `Gemini API call failed: ${errMsg}`);
    }
});
// ==================== Admin Registration (server-side) ====================
const SERVER_ADMIN_EMAILS = ['hsl020819@gmail.com'];
exports.registerAdminLogin = (0, https_1.onCall)({
    timeoutSeconds: 60,
    enforceAppCheck: false,
    cors: true,
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const email = request.auth.token.email;
    if (!email || !SERVER_ADMIN_EMAILS.includes(email.toLowerCase())) {
        throw new https_1.HttpsError('permission-denied', 'Not an admin user');
    }
    const uid = request.auth.uid;
    const adminDb = await Promise.resolve().then(() => __importStar(require('firebase-admin'))).then(m => m.firestore());
    // Register admin UID
    const configRef = adminDb.doc('config/admins');
    const snap = await configRef.get();
    let previousUids = [];
    if (snap.exists) {
        previousUids = snap.data()?.uids || [];
        if (!previousUids.includes(uid)) {
            const { FieldValue } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
            await configRef.update({ uids: FieldValue.arrayUnion(uid) });
        }
    }
    else {
        await configRef.set({ uids: [uid] });
    }
    // Migrate books from old admin UIDs
    let migratedCount = 0;
    const oldUids = previousUids.filter(id => id !== uid);
    for (const oldUid of oldUids) {
        const booksSnap = await adminDb.collection('books').where('authorId', '==', oldUid).get();
        for (const bookDoc of booksSnap.docs) {
            await bookDoc.ref.update({ authorId: uid });
        }
        migratedCount += booksSnap.size;
    }
    // Clean up: keep only current UID
    if (oldUids.length > 0) {
        await configRef.set({ uids: [uid] });
    }
    // Migrate orphan books
    if (!snap.exists || !snap.data()?.migrated) {
        const allBooksSnap = await adminDb.collection('books').get();
        for (const bookDoc of allBooksSnap.docs) {
            const authorId = bookDoc.data().authorId;
            if (authorId && authorId !== uid) {
                const userSnap = await adminDb.doc(`users/${authorId}`).get();
                const userData = userSnap.exists ? userSnap.data() : null;
                const hasEmail = userData?.email;
                if (!userSnap.exists || !hasEmail || SERVER_ADMIN_EMAILS.includes(hasEmail.toLowerCase())) {
                    await bookDoc.ref.update({ authorId: uid });
                    migratedCount++;
                }
            }
        }
        if (migratedCount > 0) {
            await configRef.update({ migrated: true });
        }
    }
    console.log(`[registerAdminLogin] Admin ${email} registered. Migrated ${migratedCount} books.`);
    return { success: true, migratedBooks: migratedCount };
});
//# sourceMappingURL=geminiProxy.js.map