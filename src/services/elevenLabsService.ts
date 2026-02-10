import { addVoiceSecure, generateSpeechSecure, deleteVoiceSecure } from './cloudFunctionsService';

// Voice IDs
export const VOICES = {
    RACHEL: '21m00Tcm4TlvDq8ikWAM',
    BELLA: 'EXAVITQu4vr4xnSDxMaL', // Soft, good for stories
    ADAM: 'pNInz6obpgDQGcFmaJgB',
    ANTONI: 'ErXwobaYiN019PkySvjV', // Warm, well-rounded (Good for Dad voice)
    BRIAN: 'nPczCjzI2devNBz1zQrb', // Deep, resonant and comforting
    NICOLE: 'piTKgcLEGmPE4e6mEKli', // Whispering, maybe good for bedtime
    MIMI: '1111', // Placeholder if needed
};

// Default to Brian for deep, resonant voice
export const generateSpeech = async (text: string, voiceId: string = VOICES.BRIAN): Promise<string> => {
    try {
        console.log('[ElevenLabs] Generating speech for:', text.substring(0, 20) + '...');
        return await generateSpeechSecure(text, voiceId);
    } catch (error) {
        console.error('[ElevenLabs] Error:', error);
        throw error;
    }
};

export const generateSpeechBlob = async (text: string, voiceId: string = VOICES.ANTONI): Promise<Blob> => {
    try {
        const base64Audio = await generateSpeechSecure(text, voiceId);
        // Extract base64 from data URL
        const base64Data = base64Audio.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new Blob([bytes], { type: 'audio/mpeg' });
    } catch (error) {
        console.error('[ElevenLabs] Error generating speech blob:', error);
        throw error;
    }
};

// Add Voice (Instant Clone) - Supports multiple audio samples for better quality
export const addVoice = async (name: string, audioBlobs: Blob | Blob[]): Promise<string> => {
    try {
        // Convert first blob to base64
        const blobs = Array.isArray(audioBlobs) ? audioBlobs : [audioBlobs];
        const firstBlob = blobs[0];
        
        const arrayBuffer = await firstBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
        }
        const audioBase64 = btoa(binaryString);

        return await addVoiceSecure(name, audioBase64, 'Storyforest Voice Clone');
    } catch (error) {
        console.error('[ElevenLabs] Error adding voice:', error);
        throw error;
    }
};

// Delete Voice
export const deleteVoice = async (voiceId: string): Promise<void> => {
    try {
        await deleteVoiceSecure(voiceId);
    } catch (error) {
        console.error('[ElevenLabs] Error deleting voice:', error);
        throw error;
    }
};
