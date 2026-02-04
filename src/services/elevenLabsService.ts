const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';

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
    if (!API_KEY) {
        console.warn('[ElevenLabs] API Key is missing');
        throw new Error('ElevenLabs API Key is missing. Please check your .env file.');
    }

    try {
        console.log('[ElevenLabs] Generating speech for:', text.substring(0, 20) + '...');
        const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': API_KEY,
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2', // Better for Korean and other languages
                voice_settings: {
                    stability: 0.55, // Slightly more stable for deep voice
                    similarity_boost: 0.8,
                    style: 0.2, // Subtle emotion
                    use_speaker_boost: true
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: { message: response.statusText } }));
            throw new Error(errorData.detail?.message || 'Failed to generate speech');
        }

        const audioBlob = await response.blob();
        return URL.createObjectURL(audioBlob);

    } catch (error) {
        console.error('[ElevenLabs] Error:', error);
        throw error;
    }
};

export const generateSpeechBlob = async (text: string, voiceId: string = VOICES.ANTONI): Promise<Blob> => {
    if (!API_KEY) throw new Error('ElevenLabs API Key is missing');

    const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': API_KEY },
        body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
        }),
    });

    if (!response.ok) throw new Error('Failed to generate speech');
    return await response.blob();
};

// Add Voice (Instant Clone) - Supports multiple audio samples for better quality
export const addVoice = async (name: string, audioBlobs: Blob | Blob[]): Promise<string> => {
    if (!API_KEY) throw new Error('API Key missing');

    const formData = new FormData();
    formData.append('name', name);

    // Support both single blob and array of blobs
    const blobs = Array.isArray(audioBlobs) ? audioBlobs : [audioBlobs];
    blobs.forEach((blob, index) => {
        formData.append('files', blob, `sample_${index + 1}.webm`);
    });

    formData.append('description', 'Storyforest Voice Clone');

    const response = await fetch(`${BASE_URL}/voices/add`, {
        method: 'POST',
        headers: { 'xi-api-key': API_KEY }, // Content-Type is auto-set by FormData
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail?.message || 'Failed to add voice');
    }

    const data = await response.json();
    return data.voice_id;
};

// Delete Voice
export const deleteVoice = async (voiceId: string): Promise<void> => {
    if (!API_KEY) throw new Error('API Key missing');

    const response = await fetch(`${BASE_URL}/voices/${voiceId}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': API_KEY },
    });

    if (!response.ok) throw new Error('Failed to delete voice');
};
