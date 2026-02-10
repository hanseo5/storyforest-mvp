import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const elevenlabsSecret = defineSecret('ELEVENLABS_API_KEY');
const BASE_URL = 'https://api.elevenlabs.io/v1';

export interface ElevenLabsVoice {
    voice_id: string;
    name: string;
}

/**
 * Internal helper: Generate speech from text (server-side only)
 * Used by generateAudio PubSub function
 */
export const generateSpeech = async (text: string, voiceId: string): Promise<ArrayBuffer> => {
    const key = elevenlabsSecret.value();
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
                use_speaker_boost: true,
            },
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: { message: response.statusText } }));
        throw new Error(err.detail?.message || 'Failed to generate speech');
    }

    return await response.arrayBuffer();
};

/**
 * Internal helper: Delete voice (server-side only)
 * Used by generateAudio PubSub function
 */
export const deleteVoice = async (voiceId: string): Promise<void> => {
    const key = elevenlabsSecret.value();
    if (!key) throw new Error('ElevenLabs API Key is missing');

    const response = await fetch(`${BASE_URL}/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
            'xi-api-key': key,
        },
    });

    if (!response.ok) {
        console.warn(`[deleteVoice] Failed to delete voice ${voiceId}: ${response.statusText}`);
    }
};

/**
 * Internal helper: Add voice (server-side only)
 * Used by registerVoice HTTP function
 */
export const addVoice = async (name: string, fileBuffers: Buffer[], description: string = 'Storyforest user voice'): Promise<string> => {
    const key = elevenlabsSecret.value();
    if (!key) throw new Error('ElevenLabs API Key is missing');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);

    fileBuffers.forEach((buffer, index) => {
        const uint8Array = new Uint8Array(buffer);
        const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
        formData.append('files', blob, `sample_${index}.mp3`);
    });

    const response = await fetch(`${BASE_URL}/voices/add`, {
        method: 'POST',
        headers: {
            'xi-api-key': key,
        },
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json() as { detail?: { message: string } };
        throw new Error(err.detail?.message || 'Failed to add voice');
    }

    const data = await response.json() as { voice_id: string };
    return data.voice_id;
};

/**
 * Cloud Function: Add a voice (for client-side calls)
 */
export const addVoiceFunction = onCall(
    {
        secrets: [elevenlabsSecret],
        timeoutSeconds: 120,
        enforceAppCheck: false,
        cors: true,
    },
    async (request: { data: { name: string; audioBase64: string; description?: string } }): Promise<string> => {
        const { name, audioBase64, description } = request.data;

        if (!name || !audioBase64) {
            throw new HttpsError('invalid-argument', 'Missing name or audioBase64');
        }

        try {
            console.log('[addVoiceFunction] Starting voice addition for:', name);
            const key = elevenlabsSecret.value();
            console.log('[addVoiceFunction] API Key loaded:', !!key);
            
            if (!key) {
                console.error('[addVoiceFunction] API key is undefined or empty');
                throw new HttpsError('failed-precondition', 'ElevenLabs API key not configured');
            }

            // Convert base64 to Buffer
            const audioBuffer = Buffer.from(audioBase64, 'base64');

            // Create FormData with audio file
            const formData = new FormData();
            formData.append('name', name);
            if (description) formData.append('description', description);

            // Convert Buffer to Blob
            const blob = new Blob([audioBuffer], { type: 'audio/webm' });
            formData.append('files', blob, 'voice.webm');

            const response = await fetch(`${BASE_URL}/voices/add`, {
                method: 'POST',
                headers: {
                    'xi-api-key': key,
                },
                body: formData,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ detail: { message: response.statusText } }));
                throw new HttpsError('internal', err.detail?.message || 'Failed to add voice');
            }

            const data = await response.json() as { voice_id: string };
            return data.voice_id;
        } catch (error) {
            console.error('[addVoiceFunction] Error:', error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('internal', 'Failed to add voice');
        }
    }
);

/**
 * Cloud Function: Generate speech (for client-side calls)
 */
export const generateSpeechFunction = onCall(
    {
        secrets: [elevenlabsSecret],
        timeoutSeconds: 60,
        enforceAppCheck: false,
        cors: true,
    },
    async (request: { data: { text: string; voiceId: string } }): Promise<string> => {
        const { text, voiceId } = request.data;

        if (!text || !voiceId) {
            throw new HttpsError('invalid-argument', 'Missing text or voiceId');
        }

        try {
            const key = elevenlabsSecret.value();
            if (!key) {
                throw new HttpsError('failed-precondition', 'ElevenLabs API key not configured');
            }

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
                        use_speaker_boost: true,
                    },
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ detail: { message: response.statusText } }));
                throw new HttpsError('internal', err.detail?.message || 'Failed to generate speech');
            }

            // Convert response to base64
            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            return base64;
        } catch (error) {
            console.error('[generateSpeechFunction] Error:', error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('internal', 'Failed to generate speech');
        }
    }
);

/**
 * Cloud Function: Delete a voice (for client-side calls)
 */
export const deleteVoiceFunction = onCall(
    {
        secrets: [elevenlabsSecret],
        timeoutSeconds: 30,
        enforceAppCheck: false,
        cors: true,
    },
    async (request: { data: { voiceId: string } }): Promise<void> => {
        const { voiceId } = request.data;

        if (!voiceId) {
            throw new HttpsError('invalid-argument', 'Missing voiceId');
        }

        try {
            const key = elevenlabsSecret.value();
            if (!key) {
                throw new HttpsError('failed-precondition', 'ElevenLabs API key not configured');
            }

            const response = await fetch(`${BASE_URL}/voices/${voiceId}`, {
                method: 'DELETE',
                headers: {
                    'xi-api-key': key,
                },
            });

            if (!response.ok) {
                console.warn(`[deleteVoiceFunction] Failed to delete voice ${voiceId}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('[deleteVoiceFunction] Error:', error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('internal', 'Failed to delete voice');
        }
    }
);
