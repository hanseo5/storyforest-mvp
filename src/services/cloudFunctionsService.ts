/**
 * Cloud Functions Service
 * Calls Firebase Cloud Functions instead of direct API calls for security.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';


export interface StoryVariables {
    childName: string;
    childAge: number;
    interests: string[];
    message: string;
    customMessage?: string;
    targetLanguage: string;
}

export interface GeneratedPage {
    pageNumber: number;
    text: string;
    imageUrl?: string;
}

export interface GeneratedStory {
    title: string;
    style: string;
    pages: GeneratedPage[];
}

/**
 * Generate a complete story using the Cloud Function
 * This is the secure way to call Gemini API - the API key is stored on the server.
 */
export const generateStorySecure = async (
    variables: StoryVariables,
    onProgress?: (current: number, total: number, isImage: boolean) => void
): Promise<GeneratedStory> => {
    console.log('[CloudFunctions] Calling generateStory function...');

    const generateStoryFn = httpsCallable<StoryVariables, GeneratedStory>(functions, 'generateStory');

    try {
        // Note: Progress callback won't work with Cloud Functions in real-time
        // The function will return all at once
        onProgress?.(0, 12, false);

        const result = await generateStoryFn(variables);

        console.log('[CloudFunctions] Story generated successfully:', result.data.title);
        onProgress?.(12, 12, true);

        return result.data;
    } catch (error: unknown) {
        console.error('[CloudFunctions] Error calling generateStory:', error);
        throw error;
    }
};

/**
 * Translate content using the Cloud Function
 */
export const translateContentSecure = async (
    text: string,
    targetLanguage: string
): Promise<string> => {
    console.log('[CloudFunctions] Calling translateContent function...');

    const translateFn = httpsCallable<{ text: string; targetLanguage: string }, string>(
        functions,
        'translateContent'
    );

    try {
        const result = await translateFn({ text, targetLanguage });
        return result.data;
    } catch (error: unknown) {
        console.error('[CloudFunctions] Error calling translateContent:', error);
        throw error;
    }
};
