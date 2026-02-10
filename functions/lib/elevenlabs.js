"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVoiceFunction = exports.generateSpeechFunction = exports.addVoiceFunction = exports.addVoice = exports.deleteVoice = exports.generateSpeech = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const elevenlabsSecret = (0, params_1.defineSecret)('ELEVENLABS_API_KEY');
const BASE_URL = 'https://api.elevenlabs.io/v1';
/**
 * Internal helper: Generate speech from text (server-side only)
 * Used by generateAudio PubSub function
 */
const generateSpeech = async (text, voiceId) => {
    const key = elevenlabsSecret.value();
    if (!key)
        throw new Error('ElevenLabs API Key is missing');
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
exports.generateSpeech = generateSpeech;
/**
 * Internal helper: Delete voice (server-side only)
 * Used by generateAudio PubSub function
 */
const deleteVoice = async (voiceId) => {
    const key = elevenlabsSecret.value();
    if (!key)
        throw new Error('ElevenLabs API Key is missing');
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
exports.deleteVoice = deleteVoice;
/**
 * Internal helper: Add voice (server-side only)
 * Used by registerVoice HTTP function
 */
const addVoice = async (name, fileBuffers, description = 'Storyforest user voice') => {
    const key = elevenlabsSecret.value();
    if (!key)
        throw new Error('ElevenLabs API Key is missing');
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
        const err = await response.json();
        throw new Error(err.detail?.message || 'Failed to add voice');
    }
    const data = await response.json();
    return data.voice_id;
};
exports.addVoice = addVoice;
/**
 * Cloud Function: Add a voice (for client-side calls)
 */
exports.addVoiceFunction = (0, https_1.onCall)({
    secrets: [elevenlabsSecret],
    timeoutSeconds: 120,
    enforceAppCheck: false,
    cors: true,
}, async (request) => {
    const { name, audioBase64, description } = request.data;
    if (!name || !audioBase64) {
        throw new https_1.HttpsError('invalid-argument', 'Missing name or audioBase64');
    }
    try {
        console.log('[addVoiceFunction] Starting voice addition for:', name);
        const key = elevenlabsSecret.value();
        console.log('[addVoiceFunction] API Key loaded:', !!key);
        if (!key) {
            console.error('[addVoiceFunction] API key is undefined or empty');
            throw new https_1.HttpsError('failed-precondition', 'ElevenLabs API key not configured');
        }
        // Convert base64 to Buffer
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        // Create FormData with audio file
        const formData = new FormData();
        formData.append('name', name);
        if (description)
            formData.append('description', description);
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
            throw new https_1.HttpsError('internal', err.detail?.message || 'Failed to add voice');
        }
        const data = await response.json();
        return data.voice_id;
    }
    catch (error) {
        console.error('[addVoiceFunction] Error:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', 'Failed to add voice');
    }
});
/**
 * Cloud Function: Generate speech (for client-side calls)
 */
exports.generateSpeechFunction = (0, https_1.onCall)({
    secrets: [elevenlabsSecret],
    timeoutSeconds: 60,
    enforceAppCheck: false,
    cors: true,
}, async (request) => {
    const { text, voiceId } = request.data;
    if (!text || !voiceId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing text or voiceId');
    }
    try {
        const key = elevenlabsSecret.value();
        if (!key) {
            throw new https_1.HttpsError('failed-precondition', 'ElevenLabs API key not configured');
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
            throw new https_1.HttpsError('internal', err.detail?.message || 'Failed to generate speech');
        }
        // Convert response to base64
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return base64;
    }
    catch (error) {
        console.error('[generateSpeechFunction] Error:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', 'Failed to generate speech');
    }
});
/**
 * Cloud Function: Delete a voice (for client-side calls)
 */
exports.deleteVoiceFunction = (0, https_1.onCall)({
    secrets: [elevenlabsSecret],
    timeoutSeconds: 30,
    enforceAppCheck: false,
    cors: true,
}, async (request) => {
    const { voiceId } = request.data;
    if (!voiceId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing voiceId');
    }
    try {
        const key = elevenlabsSecret.value();
        if (!key) {
            throw new https_1.HttpsError('failed-precondition', 'ElevenLabs API key not configured');
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
    }
    catch (error) {
        console.error('[deleteVoiceFunction] Error:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', 'Failed to delete voice');
    }
});
//# sourceMappingURL=elevenlabs.js.map