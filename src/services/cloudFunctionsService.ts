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

    // Set timeout to 5 minutes (300000ms) for story generation which takes a long time
    const generateStoryFn = httpsCallable<StoryVariables, GeneratedStory>(
        functions,
        'generateStory',
        { timeout: 300000 }
    );

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

/**
 * Add a voice using the Cloud Function
 */
export const addVoiceSecure = async (
    name: string,
    audioBase64: string,
    description?: string
): Promise<string> => {
    console.log('[CloudFunctions] Calling addVoiceFunction...');

    const addVoiceFn = httpsCallable<
        { name: string; audioBase64: string; description?: string },
        string
    >(functions, 'addVoiceFunction');

    try {
        const result = await addVoiceFn({ name, audioBase64, description });
        console.log('[CloudFunctions] Voice added successfully:', result.data);
        return result.data;
    } catch (error: unknown) {
        console.error('[CloudFunctions] Error calling addVoiceFunction:', error);
        throw error;
    }
};

/**
 * Generate speech using the Cloud Function
 */
export const generateSpeechSecure = async (
    text: string,
    voiceId: string
): Promise<string> => {
    console.log('[CloudFunctions] Calling generateSpeechFunction...');

    const generateSpeechFn = httpsCallable<
        { text: string; voiceId: string },
        string
    >(functions, 'generateSpeechFunction');

    try {
        const result = await generateSpeechFn({ text, voiceId });
        // Result is base64 encoded audio
        return `data:audio/mpeg;base64,${result.data}`;
    } catch (error: unknown) {
        console.error('[CloudFunctions] Error calling generateSpeechFunction:', error);
        throw error;
    }
};

/**
 * Delete a voice using the Cloud Function
 */
export const deleteVoiceSecure = async (voiceId: string): Promise<void> => {
    console.log('[CloudFunctions] Calling deleteVoiceFunction...');

    const deleteVoiceFn = httpsCallable<{ voiceId: string }, void>(
        functions,
        'deleteVoiceFunction'
    );

    try {
        await deleteVoiceFn({ voiceId });
        console.log('[CloudFunctions] Voice deleted successfully');
    } catch (error: unknown) {
        console.error('[CloudFunctions] Error calling deleteVoiceFunction:', error);
        throw error;
    }
};
