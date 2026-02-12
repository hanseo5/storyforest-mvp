/**
 * Gemini Service — all calls go through Cloud Functions (geminiGenerate proxy).
 * The Gemini API key NEVER leaves the server.
 */

import { geminiGenerateSecure } from './cloudFunctionsService';

// ==================== Story Metadata ====================

export const generateStoryMetadata = async (prompt: string) => {
    try {
        const text = await geminiGenerateSecure(
            `You are a world-class children's picture book author and character designer. Create a poetic and deeply evocative story concept based on: "${prompt}"

TITLE (3-7 words, captivating and poetic)

CHARACTER DESCRIPTION (6-8 sentences, professional author quality):
- Give them a soul: Describe their core hope, fear, or a quirky habit.
- Physical poetry: Use metaphors for their appearance (e.g., "eyes like rain-washed pebbles", "fur as soft as a forgotten cloud").
- Sensory richness: Mention the scent they carry (pine needles, old books, cinnamon) or the sound of their movement (soft rustle of silk, rhythmic clink of tiny keys).
- Visual Style Integration: Ensure the description explicitly mentions details fitting for a "${prompt}" universe.
- Emotional expression: How does their heart show on their sleeve?

RETURN ONLY THIS JSON (one line, properly escaped):
{"title": "Story Title", "description": "Professional poetic description", "style": "Chosen Style", "pages": 50}`,
            { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 2048 }
        );

        // Parse JSON from response
        try {
            let jsonStr = text.trim();
            jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonStr = jsonMatch[0];
            return JSON.parse(jsonStr);
        } catch (jsonError) {
            console.warn('[GeminiService] JSON parse failed, using field extraction...', jsonError);

            const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/i) ||
                text.match(/["']title["']\s*:\s*["']([^"']+)["']/i);
            const styleMatch = text.match(/"style"\s*:\s*"([^"]+)"/i) ||
                text.match(/["']style["']\s*:\s*["']([^"']+)["']/i);
            const pagesMatch = text.match(/"pages"\s*:\s*(\d+)/i);

            if (titleMatch && styleMatch) {
                return {
                    title: titleMatch[1].trim(),
                    description: '',
                    characters: [] as Array<{ id: string; name: string; description: string; imageUrl?: string | null }>,
                    style: styleMatch[1].trim(),
                    pages: pagesMatch ? parseInt(pagesMatch[1]) : 50
                };
            }
            throw new Error('Failed to extract required fields from response');
        }
    } catch (error) {
        console.error('[GeminiService] Gemini API Error:', error);
        console.warn('[GeminiService] Falling back to mock generation...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        const words = prompt.toLowerCase().split(' ');
        const firstWord = words[0] || 'adventure';
        const capitalizedWord = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

        return {
            title: `${capitalizedWord}'s Wonderful Journey`,
            description: `A spirited young ${firstWord} with bright, curious eyes and a warm smile. This character has a distinctive appearance with colorful details and an adventurous spirit that shines through their every movement.`,
            style: "Watercolor with soft, warm tones and gentle lighting",
            pages: 50
        };
    }
};

// ==================== Image Placeholder (no API call) ====================

export const generateImagePlaceholder = (keyword: string) => {
    return `https://source.unsplash.com/800x600/?${encodeURIComponent(keyword)},illustration`;
};

// ==================== Story Pages ====================

export const generateStoryPages = async (
    title: string,
    characters: Array<{ id: string; name: string; description: string; imageUrl?: string | null }>,
    style: string,
    pageCount: number = 50
) => {
    const charactersContext = characters.map(c => `${c.name}: ${c.description}`).join('\n');

    try {
        const text = await geminiGenerateSecure(
            `You are an award-winning children's picture book author.

Create a ${pageCount}-page story:
Title: "${title}"
Characters Presence:
${charactersContext}
Visual Style: "${style}"

📚 WRITING STYLE (CRITICAL):

1. SHORT LINES (1-2 sentences per page, MAX 3)
   ✓ "Snow fell softly, all through the night."
   ✓ "He knocked gently. Tap, tap, tap."

2. DIALOGUE (characters MUST speak with quotes)
   ✓ "My first delivery!" he chirped.
   ✓ "Thank you," the bear whispered.
   - Include dialogue on at least 40% of pages

3. SOUND EFFECTS & ONOMATOPOEIA
   ✓ "Tap, tap, tap."
   ✓ "Whoooosh went the wind."

4. EMOTIONAL MOMENTS
   ✓ "A tear rolled down his cheek. A happy tear."

5. STORY ARC:
   - Pages 1-${Math.ceil(pageCount * 0.15)}: Set the scene
   - Pages ${Math.ceil(pageCount * 0.15) + 1}-${Math.ceil(pageCount * 0.4)}: Quest begins
   - Pages ${Math.ceil(pageCount * 0.4) + 1}-${Math.ceil(pageCount * 0.7)}: Adventure
   - Pages ${Math.ceil(pageCount * 0.7) + 1}-${Math.ceil(pageCount * 0.85)}: Climax
   - Pages ${Math.ceil(pageCount * 0.85) + 1}-${pageCount}: Resolution

Generate EXACTLY ${pageCount} pages.
Return ONLY valid JSON (no markdown):
[{"pageNumber": 1, "text": "..."}, {"pageNumber": 2, "text": "..."}, ...]`,
            { temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 8192 }
        );

        // Parse JSON array from response
        let jsonStr = text.trim();
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        jsonStr = jsonStr.replace(/("\w+"\s*:\s*")([^"]*)"([^"]*)"([^"]*")(\s*[,\]}])/g, '$1$2\\"$3\\"$4$5');

        try {
            return JSON.parse(jsonStr);
        } catch (parseError) {
            console.error('[GeminiService] JSON parse failed:', parseError);
            const pageMatches = [...text.matchAll(/"pageNumber"\s*:\s*(\d+)\s*,\s*"text"\s*:\s*"([^"]+)"/g)];
            if (pageMatches.length > 0) {
                return pageMatches.map(match => ({
                    pageNumber: parseInt(match[1]),
                    text: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n')
                }));
            }
            throw parseError;
        }
    } catch (error) {
        console.error('[GeminiService] Error generating pages:', error);
        console.warn('[GeminiService] Falling back to mock pages...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return Array.from({ length: pageCount }, (_, i) => ({
            pageNumber: i + 1,
            text: `Page ${i + 1}: (This is a fallback page due to API issues.)`
        }));
    }
};

// ==================== Page Image (no API call) ====================

export const generatePageImage = (pageText: string, style: string): string => {
    const words = pageText.toLowerCase().split(' ');
    const keywords = words
        .filter(w => w.length > 4 && !['this', 'that', 'with', 'from', 'were', 'been'].includes(w))
        .slice(0, 3)
        .join(',');
    const styleKeyword = style.toLowerCase().replace(/[^a-z\s]/g, '').split(' ')[0] || 'illustration';
    return `https://source.unsplash.com/1920x1080/?${keywords},${styleKeyword},children,story`;
};

// ==================== Image Prompt Suggestion ====================

export const generateImagePromptSuggestion = async (
    pageText: string,
    style: string,
    characterDescription?: string
): Promise<string> => {
    try {
        const text = await geminiGenerateSecure(
            `You are an expert at creating image generation prompts for children's book illustrations.

PAGE TEXT: "${pageText}"
ART STYLE: ${style}
${characterDescription ? `MAIN CHARACTER: ${characterDescription}` : ''}

Create a detailed image generation prompt that:
1. Describes the VISUAL SCENE (what should be shown in the illustration)
2. Includes specific details about colors, lighting, mood
3. Describes character poses and expressions if characters are present
4. Maintains the ${style} art style
5. Is optimized for AI image generation

IMPORTANT:
- Focus on VISUAL elements, not the story text itself
- Be specific about composition (foreground, background)
- Include atmospheric details (time of day, weather, ambient effects)
- Keep it under 150 words

Return ONLY the prompt text, no explanations or formatting.`,
            { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 512 }
        );
        return text.trim();
    } catch (error) {
        console.error('[GeminiService] Error generating prompt suggestion:', error);
        return `A ${style} illustration for a children's book: ${pageText}. Warm and inviting atmosphere, child-friendly colors, detailed and expressive characters.`;
    }
};

// ==================== Refine Character Description ====================

export const refineCharacterDescription = async (
    charName: string,
    currentDescription: string,
    refinePrompt: string,
    artStyle: string
): Promise<string> => {
    try {
        const text = await geminiGenerateSecure(
            `You are a Master-Class Children's Story Writer and Lead Character Designer. Your task is to transform simple ideas into a reach, professional **CHARACTER PERSONA DOCUMENT**.

CHARACTER NAME: "${charName}"
EXISTING CONTEXT: "${currentDescription}"
NEW INSPIRATION/CHANGES: "${refinePrompt}"
ART STYLE AESTHETIC: "${artStyle}"

### WRITING MISSION:
Create a masterpiece of character description that feels like it was written by a professional laureate for a high-end picture book. 

### CRITICAL REQUIREMENTS:
1. **POETIC DEPTH**: Use high-level literary metaphors. Instead of "brave", describe "a heart hammered from the same silver as a winter star, unyielding and bright."
2. **SENSORY IMMERSION**: Describe the 'sculpture' of the character. How does their clothing feel? What scent follows them? (e.g., "The faint, comforting aroma of roasted chestnuts and damp earth.")
3. **ART STYLE HARMONY**: Mention visual elements that specifically reference the "${artStyle}" medium. (e.g., for Watercolor: "their edges are soft and dreamlike, as if they were born from a single, translucent drop of morning dew.")
4. **INNER SOUL**: Describe 1 secret fear and 1 hopeful wish they hold, and how these internal states manifest in their physical posture.
5. **LENGTH & STRUCTURE**: Write **EXEACTLY 2-3 detailed paragraphs**. Do NOT be brief. Be expansive, descriptive, and magical. (Target: 150-250 words).

### LANGUAGE RULE:
- If the USER'S INSPIRATION is in Korean, you MUST write the entire result in beautiful, literary Korean.
- If it is in English, use evocative, professional English prose.

### OUTPUT:
Return ONLY the description text. No titles, no labels, no "Here is your description". Pure, professional prose.`,
            { temperature: 0.8, maxOutputTokens: 1024 },
            [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
            ]
        );
        return text.trim();
    } catch (error) {
        console.error('[GeminiService] Error refining description:', error);
        return currentDescription + (refinePrompt ? " " + refinePrompt : "");
    }
};

// ==================== Continue Story ====================

export const continueStory = async (
    title: string,
    characters: Array<{ id: string; name: string; description: string; imageUrl?: string | null }>,
    style: string,
    previousPages: { pageNumber: number; text: string }[]
): Promise<string> => {
    const charactersContext = characters.map(c => `${c.name}: ${c.description}`).join('\n');
    const recentPagesContext = previousPages
        .slice(-5)
        .map(p => `Page ${p.pageNumber}: ${p.text}`)
        .join('\n');

    try {
        const text = await geminiGenerateSecure(
            `You are a world-class children's book author. Write the NEXT SINGLE PAGE for this story.
                        
STORY TITLE: "${title}"
VISUAL STYLE: "${style}"
CHARACTERS:
${charactersContext}

RECENT PAGES:
${recentPagesContext}

WRITING RULES:
1. MAX 3 SENTENCES. Be brief but magical.
2. Use dialogue if appropriate for the moment.
3. Advance the plot naturally from the previous page.
4. Maintain the consistent tone and style.

Return ONLY the text for the next page.`,
            { temperature: 0.8, maxOutputTokens: 256 }
        );
        return text.trim();
    } catch (error) {
        console.error('[GeminiService] Continue story error:', error);
        return "The magic continued in the next chapter...";
    }
};

// ==================== Translate Content ====================

export const translateContent = async (text: string, targetLanguage: string): Promise<string> => {
    try {
        let result = await geminiGenerateSecure(
            `You are a world-class children's book translator. Translate the following text into ${targetLanguage}.
                        
TEXT TO TRANSLATE: "${text}"

RULES:
1. Maintain a warm, poetic, and child-friendly tone appropriate for a picture book.
2. Use natural, evocative phrasing in the target language.
3. If the text is a title, make it a captivating title.
4. If the text is page content, keep the same emotion and rhythm.
5. Do NOT add any explanations or labels. Return ONLY the translated text.`,
            { temperature: 0.7, maxOutputTokens: 1024 }
        );

        // Clean up common LLM artifacts from translation
        const prefixesToRemove = [
            /^\*\*Translation:\*\*\s*/i,
            /^Translation:\s*/i,
            /^\*\*Translated:\*\*\s*/i,
            /^Translated:\s*/i,
            /^\[.*?\]\s*/,
        ];
        for (const regex of prefixesToRemove) {
            result = result.replace(regex, '');
        }
        if (result.includes('-->')) {
            result = result.split('-->').pop()?.trim() || result;
        } else if (result.includes('->')) {
            const parts = result.split('->');
            if (parts.length === 2) {
                result = parts[1].trim();
            }
        }
        return result;
    } catch (error) {
        console.error('[GeminiService] Translation error:', error);
        return text; // Return original on failure
    }
};

// ==================== Refine Story Text ====================

export const refineStoryText = async (
    title: string,
    currentText: string,
    refinePrompt: string,
    style: string
): Promise<string> => {
    try {
        const text = await geminiGenerateSecure(
            `You are a professional children's book editor. Refine the following page text based on the user's instructions.

STORY: "${title}"
VISUAL STYLE: "${style}"
CURRENT TEXT: "${currentText}"
USER INSTRUCTION: "${refinePrompt}"

RULES:
1. Keep it SHORT (max 3 sentences).
2. Use evocative, poetic language.
3. Follow the user's specific instruction precisely.
4. If instructed in Korean, respond in Korean. If in English, respond in English.

Return ONLY the refined text.`,
            { temperature: 0.7, maxOutputTokens: 512 }
        );
        return text.trim();
    } catch (error) {
        console.error('[GeminiService] Refine story text error:', error);
        return currentText;
    }
};

// ==================== Complete Story Generation (already uses CF) ====================

interface StoryVariables {
    childName: string;
    childAge: number;
    interests: string[];
    message: string;
    customMessage?: string;
    targetLanguage?: string;
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

type ProgressCallback = (pageNum: number, total: number, imageProgress?: boolean) => void;

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

export const generateCompleteStory = async (
    variables: StoryVariables,
    onProgress?: ProgressCallback
): Promise<GeneratedStory> => {
    const { generateStorySecure } = await import('./cloudFunctionsService');

    const estimatedPages = 12;
    const style = getArtStylePrompt(variables.artStyle);

    try {
        onProgress?.(0, estimatedPages);

        const story = await generateStorySecure({
            childName: variables.childName,
            childAge: variables.childAge,
            interests: variables.interests,
            message: variables.message,
            customMessage: variables.customMessage,
            targetLanguage: variables.targetLanguage || 'English',
            artStyle: variables.artStyle,
        }, onProgress);

        return story;
    } catch (error) {
        console.error('[GeminiService] Cloud Function error, falling back to mock:', error);

        const interestLabels = variables.interests.map(id => INTEREST_LABELS[id] || id);
        const messageLabel = variables.message === 'custom'
            ? variables.customMessage
            : MESSAGE_LABELS[variables.message] || variables.message;

        const mockPages = Array.from({ length: 10 }, (_, i) => ({
            pageNumber: i + 1,
            text: getMockPageText(variables.childName, interestLabels, messageLabel || '', i + 1),
            imageUrl: undefined
        }));

        return {
            title: `${variables.childName}의 마법 모험`,
            style,
            pages: mockPages
        };
    }
};

function getMockPageText(childName: string, interests: string[], message: string, pageNum: number): string {
    const mockTexts: Record<number, string> = {
        1: `어느 화창한 날, ${childName}이(가) 창밖을 바라보았어요.`,
        2: `"오늘은 특별한 모험을 떠나볼까?" ${childName}이(가) 생각했어요.`,
        3: `${childName}이(가) 밖으로 나가자, 반짝이는 ${interests[0] || '무언가'}가 나타났어요!`,
        4: `"와! 정말 신기하다!" ${childName}이(가) 눈을 크게 떴어요.`,
        5: `${childName}은(는) 용기를 내어 한 발자국 다가갔어요.`,
        6: `${interests[0] || '친구'}와 함께 신나는 여행을 시작했어요.`,
        7: `하지만 앞에 커다란 문제가 나타났어요!`,
        8: `${childName}은(는) 잠시 생각에 잠겼어요.`,
        9: `"내가 할 수 있어!" ${childName}이(가) 외쳤어요.`,
        10: `${childName}은(는) 문제를 멋지게 해결했어요!`,
        11: `모두가 ${childName}을(를) 응원했어요.`,
        12: `${message} - ${childName}은(는) 오늘 소중한 것을 배웠어요. 끝.`
    };
    return mockTexts[pageNum] || `${childName}의 이야기 ${pageNum}페이지입니다.`;
}

// ==================== Photo-based Story Generation (already uses CF) ====================

export const analyzePhoto = async (
    _photoFile: File,
    userDescription: string
): Promise<string> => {
    // Photo analysis is done server-side as part of generatePhotoBasedStory
    return userDescription;
};

export const generatePhotoBasedStory = async (
    variables: StoryVariables & { photoBase64?: string; photoMimeType?: string; photoDescription?: string },
    onProgress?: ProgressCallback
): Promise<GeneratedStory> => {
    const { generatePhotoStorySecure } = await import('./cloudFunctionsService');

    const estimatedPages = 12;
    const style = getArtStylePrompt(variables.artStyle);

    try {
        onProgress?.(0, estimatedPages);

        const story = await generatePhotoStorySecure({
            childName: variables.childName,
            childAge: variables.childAge,
            interests: variables.interests,
            message: variables.message,
            customMessage: variables.customMessage,
            targetLanguage: variables.targetLanguage || 'English',
            artStyle: variables.artStyle,
            photoBase64: variables.photoBase64,
            photoMimeType: variables.photoMimeType,
            photoDescription: variables.photoDescription,
        }, onProgress);

        return story;
    } catch (error) {
        console.error('[GeminiService] Cloud Function error, falling back to mock:', error);

        const mockPages = Array.from({ length: 10 }, (_, i) => ({
            pageNumber: i + 1,
            text: getMockPhotoStoryText(variables.childName, variables.photoDescription || '', i + 1),
            imageUrl: undefined
        }));

        return {
            title: `${variables.childName}의 특별한 하루`,
            style,
            pages: mockPages
        };
    }
};

function getMockPhotoStoryText(childName: string, photoDescription: string, pageNum: number): string {
    const context = photoDescription || '특별한 하루';
    const mockTexts: Record<number, string> = {
        1: `어느 특별한 날, ${childName}이(가) ${context}에서 신나는 하루를 보내고 있었어요.`,
        2: `"와! 정말 재미있다!" ${childName}이(가) 환하게 웃었어요.`,
        3: `그때 반짝이는 무언가가 ${childName}의 눈앞에 나타났어요!`,
        4: `"이건 뭐지?" ${childName}이(가) 조심스럽게 다가갔어요.`,
        5: `알고 보니 마법의 요정이 ${childName}을(를) 모험으로 초대하고 있었어요.`,
        6: `${childName}은(는) 용기를 내어 요정의 손을 잡았어요.`,
        7: `마법의 세계에서 신기한 것들을 많이 보았어요!`,
        8: `"우리 함께라면 무엇이든 할 수 있어!" 요정이 말했어요.`,
        9: `${childName}은(는) 새로운 친구들과 함께 즐거운 시간을 보냈어요.`,
        10: `모험이 끝나고, ${childName}은(는) 소중한 것을 깨달았어요.`,
        11: `"오늘 정말 행복했어!" ${childName}이(가) 말했어요.`,
        12: `${childName}은(는) 오늘의 특별한 추억을 마음속에 간직했어요. 끝. 💫`
    };
    return mockTexts[pageNum] || `${childName}의 이야기 ${pageNum}페이지입니다.`;
}

