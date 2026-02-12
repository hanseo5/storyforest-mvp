/**
 * Cloud Functions Service
 * Calls Firebase Cloud Functions instead of direct API calls for security.
 */

import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { functions, db } from '../lib/firebase';

/**
 * Generic Gemini proxy — send any prompt securely through Cloud Functions.
 * The API key never leaves the server.
 */
export const geminiGenerateSecure = async (
    prompt: string,
    generationConfig?: { temperature?: number; topK?: number; topP?: number; maxOutputTokens?: number },
    safetySettings?: Array<{ category: string; threshold: string }>
): Promise<string> => {
    const fn = httpsCallable<
        { prompt: string; generationConfig?: object; safetySettings?: object[] },
        string
    >(functions, 'geminiGenerate', { timeout: 120000 });

    const result = await fn({ prompt, generationConfig, safetySettings });
    return result.data;
};

/**
 * Register admin login via secure Cloud Function.
 * Server verifies the user's email against a server-side admin list.
 */
export const registerAdminLoginSecure = async (): Promise<{ success: boolean; migratedBooks: number }> => {
    const fn = httpsCallable<void, { success: boolean; migratedBooks: number }>(
        functions,
        'registerAdminLogin',
        { timeout: 60000 }
    );
    const result = await fn();
    return result.data;
};


export interface StoryVariables {
    childName: string;
    childAge: number;
    interests: string[];
    message: string;
    customMessage?: string;
    targetLanguage: string;
    artStyle?: string;
    generationId?: string;
}

export interface PhotoStoryVariables extends StoryVariables {
    photoBase64?: string;
    photoMimeType?: string;
    photoDescription?: string;
}

// Key for persisting pending generation in localStorage
const PENDING_GENERATION_KEY = 'pendingStoryGeneration';

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
        const totalPages = result.data.pages?.length || 12;

        onProgress?.(totalPages, totalPages, true);

        return result.data;
    } catch (error: unknown) {
        console.error('[CloudFunctions] Error calling generateStory:', error);
        throw error;
    }
};

/**
 * Generate a photo-based story using the Cloud Function
 * Sends photo (base64) + description to server for Gemini Vision analysis + story generation.
 */
export const generatePhotoStorySecure = async (
    variables: PhotoStoryVariables,
    onProgress?: (current: number, total: number, isImage: boolean) => void
): Promise<GeneratedStory> => {

    const generatePhotoStoryFn = httpsCallable<PhotoStoryVariables, GeneratedStory>(
        functions,
        'generatePhotoStory',
        { timeout: 300000 }
    );

    try {
        onProgress?.(0, 12, false);

        const result = await generatePhotoStoryFn(variables);
        const totalPages = result.data.pages?.length || 12;

        onProgress?.(totalPages, totalPages, true);

        return result.data;
    } catch (error: unknown) {
        console.error('[CloudFunctions] Error calling generatePhotoStory:', error);
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

    const addVoiceFn = httpsCallable<
        { name: string; audioBase64: string; description?: string },
        string
    >(functions, 'addVoiceFunction');

    try {
        const result = await addVoiceFn({ name, audioBase64, description });
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

    const deleteVoiceFn = httpsCallable<{ voiceId: string }, void>(
        functions,
        'deleteVoiceFunction'
    );

    try {
        await deleteVoiceFn({ voiceId });
    } catch (error: unknown) {
        console.error('[CloudFunctions] Error calling deleteVoiceFunction:', error);
        throw error;
    }
};

// ==================== Background Story Generation ====================

/**
 * Generate a unique generation ID
 */
export const createGenerationId = (): string => {
    return `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Save pending generation info to localStorage
 * This allows the app to recover if the page is refreshed or comes back from background
 */
export const savePendingGeneration = (generationId: string, variables: StoryVariables) => {
    try {
        localStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify({
            generationId,
            variables,
            startedAt: Date.now(),
        }));
    } catch (e) {
        console.warn('[CloudFunctions] Failed to save pending generation:', e);
    }
};

/**
 * Get pending generation from localStorage (if any)
 */
export const getPendingGeneration = (): { generationId: string; variables: StoryVariables; startedAt: number } | null => {
    try {
        const raw = localStorage.getItem(PENDING_GENERATION_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        // Expire after 15 minutes
        if (Date.now() - data.startedAt > 15 * 60 * 1000) {
            localStorage.removeItem(PENDING_GENERATION_KEY);
            return null;
        }
        return data;
    } catch {
        return null;
    }
};

/**
 * Clear pending generation from localStorage
 */
export const clearPendingGeneration = () => {
    localStorage.removeItem(PENDING_GENERATION_KEY);
};

/**
 * Listen to Firestore for generation progress/completion.
 * Returns an unsubscribe function.
 */
export interface GenerationProgress {
    status: 'generating' | 'completed' | 'error';
    phase: 'text' | 'images' | 'complete';
    currentPage?: number;
    totalPages?: number;
    result?: GeneratedStory;
    error?: string;
}

export const listenToGeneration = (
    generationId: string,
    onUpdate: (progress: GenerationProgress) => void
): (() => void) => {
    const docRef = doc(db, 'story_generations', generationId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data() as GenerationProgress;
            onUpdate(data);
        }
    }, (error) => {
        console.error('[CloudFunctions] Firestore listener error:', error);
    });
    return unsubscribe;
};

/**
 * Clean up the generation document from Firestore
 */
export const cleanupGeneration = async (generationId: string) => {
    try {
        const docRef = doc(db, 'story_generations', generationId);
        await deleteDoc(docRef);
    } catch {
        // Ignore — user may not have delete permission (CF owns these docs)
    }
};
