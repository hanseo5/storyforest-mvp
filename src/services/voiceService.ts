import { db, storage, functions } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, getDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { deleteVoice as deleteElevenLabsVoice } from './elevenLabsService';
import type { SavedVoice } from '../types';

const VOICES_COLLECTION = 'voices';
const USER_SETTINGS_COLLECTION = 'userSettings';
const TEMP_SAMPLE_PATH = 'temp_voice_samples';

export interface GenerationStatus {
    status: 'idle' | 'processing' | 'complete' | 'error';
    progress?: number;
    lastGeneratedAt?: number;
}

// Upload sample and trigger audio generation
export const registerVoiceForGeneration = async (userId: string, name: string, audioBlob: Blob): Promise<string> => {
    try {
        // 1. Upload sample to Storage
        const fileRef = ref(storage, `${TEMP_SAMPLE_PATH}/${userId}/sample.webm`);
        await uploadBytes(fileRef, audioBlob);

        // 2. Call Cloud Function
        const registerVoice = httpsCallable(functions, 'registerVoice');
        const result = await registerVoice({
            userId,
            name,
            storagePath: fileRef.fullPath
        });

        return (result.data as { voiceId: string }).voiceId;

    } catch (error) {
        console.error('[VoiceService] Failed to register voice:', error);
        throw error;
    }
};

// Monitor generation status
export const subscribeToGenerationStatus = (userId: string, callback: (status: GenerationStatus) => void) => {
    return onSnapshot(doc(db, 'users', userId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            callback({
                status: data.generation_status || 'idle',
                lastGeneratedAt: data.last_generation_at?.toMillis()
            });
        } else {
            callback({ status: 'idle' });
        }
    });
};

/* Existing functions preserved below (might need deprecation or adjustment later) */


// Save a cloned voice to Firestore
export const saveVoice = async (userId: string, voiceId: string, name: string, sampleUrl?: string, sampleStoragePath?: string): Promise<void> => {
    const voiceDoc = doc(db, VOICES_COLLECTION, voiceId);
    const savedVoice: SavedVoice = {
        id: voiceId,
        name,
        createdAt: Date.now(),
        userId,
        ...(sampleUrl ? { sampleUrl } : {}),
        ...(sampleStoragePath ? { sampleStoragePath } : {})
    };
    await setDoc(voiceDoc, savedVoice);
};

// Get all saved voices for a user
export const getSavedVoices = async (userId: string): Promise<SavedVoice[]> => {
    const q = query(collection(db, VOICES_COLLECTION), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const voices: SavedVoice[] = [];
    snapshot.forEach((doc) => {
        voices.push(doc.data() as SavedVoice);
    });
    // Sort by createdAt descending (newest first)
    voices.sort((a, b) => b.createdAt - a.createdAt);
    return voices;
};

// Delete a saved voice (from Firestore AND ElevenLabs)
export const deleteUserVoice = async (voiceId: string): Promise<void> => {
    try {
        // Delete from ElevenLabs first
        await deleteElevenLabsVoice(voiceId);
    } catch (e) {
        console.warn('[VoiceService] Failed to delete from ElevenLabs (may already be deleted):', e);
    }
    // Then delete from Firestore
    await deleteDoc(doc(db, VOICES_COLLECTION, voiceId));
};

// Upload voice sample to permanent storage and return the storage path
export const uploadVoiceSample = async (userId: string, voiceId: string, audioBlob: Blob): Promise<string> => {
    const storagePath = `voice_samples/${userId}/${voiceId}/sample.webm`;
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, audioBlob);
    return storagePath;
};

// Get voice sample blob from permanent storage (for re-cloning)
export const getVoiceSampleBlob = async (storagePath: string): Promise<Blob> => {
    const { getDownloadURL } = await import('firebase/storage');
    const fileRef = ref(storage, storagePath);
    const url = await getDownloadURL(fileRef);
    const response = await fetch(url);
    return response.blob();
};

// Get saved voice by ID
export const getSavedVoiceById = async (voiceId: string): Promise<SavedVoice | null> => {
    const voiceDoc = doc(db, VOICES_COLLECTION, voiceId);
    const snapshot = await getDoc(voiceDoc);
    if (snapshot.exists()) {
        return snapshot.data() as SavedVoice;
    }
    return null;
};

// Re-clone voice from stored sample → returns temporary ElevenLabs voice ID
export const reCloneVoiceFromSample = async (savedVoice: SavedVoice): Promise<string> => {
    if (!savedVoice.sampleStoragePath) {
        throw new Error('No stored voice sample found for re-cloning');
    }
    const { addVoice } = await import('./elevenLabsService');
    const sampleBlob = await getVoiceSampleBlob(savedVoice.sampleStoragePath);
    const tempVoiceId = await addVoice(`temp_${savedVoice.name}_${Date.now()}`, sampleBlob);
    return tempVoiceId;
};

/**
 * Re-clone an expired voice and update all Firestore references.
 * Returns the new ElevenLabs voice ID, or null if re-clone is not possible.
 */
export const reCloneAndUpdateVoice = async (oldVoiceId: string, userId: string): Promise<string | null> => {
    try {
        const savedVoice = await getSavedVoiceById(oldVoiceId);
        if (!savedVoice?.sampleStoragePath) {
            console.warn('[VoiceService] Cannot re-clone: no stored sample for', oldVoiceId);
            return null;
        }

        console.log('[VoiceService] Re-cloning expired voice:', savedVoice.name);
        const newVoiceId = await reCloneVoiceFromSample(savedVoice);

        // Save new voice doc with same metadata
        await saveVoice(userId, newVoiceId, savedVoice.name, undefined, savedVoice.sampleStoragePath);

        // Update user's selected voice to new ID
        await setSelectedVoice(userId, newVoiceId);

        // Delete old Firestore voice doc (ElevenLabs voice already gone)
        try {
            await deleteDoc(doc(db, VOICES_COLLECTION, oldVoiceId));
        } catch {
            // Non-critical
        }

        console.log('[VoiceService] Re-clone successful. New voiceId:', newVoiceId);
        return newVoiceId;
    } catch (error) {
        console.error('[VoiceService] Re-clone failed:', error);
        return null;
    }
};

// Get user's selected voice ID (returns null for default voice)
export const getSelectedVoice = async (userId: string): Promise<string | null> => {
    const settingsDoc = doc(db, USER_SETTINGS_COLLECTION, userId);
    const snapshot = await getDoc(settingsDoc);
    if (snapshot.exists()) {
        return snapshot.data().selectedVoiceId || null;
    }
    return null;
};

// Set user's selected voice ID (null = default voice)
export const setSelectedVoice = async (userId: string, voiceId: string | null): Promise<void> => {
    const settingsDoc = doc(db, USER_SETTINGS_COLLECTION, userId);
    const snapshot = await getDoc(settingsDoc);
    if (snapshot.exists()) {
        await updateDoc(settingsDoc, { selectedVoiceId: voiceId });
    } else {
        await setDoc(settingsDoc, { selectedVoiceId: voiceId });
    }
};

/**
 * Queue background audio generation for a newly published book
 * if the user has a selected custom voice with stored sample.
 * Call this after publishBook/publishDraft.
 */
export const queueAudioForNewBook = async (userId: string, bookId: string): Promise<void> => {
    try {
        const selectedVoiceId = await getSelectedVoice(userId);
        if (!selectedVoiceId) return;

        const savedVoice = await getSavedVoiceById(selectedVoiceId);
        if (!savedVoice?.sampleStoragePath) return;

        const { useStore } = await import('../store');
        useStore.getState().addBackgroundTask({
            bookId,
            voiceId: selectedVoiceId,
            type: 'single-reclone',
            savedVoiceId: selectedVoiceId,
        });
    } catch {
        // Non-critical: audio gen failure shouldn't block publish
    }
};
