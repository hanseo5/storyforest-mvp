import type { Book } from '../types';

// For mobile (Capacitor), we would use '@capacitor/filesystem' here later.
// For now (Web/MVP), we'll store Blobs in memory or IndexedDB.
// To keep it simple and fast for the MVP, we will use a global Map for in-memory caching.
// Note: In a real mobile app, this service would abstract the Filesystem logic.

const audioCache = new Map<string, string>(); // Key: "bookId_pageNumber_voiceId_lang", Value: Blob URL

export interface PreloadProgress {
    total: number;
    loaded: number;
    currentBookId?: string;
}

/**
 * Clean cache for a specific book or all
 */
export const clearAudioCache = (bookId?: string) => {
    if (bookId) {
        for (const key of audioCache.keys()) {
            if (key.startsWith(bookId)) {
                audioCache.delete(key);
            }
        }
    } else {
        audioCache.clear();
    }
};

/**
 * Preload all audio for a given book, language, and voice.
 * Returning true if successful.
 */
export const preloadBookAudio = async (
    book: Book & { pages: Array<{ pageNumber: number; text: string; imageUrl: string }> },
    language: string,
    voiceId?: string,
    onProgress?: (progress: PreloadProgress) => void
): Promise<void> => {
    // Logic matches 'playAudio' in BookReader:
    const effectiveVoiceKey = determineVoiceKey(book, language, voiceId);

    let loadedCount = 0;
    const totalPages = book.pages.length;
    const customAudioMap: Map<number, string> = new Map();

    // If custom voice, fetch paths from Firestore first
    if (voiceId && voiceId.length > 10) { // Simple check for custom voice ID (assuming generated IDs are long)
        try {
            const { auth, db, storage } = await import('../lib/firebase');
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const { ref, getDownloadURL } = await import('firebase/storage');

            if (auth.currentUser) {
                const q = query(
                    collection(db, 'user_audio_files'),
                    where('userId', '==', auth.currentUser.uid),
                    where('bookId', '==', book.id)
                );
                const snapshot = await getDocs(q);

                // Create parallel download tasks
                const urlPromises = snapshot.docs.map(async (doc) => {
                    const data = doc.data();
                    try {
                        const url = await getDownloadURL(ref(storage, data.storagePath));
                        return { pageNumber: data.pageNumber, url };
                    } catch {
                        console.warn('Failed to get download URL for custom audio:', data.storagePath);
                        return null;
                    }
                });

                const results = await Promise.all(urlPromises);
                results.forEach(res => {
                    if (res) customAudioMap.set(res.pageNumber, res.url);
                });
            }
        } catch (e) {
            console.error('[AudioPreloadService] Error fetching custom audio metadata:', e);
        }
    }

    const promises = book.pages.map(async (page) => {
        const cacheKey = `${book.id}_${page.pageNumber}_${effectiveVoiceKey}`;

        // 1. Check if already in RAM cache
        if (audioCache.has(cacheKey)) {
            loadedCount++;
            onProgress?.({ total: totalPages, loaded: loadedCount, currentBookId: book.id });
            return;
        }

        // 2. Get URL
        let remoteUrl: string | undefined;

        // Priority: Custom Audio -> Page Audio Urls -> Default
        if (customAudioMap.has(page.pageNumber)) {
            remoteUrl = customAudioMap.get(page.pageNumber);
        } else {
            remoteUrl = page.audioUrls?.[effectiveVoiceKey] || (effectiveVoiceKey === 'default' ? page.audioUrl : undefined);
        }

        if (!remoteUrl) {
            // If custom voice was requested but not found, fallback to default? 
            // Or just warn. For now warn.
            console.warn(`[AudioPreloadService] No audio URL found for Page ${page.pageNumber}, Key: ${effectiveVoiceKey}`);
            return;
        }

        try {
            // 3. Fetch Blob
            const response = await fetch(remoteUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            // 4. Save to Cache
            audioCache.set(cacheKey, blobUrl);

            loadedCount++;
            onProgress?.({ total: totalPages, loaded: loadedCount, currentBookId: book.id });
        } catch (err) {
            console.error(`[AudioPreloadService] Failed to download audio for Page ${page.pageNumber}:`, err);
        }
    });

    await Promise.all(promises);
};

/**
 * Get preloaded audio URL (Blob URL) if available
 */
export const getPreloadedAudio = (bookId: string, pageNumber: number, voiceKey: string): string | undefined => {
    return audioCache.get(`${bookId}_${pageNumber}_${voiceKey}`);
};

import { detectLanguage } from '../utils/textUtils';

// Helper: Determine the exact key used in Firestore 'audioUrls' map
export const determineVoiceKey = (book: Book, targetLanguage: string, selectedVoiceId?: string): string => {
    if (selectedVoiceId) return selectedVoiceId; // Custom user voice

    const originalLang = book.originalLanguage || 'English';
    const detectedLang = detectLanguage(book.title) || originalLang;

    // If target language is different from original (detected), we look for 'default_TargetLanguage'
    if (targetLanguage && targetLanguage !== detectedLang) {
        return `default_${targetLanguage}`;
    }

    return 'default';
};
