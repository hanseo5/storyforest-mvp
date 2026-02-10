import type { Character } from '../types/draft';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

interface ReferenceImages {
    characters?: Character[];   // New: support for multiple characters
    protagonistImage?: string;  // Maintain for compatibility
    previousPageImage?: string; // For scene continuity (rolling)
    styleImage?: string;        // Specific artistic style reference image
}

interface StoryContext {
    title: string;              // Story title for overall context
    characterName: string;      // Main character NAME (fallback)
    previousTexts: string[];    // Previous 2-3 pages of text for narrative flow
    pageNumber: number;         // Current page number
    totalPages: number;         // Total pages in the story
}

export const generateImage = async (
    prompt: string,
    style: string,
    references?: ReferenceImages,
    context?: StoryContext
): Promise<string> => {
    const characterCount = references?.characters?.length || (references?.protagonistImage ? 1 : 0);
    const hasPreviousPage = !!references?.previousPageImage;
    const hasStyleImage = !!references?.styleImage;
    const hasContext = !!context;

    console.log('[ImageService] Generating image...', {
        prompt: prompt.substring(0, 50),
        style,
        characterCount,
        hasPreviousPage,
        hasContext
    });

    if (!API_KEY) {
        console.warn('[ImageService] No API key, returning placeholder');
        return `https://source.unsplash.com/1920x1080/?${encodeURIComponent(prompt)},${style}`;
    }

    try {
        // Build context section if available
        let contextInfo = '';
        if (context) {
            const prevTextsStr = context.previousTexts.length > 0
                ? `\nPREVIOUS PAGES:\n${context.previousTexts.map((t, i) => `  Page ${context.pageNumber - context.previousTexts.length + i}: "${t}"`).join('\n')}`
                : '';

            contextInfo = `
📖 STORY CONTEXT:
Title: "${context.title}"
Current Page: ${context.pageNumber} of ${context.totalPages}
${prevTextsStr}
`;
        }

        const characterInstructions = references?.characters && references.characters.length > 0
            ? references.characters.map((c, i) => `- Image ${i + 1}: Reference for character "${c.name}"`).join('\n')
            : (references?.protagonistImage ? `- Image 1: Reference for main character "${context?.characterName || 'protagonist'}"` : '');

        const promptParts: Array<{ text: string }> = [{
            text: `You are a film director creating storyboard frame ${context?.pageNumber || '?'} for a children's picture book.

Art style: ${style}.
${contextInfo}
🎬 CURRENT SCENE: "${prompt}"

⚠️ CHARACTER & STYLE REFERENCES:
${characterInstructions}
${hasPreviousPage ? `- Image ${characterCount + 1}: Reference for scene continuity` : ''}
${hasStyleImage ? `- Image ${characterCount + (hasPreviousPage ? 2 : 1)}: Reference for Artistic Style & Aesthetic` : ''}

⚠️ MOST IMPORTANT RULE:
- Follow the scene text EXACTLY. 
- If a character is mentioned by name, use their specific reference image.
- If a character is NOT mentioned, do NOT include them.
- If no characters are mentioned, focus only on environment and atmosphere.

INSTRUCTIONS:
1. UNDERSTAND THE NARRATIVE: Use the story context to understand what's happening
2. VISUALIZE THIS MOMENT: Create an illustration for THIS specific scene text
3. Consistency: Ensure character and environment consistency using the provided images.
4. Emotional tone: Match the emotional content of the scene.
5. Composition: Create a unique composition that advances the visual story without text.`
        }];

        // Add character images (Image 1, 2, ...)
        if (references?.characters && references.characters.length > 0) {
            references.characters.forEach((char, i) => {
                if (char.imageUrl?.startsWith('data:image')) {
                    console.log(`[ImageService] Attaching reference for ${char.name} (Image ${i + 1})`);
                    const base64Data = char.imageUrl.split(',')[1];
                    const mimeType = char.imageUrl.split(';')[0].split(':')[1];
                    promptParts.push({
                        inlineData: { mimeType, data: base64Data }
                    });
                }
            });
        } else if (references?.protagonistImage?.startsWith('data:image')) {
            console.log('[ImageService] Attaching protagonist reference (Image 1)');
            const base64Data = references.protagonistImage.split(',')[1];
            const mimeType = references.protagonistImage.split(';')[0].split(':')[1];
            promptParts.push({
                inlineData: { mimeType, data: base64Data }
            });
        }

        // Add previous page image for scene continuity
        if (references?.previousPageImage?.startsWith('data:image')) {
            console.log(`[ImageService] Attaching previous page reference (Image ${characterCount + 1})`);
            const base64Data = references.previousPageImage.split(',')[1];
            const mimeType = references.previousPageImage.split(';')[0].split(':')[1];
            promptParts.push({
                inlineData: { mimeType, data: base64Data }
            });
        }

        // Add custom style image for aesthetic reference
        if (references?.styleImage?.startsWith('data:image')) {
            console.log(`[ImageService] Attaching style reference image`);
            const base64Data = references.styleImage.split(',')[1];
            const mimeType = references.styleImage.split(';')[0].split(':')[1];
            promptParts.push({
                inlineData: { mimeType, data: base64Data }
            });
        }

        const requestBody: {
            contents: Array<{ parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> }>;
            generationConfig: { temperature: number; topK: number; topP: number };
        } = {
            contents: [{
                parts: promptParts
            }],
            generationConfig: {
                temperature: 1.0,  // Higher for more creative variety
                topK: 64,          // More options to choose from
                topP: 0.98,        // Wider probability distribution
            }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ImageService] HTTP error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (candidate.content?.parts?.[0]?.inlineData) {
                const imageData = candidate.content.parts[0].inlineData;
                const base64Image = `data:${imageData.mimeType};base64,${imageData.data}`;
                return base64Image;
            }
        }

        throw new Error('No image data in response');

    } catch (error) {
        console.error('[ImageService] Error generating image:', error);
        return `https://source.unsplash.com/1920x1080/?${encodeURIComponent(prompt)},${style},illustration`;
    }
};

export const uploadImage = async (file: File): Promise<string> => {
    return URL.createObjectURL(file);
};

export const ensureImageUrl = async (
    imageData: string | null | undefined,
    path: string
): Promise<string | null> => {
    if (!imageData) return null;
    if (!imageData.startsWith('data:image')) return imageData; // Already a URL (probably)

    console.log(`[ImageService] Base64 detected, uploading to Storage: ${path}`);
    return await uploadBase64ToStorage(imageData, path);
};

export const uploadBase64ToStorage = async (
    base64Data: string,
    path: string
): Promise<string> => {
    try {
        const { storage } = await import('../lib/firebase');
        const { ref, uploadString, getDownloadURL } = await import('firebase/storage');

        // Ensure path doesn't start with / for Firebase Storage
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const storageRef = ref(storage, cleanPath);

        console.log(`[ImageService] Uploading base64 to: ${cleanPath}`);
        await uploadString(storageRef, base64Data, 'data_url');
        const url = await getDownloadURL(storageRef);
        console.log(`[ImageService] Upload complete: ${url}`);
        return url;
    } catch (error) {
        console.error('[ImageService] Error uploading to Storage:', error);
        // Fallback to compressed base64 if upload fails, but this might still hit Firestore limits
        return await compressBase64Image(base64Data, 0.5, 800);
    }
};

export const compressBase64Image = (
    base64Data: string,
    quality: number = 0.6,
    maxWidth: number = 800
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = base64Data;
    });
};
