
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";


export const generateStoryMetadata = async (prompt: string) => {
    // Mock simulation if no API key
    if (!API_KEY) {
        console.warn("[GeminiService] No API key found, using enhanced mock response");
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract key concepts from prompt for better mock data
        const words = prompt.toLowerCase().split(' ');
        const firstWord = words[0] || 'adventure';

        const capitalizedWord = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

        return {
            title: `The ${capitalizedWord}'s Magical Journey`,
            description: `A brave young ${firstWord} with sparkling eyes and a curious heart, wearing a cozy scarf that changes colors with emotions.`,
            characters: [
                {
                    id: '1',
                    name: `Little ${capitalizedWord}`,
                    description: `A brave young ${firstWord} with sparkling eyes and a curious heart, wearing a cozy scarf that changes colors with emotions. This character is small but mighty, full of wonder and determination.`,
                    imageUrl: null
                },
                {
                    id: '2',
                    name: 'Luna',
                    description: 'A wise old owl with silver feathers and glowing yellow eyes who guides the way through the forest.',
                    imageUrl: null
                }
            ],
            style: "Soft watercolor with gentle pastel tones and dreamy lighting",
            pages: 50
        };
    }

    try {
        console.log('[GeminiService] Starting API call with prompt:', prompt);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are a world-class children's picture book author and character designer. Create a poetic and deeply evocative story concept based on: "${prompt}"

TITLE (3-7 words, captivating and poetic)

CHARACTER DESCRIPTION (6-8 sentences, professional author quality):
- Give them a soul: Describe their core hope, fear, or a quirky habit.
- Physical poetry: Use metaphors for their appearance (e.g., "eyes like rain-washed pebbles", "fur as soft as a forgotten cloud").
- Sensory richness: Mention the scent they carry (pine needles, old books, cinnamon) or the sound of their movement (soft rustle of silk, rhythmic clink of tiny keys).
- Visual Style Integration: Ensure the description explicitly mentions details fitting for a "${prompt}" universe.
- Emotional expression: How does their heart show on their sleeve?

RETURN ONLY THIS JSON (one line, properly escaped):
{"title": "Story Title", "description": "Professional poetic description", "style": "Chosen Style", "pages": 50}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });

        console.log('[GeminiService] Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[GeminiService] HTTP error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[GeminiService] Full API response:', JSON.stringify(data, null, 2));

        if (!data.candidates || data.candidates.length === 0) {
            console.error('[GeminiService] No candidates in response');
            throw new Error("No candidates returned from Gemini");
        }

        const text = data.candidates[0].content.parts[0].text;
        console.log('[GeminiService] Gemini Raw Response:', text);

        // Flexible field extraction instead of strict JSON parsing
        // This handles cases where Gemini doesn't return perfect JSON

        try {
            // First try: Standard JSON parse
            let jsonStr = text.trim();
            jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }

            const parsedData = JSON.parse(jsonStr);
            console.log('[GeminiService] Successfully parsed metadata via JSON:', parsedData);
            return parsedData;
        } catch (jsonError) {
            console.warn('[GeminiService] JSON parse failed, using field extraction...', jsonError);

            // Fallback: Extract fields individually using more flexible regex
            const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/i) ||
                text.match(/["']title["']\s*:\s*["']([^"']+)["']/i);

            const styleMatch = text.match(/"style"\s*:\s*"([^"]+)"/i) ||
                text.match(/["']style["']\s*:\s*["']([^"']+)["']/i);

            const pagesMatch = text.match(/"pages"\s*:\s*(\d+)/i);

            if (titleMatch && styleMatch) {
                const extracted = {
                    title: titleMatch[1].trim(),
                    description: '',
                    characters: [] as Array<{ id: string; name: string; description: string; imageUrl?: string | null }>,
                    style: styleMatch[1].trim(),
                    pages: pagesMatch ? parseInt(pagesMatch[1]) : 50
                };

                console.log('[GeminiService] Successfully extracted metadata via regex:', extracted);
                return extracted;
            }

            console.error('[GeminiService] Field extraction failed');
            throw new Error('Failed to extract required fields from response');
        }
    } catch (error) {
        console.error('[GeminiService] Gemini API Error:', error);
        console.warn('[GeminiService] Falling back to enhanced mock generation...');

        // Enhanced Fallback Mock Data
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Extract key concepts from prompt
        const words = prompt.toLowerCase().split(' ');
        const firstWord = words[0] || 'adventure';
        const capitalizedWord = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);

        const fallbackData = {
            title: `${capitalizedWord}'s Wonderful Journey`,
            description: `A spirited young ${firstWord} with bright, curious eyes and a warm smile. This character has a distinctive appearance with colorful details and an adventurous spirit that shines through their every movement.`,
            style: "Watercolor with soft, warm tones and gentle lighting",
            pages: 50
        };
        console.log('[GeminiService] Returning enhanced fallback data:', fallbackData);
        return fallbackData;
    }
};

export const generateImagePlaceholder = (keyword: string) => {
    return `https://source.unsplash.com/800x600/?${encodeURIComponent(keyword)},illustration`;
}

export const generateStoryPages = async (title: string, characters: Array<{ id: string; name: string; description: string; imageUrl?: string | null }>, style: string, pageCount: number = 50) => {
    console.log('[GeminiService] Generating story pages...', { title, pageCount });

    const charactersContext = characters.map(c => `${c.name}: ${c.description}`).join('\n');

    // Mock simulation if no API key
    if (!API_KEY) {
        console.warn('[GeminiService] Using mock pages response');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return Array.from({ length: pageCount }, (_, i) => ({
            pageNumber: i + 1,
            text: `This is page ${i + 1} of the story "${title}".`
        }));
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are an award-winning children's picture book author.

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
[{"pageNumber": 1, "text": "..."}, {"pageNumber": 2, "text": "..."}, ...]`
                    }]
                }],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });

        console.log('[GeminiService] Pages response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[GeminiService] HTTP error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[GeminiService] Pages API response received');

        if (!data.candidates || data.candidates.length === 0) {
            console.error('[GeminiService] No candidates in pages response');
            throw new Error("No candidates returned from Gemini");
        }

        const text = data.candidates[0].content.parts[0].text;
        console.log('[GeminiService] Pages raw response length:', text.length);
        console.log('[GeminiService] Pages raw response preview:', text.substring(0, 500));

        // Robust JSON extraction for pages array
        let jsonStr = text.trim();

        // Remove markdown code blocks if present
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

        // Extract JSON array
        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        // Clean up common issues
        // Fix unescaped quotes in text values
        jsonStr = jsonStr.replace(/("\w+"\s*:\s*")([^"]*)"([^"]*)"([^"]*")(\s*[,\]}])/g, '$1$2\\"$3\\"$4$5');

        console.log('[GeminiService] Cleaned JSON preview:', jsonStr.substring(0, 500));

        try {
            const pages = JSON.parse(jsonStr);
            console.log('[GeminiService] Successfully parsed pages:', pages.length);
            return pages;
        } catch (error) {
            const parseError = error as Error;
            console.error('[GeminiService] JSON parse failed:', parseError);
            console.error('[GeminiService] Failed at position:', parseError.message);

            // Fallback: Try to extract pages using regex
            const pageMatches = [...text.matchAll(/"pageNumber"\s*:\s*(\d+)\s*,\s*"text"\s*:\s*"([^"]+)"/g)];
            if (pageMatches.length > 0) {
                const extractedPages = pageMatches.map(match => ({
                    pageNumber: parseInt(match[1]),
                    text: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n')
                }));
                console.log('[GeminiService] Extracted pages via regex:', extractedPages.length);
                return extractedPages;
            }

            throw parseError;
        }
    } catch (error) {
        console.error('[GeminiService] Error generating pages:', error);
        console.warn('[GeminiService] Falling back to mock pages...');

        // Fallback mock pages
        await new Promise(resolve => setTimeout(resolve, 1000));
        return Array.from({ length: pageCount }, (_, i) => ({
            pageNumber: i + 1,
            text: `Page ${i + 1}: (This is a fallback page due to API issues.)`
        }));
    }
};

export const generatePageImage = (pageText: string, style: string): string => {
    // Extract keywords from page text
    const words = pageText.toLowerCase().split(' ');
    const keywords = words
        .filter(w => w.length > 4 && !['this', 'that', 'with', 'from', 'were', 'been'].includes(w))
        .slice(0, 3)
        .join(',');

    const styleKeyword = style.toLowerCase().replace(/[^a-z\s]/g, '').split(' ')[0] || 'illustration';

    return `https://source.unsplash.com/1920x1080/?${keywords},${styleKeyword},children,story`;
};

export const generateImagePromptSuggestion = async (
    pageText: string,
    style: string,
    characterDescription?: string
): Promise<string> => {
    console.log('[GeminiService] Generating image prompt suggestion for:', pageText.substring(0, 50));

    // Mock simulation if no API key
    if (!API_KEY) {
        console.warn('[GeminiService] No API key, returning enhanced page text');
        await new Promise(resolve => setTimeout(resolve, 500));
        return `A children's book illustration in ${style} style: ${pageText}. Warm colors, child-friendly, detailed scene.`;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are an expert at creating image generation prompts for children's book illustrations.

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

Return ONLY the prompt text, no explanations or formatting.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 512,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("No candidates returned from Gemini");
        }

        const suggestedPrompt = data.candidates[0].content.parts[0].text.trim();
        console.log('[GeminiService] Generated prompt suggestion:', suggestedPrompt.substring(0, 100));

        return suggestedPrompt;
    } catch (error) {
        console.error('[GeminiService] Error generating prompt suggestion:', error);
        // Fallback: return enhanced page text
        return `A ${style} illustration for a children's book: ${pageText}. Warm and inviting atmosphere, child-friendly colors, detailed and expressive characters.`;
    }
};

export const refineCharacterDescription = async (
    charName: string,
    currentDescription: string,
    refinePrompt: string,
    artStyle: string
): Promise<string> => {
    console.log('[GeminiService] Refining character description...', { charName, refinePrompt });

    if (!API_KEY) {
        console.warn('[GeminiService] No API key, returning mock refinement');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return `[REFINED] ${charName} is now even more magical! ${currentDescription} ${refinePrompt}. They have a sparkling aura and mysterious charm.`;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are a Master-Class Children's Story Writer and Lead Character Designer. Your task is to transform simple ideas into a reach, professional **CHARACTER PERSONA DOCUMENT**.

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
Return ONLY the description text. No titles, no labels, no "Here is your description". Pure, professional prose.`
                    }]
                }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 1024,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                ]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error('[GeminiService] Error response body:', errorBody);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            console.error('[GeminiService] API returned error:', data.error);
            throw new Error(data.error.message);
        }

        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
            console.warn('[GeminiService] No content candidates returned. Safety filter might have triggered.');
            throw new Error("No candidates returned from Gemini");
        }

        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error('[GeminiService] Error refining description:', error);
        return currentDescription + (refinePrompt ? " " + refinePrompt : "");
    }
};
export const continueStory = async (
    title: string,
    characters: Array<{ id: string; name: string; description: string; imageUrl?: string | null }>,
    style: string,
    previousPages: { pageNumber: number; text: string }[]
): Promise<string> => {
    console.log('[GeminiService] Continuing story...', { title, previousCount: previousPages.length });

    if (!API_KEY) {
        console.warn('[GeminiService] No API key, returning mock continuation');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return `As the adventure continued, something unexpected happened... (Mock continuation for ${title})`;
    }

    const charactersContext = characters.map(c => `${c.name}: ${c.description}`).join('\n');
    const recentPagesContext = previousPages
        .slice(-5)
        .map(p => `Page ${p.pageNumber}: ${p.text}`)
        .join('\n');

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are a world-class children's book author. Write the NEXT SINGLE PAGE for this story.
                        
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

Return ONLY the text for the next page.`
                    }]
                }],
                generationConfig: { temperature: 0.8, maxOutputTokens: 256 }
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error('[GeminiService] Continue story error:', error);
        return "The magic continued in the next chapter...";
    }
};

/**
 * Translate story content (title, description, or page text)
 * Maintains the poetic and child-friendly tone.
 */
export const translateContent = async (text: string, targetLanguage: string): Promise<string> => {
    console.log(`[GeminiService] Translating content to ${targetLanguage}:`, text.substring(0, 50));

    if (!API_KEY) {
        console.warn('[GeminiService] No API key, returning mock translation');
        await new Promise(resolve => setTimeout(resolve, 800));
        return `[${targetLanguage}] ${text}`;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are a world-class children's book translator. Translate the following text into ${targetLanguage}.
                        
TEXT TO TRANSLATE: "${text}"

RULES:
1. Maintain a warm, poetic, and child-friendly tone appropriate for a picture book.
2. Use natural, evocative phrasing in the target language.
3. If the text is a title, make it a captivating title.
4. If the text is page content, keep the same emotion and rhythm.
5. Do NOT add any explanations or labels. Return ONLY the translated text.`
                    }]
                }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error("No translation candidates returned");
        }

        let result = data.candidates[0].content.parts[0].text.trim();

        // 1. Remove Markdown Bold/Italic wrappers often used by LLMs
        // e.g. "**Translation:** ..." -> "Translation: ..."
        // We do this first so the prefix matching below works cleanly

        // 2. Remove common prefixes
        const prefixesToRemove = [
            /^\*\*Translation:\*\*\s*/i,
            /^Translation:\s*/i,
            /^\*\*Translated:\*\*\s*/i,
            /^Translated:\s*/i,
            /^\[.*?\]\s*/, // [Korean], [English] tags
        ];

        for (const regex of prefixesToRemove) {
            result = result.replace(regex, '');
        }

        // 3. Handle "Original -> Translated" pattern
        // Sometimes Gemini returns "original text --> translated text"
        if (result.includes('-->')) {
            result = result.split('-->').pop()?.trim() || result;
        } else if (result.includes('->')) {
            // Be careful with simple arrows, only strictly if it looks like a separator
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

export const refineStoryText = async (
    title: string,
    currentText: string,
    refinePrompt: string,
    style: string
): Promise<string> => {
    console.log('[GeminiService] Refining story text...', { title, refinePrompt });

    if (!API_KEY) {
        console.warn('[GeminiService] No API key, returning mock refinement');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return `[REFINED] ${currentText} ${refinePrompt} (A more magical version)`;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are a professional children's book editor. Refine the following page text based on the user's instructions.

STORY: "${title}"
VISUAL STYLE: "${style}"
CURRENT TEXT: "${currentText}"
USER INSTRUCTION: "${refinePrompt}"

RULES:
1. Keep it SHORT (max 3 sentences).
2. Use evocative, poetic language.
3. Follow the user's specific instruction precisely.
4. If instructed in Korean, respond in Korean. If in English, respond in English.

Return ONLY the refined text.`
                    }]
                }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error('[GeminiService] Refine story text error:', error);
        return currentText;
    }
};

// ==================== NEW: Complete Story Generation ====================

interface StoryVariables {
    childName: string;
    childAge: number;
    interests: string[];
    message: string;
    customMessage?: string;
    targetLanguage?: string;
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

// Interest emoji mapping for story generation
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

// Message label mapping
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
    console.log('[GeminiService] Generating complete story via Cloud Function for:', variables.childName);

    // Import Cloud Functions service
    const { generateStorySecure } = await import('./cloudFunctionsService');

    const pageCount = 12;
    const style = 'Soft Watercolor with warm pastel tones';

    try {
        onProgress?.(0, pageCount);

        // Call Cloud Function (API key is securely stored on server)
        const story = await generateStorySecure({
            childName: variables.childName,
            childAge: variables.childAge,
            interests: variables.interests,
            message: variables.message,
            customMessage: variables.customMessage,
            targetLanguage: variables.targetLanguage || 'English'
        }, onProgress);

        console.log('[GeminiService] Story generated via Cloud Function:', story.title);
        return story;
    } catch (error) {
        console.error('[GeminiService] Cloud Function error, falling back to mock:', error);

        // Fallback to mock data if Cloud Function fails
        const interestLabels = variables.interests.map(id => INTEREST_LABELS[id] || id);
        const messageLabel = variables.message === 'custom'
            ? variables.customMessage
            : MESSAGE_LABELS[variables.message] || variables.message;

        const mockPages = Array.from({ length: pageCount }, (_, i) => ({
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
}

// Helper function for mock story generation
function getMockPageText(
    childName: string,
    interests: string[],
    message: string,
    pageNum: number
): string {
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

