import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

// Define the secret for Gemini API key
const geminiApiKey = defineSecret('GEMINI_API_KEY');

interface StoryVariables {
    childName: string;
    childAge: number;
    interests: string[];
    message: string;
    customMessage?: string;
    targetLanguage: string;
    artStyle?: string;
}

interface GeneratedPage {
    pageNumber: number;
    text: string;
    imageUrl?: string;
}

interface GeneratedStory {
    title: string;
    style: string;
    pages: GeneratedPage[];
}

// Art style ID to detailed prompt mapping
const ART_STYLE_PROMPTS: Record<string, string> = {
    watercolor: 'Soft watercolor with warm pastel tones and dreamy, gentle lighting',
    cartoon: 'Bright colorful cartoon style with bold outlines and cheerful expressions',
    crayon: 'Children\'s crayon drawing style with textured strokes and vivid colors',
    digital: 'Clean digital illustration with smooth gradients and modern aesthetic',
    pencil: 'Delicate pencil sketch with fine cross-hatching and soft shadows',
    papercut: 'Layered paper cut-out collage style with textured paper and depth',
};

const getArtStylePrompt = (styleId?: string): string => {
    return ART_STYLE_PROMPTS[styleId || 'watercolor'] || ART_STYLE_PROMPTS.watercolor;
};

const INTEREST_LABELS: Record<string, string> = {
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

const MESSAGE_LABELS: Record<string, string> = {
    sleep: '오늘은 일찍 자자',
    eat: '편식하지 말자',
    brave: '용기를 내자',
    love: '사랑해',
    friend: '친구와 사이좋게',
    clean: '정리정돈 잘하자',
    share: '나눠 쓰자',
};

export const generateStory = onCall(
    {
        secrets: [geminiApiKey],
        timeoutSeconds: 300,
        enforceAppCheck: false,
        cors: true,
        memory: '2GiB',
    },
    async (request: { data: StoryVariables }): Promise<GeneratedStory> => {
        const variables = request.data as StoryVariables;

        if (!variables.childName || !variables.childAge) {
            throw new HttpsError('invalid-argument', 'Missing required fields: childName, childAge');
        }

        const API_KEY = geminiApiKey.value();
        if (!API_KEY) {
            throw new HttpsError('failed-precondition', 'Gemini API key not configured');
        }

        const style = getArtStylePrompt(variables.artStyle);

        // Convert interests to labels
        const interestLabels = variables.interests.map(id => INTEREST_LABELS[id] || id);
        const messageLabel = variables.message === 'custom'
            ? variables.customMessage
            : MESSAGE_LABELS[variables.message] || variables.message;


        // Build prompt based on target language
        const isEnglish = variables.targetLanguage === 'English';
        const isJapanese = variables.targetLanguage === 'Japanese';

        let storyPrompt: string;

        if (isEnglish) {
            storyPrompt = `You are a world-renowned children's picture book author. Create a short story with 10 to 15 pages based on the following information. Choose the page count that best fits the story's natural flow.

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

IMPORTANT: Write the entire story in English.

Return format (JSON only, no markdown):
{"title": "Title", "pages": [{"pageNumber": 1, "text": "..."}, ...]}`;
        } else if (isJapanese) {
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

重要: 物語全体を日本語で書いてください。

返却形式（JSONのみ、マークダウンなし）:
{"title": "タイトル", "pages": [{"pageNumber": 1, "text": "..."}, ...]}`;
        } else {
            // Default: English
            storyPrompt = `You are a world-renowned children's picture book author. Create a short story with 10 to 15 pages based on the following information. Choose the page count that best fits the story's natural flow.

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

IMPORTANT: Write the entire story in English.

Return format (JSON only, no markdown):
{"title": "Title", "pages": [{"pageNumber": 1, "text": "..."}, ...]}`;
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: storyPrompt }] }],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 4096,
                        },
                    }),
                }
            );

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('[generateStory] Gemini API error:', errorBody);
                throw new HttpsError('internal', `Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;

            // Parse JSON from response
            let jsonStr = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonStr = jsonMatch[0];

            const storyData = JSON.parse(jsonStr);
            console.log('[generateStory] Story generated:', storyData.title);

            // Generate images for each page
            const generatedPages: GeneratedPage[] = [];

            for (let i = 0; i < storyData.pages.length; i++) {
                const page = storyData.pages[i];

                try {
                    const imagePrompt = `Children's picture book illustration, ${style}:
Scene: ${page.text}
Main character: ${variables.childName}, a ${variables.childAge}-year-old child
Elements: ${interestLabels.join(', ')}
Style: Warm, inviting, child-friendly, full page illustration with no text`;

                    const imageUrl = await generateImageInternal(imagePrompt, style, API_KEY);

                    generatedPages.push({
                        pageNumber: page.pageNumber,
                        text: page.text,
                        imageUrl,
                    });
                } catch (error) {
                    console.error(`[generateStory] Image generation failed for page ${i + 1}:`, error);
                    generatedPages.push({
                        pageNumber: page.pageNumber,
                        text: page.text,
                        imageUrl: undefined,
                    });
                }
            }

            return {
                title: storyData.title,
                style,
                pages: generatedPages,
            };
        } catch (error) {
            console.error('[generateStory] Error:', error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('internal', 'Failed to generate story');
        }
    }
);

// Internal helper for image generation
async function generateImageInternal(prompt: string, style: string, apiKey: string): Promise<string> {
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
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBody,
            }
        );

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

// ==================== Photo-based Story Generation ====================

interface PhotoStoryVariables {
    childName: string;
    childAge: number;
    interests: string[];
    message: string;
    customMessage?: string;
    targetLanguage: string;
    artStyle?: string;
    photoBase64?: string;
    photoMimeType?: string;
    photoDescription?: string;
}

export const generatePhotoStory = onCall(
    {
        secrets: [geminiApiKey],
        timeoutSeconds: 300,
        enforceAppCheck: false,
        cors: true,
        memory: '2GiB',
    },
    async (request: { data: PhotoStoryVariables }): Promise<GeneratedStory> => {
        const variables = request.data as PhotoStoryVariables;
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
        });

        if (!variables.childName || !variables.childAge) {
            throw new HttpsError('invalid-argument', 'Missing required fields: childName, childAge');
        }

        const API_KEY = geminiApiKey.value();
        if (!API_KEY) {
            throw new HttpsError('failed-precondition', 'Gemini API key not configured');
        }

        const style = getArtStylePrompt(variables.artStyle);
        const targetLanguage = variables.targetLanguage || 'Korean';

        const interestLabels = (variables.interests || []).map(id => INTEREST_LABELS[id] || id);
        const messageLabel = variables.message === 'custom'
            ? variables.customMessage
            : MESSAGE_LABELS[variables.message] || variables.message;

        // Build request parts (with optional photo)
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

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

10~15페이지 사이에서 적절한 분량을 만들어주세요.
다음 JSON 형식만 반환해주세요 (마크다운 없이):
{"title": "동화 제목", "pages": [{"pageNumber": 1, "text": "..."}, {"pageNumber": 2, "text": "..."}, ...]}`
        });

        try {
            console.log('[generatePhotoStory] Calling Gemini text API...');
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
                {
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
                }
            );

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('[generatePhotoStory] Gemini API error:', response.status, errorBody);
                throw new HttpsError('internal', `Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('[generatePhotoStory] Got text response, parsing...');
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                console.error('[generatePhotoStory] No text in response:', JSON.stringify(data).substring(0, 500));
                throw new HttpsError('internal', 'No text generated from Gemini');
            }

            // Parse JSON
            let jsonStr = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonStr = jsonMatch[0];

            const storyData = JSON.parse(jsonStr);
            console.log('[generatePhotoStory] Story generated:', storyData.title);

            // Generate images for each page
            const generatedPages: GeneratedPage[] = [];
            console.log(`[generatePhotoStory] Starting image generation for ${storyData.pages.length} pages`);

            for (let i = 0; i < storyData.pages.length; i++) {
                const page = storyData.pages[i];

                try {
                    console.log(`[generatePhotoStory] Generating image ${i + 1}/${storyData.pages.length}...`);
                    const imagePrompt = `Children's picture book illustration, ${style}:
Scene: ${page.text}
Main character: ${variables.childName}, a ${variables.childAge}-year-old child
Elements: ${interestLabels.join(', ')}
Style: Warm, inviting, child-friendly, full page illustration with no text`;

                    const imageUrl = await generateImageInternal(imagePrompt, style, API_KEY);

                    generatedPages.push({
                        pageNumber: page.pageNumber,
                        text: page.text,
                        imageUrl,
                    });
                    console.log(`[generatePhotoStory] Image ${i + 1} generated successfully`);
                } catch (error: unknown) {
                    const errMsg = error instanceof Error ? error.message : String(error);
                    console.error(`[generatePhotoStory] Image generation failed for page ${i + 1}:`, errMsg);
                    generatedPages.push({
                        pageNumber: page.pageNumber,
                        text: page.text,
                        imageUrl: undefined,
                    });
                }
            }

            return {
                title: storyData.title,
                style,
                pages: generatedPages,
            };
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            const errStack = error instanceof Error ? error.stack : '';
            console.error('[generatePhotoStory] Error:', errMsg);
            console.error('[generatePhotoStory] Stack:', errStack);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('internal', `Failed to generate photo-based story: ${errMsg}`);
        }
    }
);

// Translation function
export const translateContent = onCall(
    {
        secrets: [geminiApiKey],
        timeoutSeconds: 60,
        enforceAppCheck: false,
        cors: true,
    },
    async (request: { data: { text: string; targetLanguage: string } }): Promise<string> => {
        const { text, targetLanguage } = request.data as { text: string; targetLanguage: string };

        if (!text || !targetLanguage) {
            throw new HttpsError('invalid-argument', 'Missing text or targetLanguage');
        }

        const API_KEY = geminiApiKey.value();
        if (!API_KEY) {
            throw new HttpsError('failed-precondition', 'Gemini API key not configured');
        }

        const prompt = `Translate the following text to ${targetLanguage}. Keep it natural and child-friendly. Return ONLY the translated text, no explanations.

Text: ${text}`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 1024,
                        },
                    }),
                }
            );

            if (!response.ok) {
                throw new HttpsError('internal', `Translation failed: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text.trim();
        } catch (error) {
            console.error('[translateContent] Error:', error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('internal', 'Translation failed');
        }
    }
);

// ==================== Image Generation (for Story Editor) ====================

interface GenerateImageRequest {
    prompt: string;
    style: string;
    referenceImages?: Array<{ mimeType: string; data: string; label?: string }>;
    aspectRatio?: '16:9' | '3:4' | '1:1';
    context?: {
        title: string;
        characterName: string;
        previousTexts: string[];
        pageNumber: number;
        totalPages: number;
    };
}

export const generateImageCF = onCall(
    {
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        enforceAppCheck: false,
        cors: true,
        memory: '1GiB',
    },
    async (request: { data: GenerateImageRequest }): Promise<string> => {
        const { prompt, style, referenceImages, context, aspectRatio } = request.data;

        // Aspect ratio configuration
        const ratioConfig = aspectRatio === '3:4'
            ? { label: '3:4 portrait', size: '768x1024', orientation: 'portrait' }
            : aspectRatio === '1:1'
            ? { label: '1:1 square', size: '1024x1024', orientation: 'square' }
            : { label: '16:9 widescreen landscape', size: '1920x1080', orientation: 'landscape' };

        if (!prompt) {
            throw new HttpsError('invalid-argument', 'Missing prompt');
        }

        const API_KEY = geminiApiKey.value();
        if (!API_KEY) {
            throw new HttpsError('failed-precondition', 'Gemini API key not configured');
        }

        // Build context section
        let contextInfo = '';
        if (context) {
            const prevTextsStr = context.previousTexts?.length > 0
                ? `\nPREVIOUS PAGES:\n${context.previousTexts.map((t: string, i: number) => `  Page ${context.pageNumber - context.previousTexts.length + i}: "${t}"`).join('\n')}`
                : '';
            contextInfo = `\n📖 STORY CONTEXT:\nTitle: "${context.title}"\nCurrent Page: ${context.pageNumber} of ${context.totalPages}\n${prevTextsStr}\n`;
        }

        // Build parts array
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

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
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: bodyStr,
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    const responseParts = data.candidates?.[0]?.content?.parts || [];
                    for (const part of responseParts) {
                        if (part.inlineData?.mimeType?.startsWith('image/')) {
                            console.log(`[generateImageCF] Image generated successfully (attempt ${attempt})`);
                            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                        }
                    }
                    throw new HttpsError('internal', 'No image in Gemini response');
                }

                const errBody = await response.text();
                console.warn(`[generateImageCF] Attempt ${attempt}/${MAX_RETRIES} failed: ${response.status}`, errBody.substring(0, 200));

                // Don't retry on 4xx client errors (except 429 rate limit)
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    throw new HttpsError('internal', `Image generation failed: ${response.status}`);
                }

                // Last attempt — give up
                if (attempt === MAX_RETRIES) {
                    throw new HttpsError('internal', `Image generation failed after ${MAX_RETRIES} retries: ${response.status}`);
                }

                // Wait before retry: 3s, 8s
                const delay = attempt === 1 ? 3000 : 8000;
                console.log(`[generateImageCF] Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            throw new HttpsError('internal', 'No image in Gemini response');
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('[generateImageCF] Error:', errMsg);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('internal', `Image generation failed: ${errMsg}`);
        }
    }
);

// ==================== Generic Gemini Proxy ====================
// Secure proxy so client never sees the API key

interface GeminiGenerateRequest {
    prompt: string;
    generationConfig?: {
        temperature?: number;
        topK?: number;
        topP?: number;
        maxOutputTokens?: number;
    };
    safetySettings?: Array<{ category: string; threshold: string }>;
}

export const geminiGenerate = onCall(
    {
        secrets: [geminiApiKey],
        timeoutSeconds: 120,
        enforceAppCheck: false,
        cors: true,
        memory: '256MiB',
    },
    async (request: { auth?: { uid: string }; data: GeminiGenerateRequest }): Promise<string> => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        const { prompt, generationConfig, safetySettings } = request.data;
        if (!prompt) {
            throw new HttpsError('invalid-argument', 'Missing prompt');
        }

        const API_KEY = geminiApiKey.value();
        if (!API_KEY) {
            throw new HttpsError('failed-precondition', 'Gemini API key not configured');
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`,
                {
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
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[geminiGenerate] Gemini API error:', response.status, errorText.substring(0, 300));
                throw new HttpsError('internal', `Gemini API error: ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new HttpsError('internal', 'No text in Gemini response');
            }

            return text;
        } catch (error: unknown) {
            if (error instanceof HttpsError) throw error;
            const errMsg = error instanceof Error ? error.message : String(error);
            throw new HttpsError('internal', `Gemini API call failed: ${errMsg}`);
        }
    }
);

// ==================== Admin Registration (server-side) ====================

const SERVER_ADMIN_EMAILS = ['hsl020819@gmail.com'];

export const registerAdminLogin = onCall(
    {
        timeoutSeconds: 60,
        enforceAppCheck: false,
        cors: true,
    },
    async (request: { auth?: { uid: string; token: { email?: string } } }): Promise<{ success: boolean; migratedBooks: number }> => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        const email = request.auth.token.email;
        if (!email || !SERVER_ADMIN_EMAILS.includes(email.toLowerCase())) {
            throw new HttpsError('permission-denied', 'Not an admin user');
        }

        const uid = request.auth.uid;
        const adminDb = await import('firebase-admin').then(m => m.firestore());

        // Register admin UID
        const configRef = adminDb.doc('config/admins');
        const snap = await configRef.get();
        let previousUids: string[] = [];

        if (snap.exists) {
            previousUids = (snap.data()?.uids as string[]) || [];
            if (!previousUids.includes(uid)) {
                const { FieldValue } = await import('firebase-admin/firestore');
                await configRef.update({ uids: FieldValue.arrayUnion(uid) });
            }
        } else {
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
    }
);
