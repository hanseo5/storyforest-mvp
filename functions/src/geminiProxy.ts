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

const INTEREST_LABELS: Record<string, string> = {
    dinosaur: '공룡',
    space: '우주',
    princess: '공주',
    robot: '로봇',
    animal: '동물',
    ocean: '바다',
    pizza: '피자',
    superhero: '슈퍼히어로',
};

const MESSAGE_LABELS: Record<string, string> = {
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
        memory: '1GiB',
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

        const pageCount = 12;
        const style = 'Soft Watercolor with warm pastel tones';

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
            storyPrompt = `You are a world-renowned children's picture book author. Create a ${pageCount}-page short story based on the following information.

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

Story Structure:
- Pages 1-2: Introduction (introduce protagonist)
- Pages 3-8: Development (adventure/events)
- Pages 9-11: Climax
- Page 12: Conclusion (deliver the message)

IMPORTANT: Write the entire story in English.

Return format (JSON only, no markdown):
{"title": "Title", "pages": [{"pageNumber": 1, "text": "..."}, ...]}`;
        } else if (isJapanese) {
            storyPrompt = `あなたは世界的な児童絵本作家です。以下の情報に基づいて${pageCount}ページの短い物語を作成してください。

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

物語の構造:
- 1-2ページ: 導入（主人公紹介）
- 3-8ページ: 展開（冒険/出来事）
- 9-11ページ: クライマックス
- 12ページ: 結末（教訓を伝える）

重要: 物語全体を日本語で書いてください。

返却形式（JSONのみ、マークダウンなし）:
{"title": "タイトル", "pages": [{"pageNumber": 1, "text": "..."}, ...]}`;
        } else {
            // Default: English
            storyPrompt = `You are a world-renowned children's picture book author. Create a ${pageCount}-page short story based on the following information.

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

Story Structure:
- Pages 1-2: Introduction (introduce protagonist)
- Pages 3-8: Development (adventure/events)
- Pages 9-11: Climax
- Page 12: Conclusion (deliver the message)

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function generateImageInternal(prompt: string, style: string, apiKey: string): Promise<string> {
    const enhancedPrompt = `You are a film director creating a storyboard frame for a children's picture book.

Art style: ${style}.

🎬 CURRENT SCENE: "${prompt}"

INSTRUCTIONS:
1. Create a beautiful, high-quality children's book illustration
2. Use vibrant colors and engaging compositions
3. Make characters expressive and appealing to children
4. Ensure the image is suitable for a picture book
5. Do NOT include any text in the image

Generate an illustration that captures this scene perfectly.`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();

    // Extract image from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }

    throw new Error('No image in response');
}

// Translation function
export const translateContent = onCall(
    {
        secrets: [geminiApiKey],
        timeoutSeconds: 60,
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
