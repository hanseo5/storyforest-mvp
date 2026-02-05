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

        // Determine language for story generation
        const languageInstruction = variables.targetLanguage === 'English'
            ? 'Write the story in English.'
            : variables.targetLanguage === 'Japanese'
                ? '日本語で物語を書いてください。'
                : '한국어로 동화를 작성해주세요.';

        const storyPrompt = `당신은 세계적인 아동 그림책 작가입니다. 다음 정보를 바탕으로 ${pageCount}페이지 짧은 동화를 만들어주세요.

주인공: ${variables.childName} (${variables.childAge}살)
좋아하는 것: ${interestLabels.join(', ')}
전달하고 싶은 메시지: "${messageLabel}"

📚 작성 규칙:
1. 주인공의 이름 "${variables.childName}"을(를) 반드시 사용하세요
2. 좋아하는 것들(${interestLabels.join(', ')})이 이야기에 자연스럽게 등장해야 합니다
3. 각 페이지는 1-2문장만 (그림책 스타일)
4. 교훈 "${messageLabel}"을(를) 결말에 자연스럽게 녹여주세요
5. ${variables.childAge}살 아이가 이해할 수 있는 쉬운 어휘
6. 따뜻하고 긍정적인 분위기

${languageInstruction}

스토리 구조:
- 1-2페이지: 도입 (주인공 소개)
- 3-8페이지: 전개 (모험/사건)
- 9-11페이지: 클라이맥스
- 12페이지: 결말 (교훈 전달)

반환 형식 (JSON만, 마크다운 없음):
{"title": "제목", "pages": [{"pageNumber": 1, "text": "..."}, ...]}`;

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
