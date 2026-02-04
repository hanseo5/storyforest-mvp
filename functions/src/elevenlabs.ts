import { defineSecret } from 'firebase-functions/params';

const apiKey = defineSecret('ELEVENLABS_API_KEY');
const BASE_URL = 'https://api.elevenlabs.io/v1';

export const getApiKey = () => apiKey.value();

export interface ElevenLabsVoice {
    voice_id: string;
    name: string;
}

/**
 * Add a new voice to ElevenLabs (Instant Cloning)
 */
export const addVoice = async (name: string, fileBuffers: Buffer[], description: string = 'Storyforest user voice'): Promise<string> => {
    const key = getApiKey();
    if (!key) throw new Error('ElevenLabs API Key is missing');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);

    // In Node.js environment, we might need to handle FormData slightly differently if using native fetch
    // or use a library. For Node 20+ native fetch, standard FormData should work with Blobs.
    // However, creating Blobs from Buffers in Node:

    fileBuffers.forEach((buffer, index) => {
        const blob = new Blob([buffer], { type: 'audio/mpeg' }); // Assuming mp3/webm
        formData.append('files', blob, `sample_${index}.mp3`);
    });

    const response = await fetch(`${BASE_URL}/voices/add`, {
        method: 'POST',
        headers: {
            'xi-api-key': key
        },
        body: formData
    });

    if (!response.ok) {
        const err = await response.json() as any;
        throw new Error(err.detail?.message || 'Failed to add voice');
    }

    const data = await response.json() as { voice_id: string };
    return data.voice_id;
};

/**
 * Delete a voice from ElevenLabs
 */
export const deleteVoice = async (voiceId: string): Promise<void> => {
    const key = getApiKey();
    if (!key) throw new Error('ElevenLabs API Key is missing');

    const response = await fetch(`${BASE_URL}/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
            'xi-api-key': key
        }
    });

    if (!response.ok) {
        // Warning only, as it might already be deleted
        console.warn(`[ElevenLabs] Failed to delete voice ${voiceId}: ${response.statusText}`);
    }
};

/**
 * Generate Speech (TTS) returning an ArrayBuffer
 */
export const generateSpeech = async (text: string, voiceId: string): Promise<ArrayBuffer> => {
    const key = getApiKey();
    if (!key) throw new Error('ElevenLabs API Key is missing');

    const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': key,
        },
        body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
                stability: 0.55,
                similarity_boost: 0.8,
                style: 0.2,
                use_speaker_boost: true
            },
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: { message: response.statusText } }));
        throw new Error(err.detail?.message || 'Failed to generate speech');
    }

    return await response.arrayBuffer();
};
