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
        console.log('[VoiceService] Sample uploaded to storage');

        // 2. Call Cloud Function
        const registerVoice = httpsCallable(functions, 'registerVoice');
        const result = await registerVoice({
            userId,
            name,
            storagePath: fileRef.fullPath
        });

        console.log('[VoiceService] Function called successfully', result.data);
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
export const saveVoice = async (userId: string, voiceId: string, name: string, sampleUrl?: string): Promise<void> => {
    const voiceDoc = doc(db, VOICES_COLLECTION, voiceId);
    const savedVoice: SavedVoice = {
        id: voiceId,
        name,
        createdAt: Date.now(),
        userId,
        ...(sampleUrl ? { sampleUrl } : {})
    };
    await setDoc(voiceDoc, savedVoice);
    console.log('[VoiceService] Voice saved:', voiceId, name, sampleUrl ? '(with sample URL)' : '');
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
    console.log('[VoiceService] Loaded', voices.length, 'saved voices for user:', userId);
    return voices;
};

// Delete a saved voice (from Firestore AND ElevenLabs)
export const deleteUserVoice = async (voiceId: string): Promise<void> => {
    try {
        // Delete from ElevenLabs first
        await deleteElevenLabsVoice(voiceId);
        console.log('[VoiceService] Deleted from ElevenLabs:', voiceId);
    } catch (e) {
        console.warn('[VoiceService] Failed to delete from ElevenLabs (may already be deleted):', e);
    }
    // Then delete from Firestore
    await deleteDoc(doc(db, VOICES_COLLECTION, voiceId));
    console.log('[VoiceService] Deleted from Firestore:', voiceId);
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
    console.log('[VoiceService] Selected voice set to:', voiceId || 'default');
};
