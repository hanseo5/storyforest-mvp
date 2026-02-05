"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSpeech = exports.deleteVoice = exports.addVoice = exports.getApiKey = void 0;
const params_1 = require("firebase-functions/params");
const apiKey = (0, params_1.defineSecret)('ELEVENLABS_API_KEY');
const BASE_URL = 'https://api.elevenlabs.io/v1';
const getApiKey = () => apiKey.value();
exports.getApiKey = getApiKey;
/**
 * Add a new voice to ElevenLabs (Instant Cloning)
 */
const addVoice = async (name, fileBuffers, description = 'Storyforest user voice') => {
    const key = (0, exports.getApiKey)();
    if (!key)
        throw new Error('ElevenLabs API Key is missing');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    // In Node.js environment, we might need to handle FormData slightly differently if using native fetch
    // or use a library. For Node 20+ native fetch, standard FormData should work with Blobs.
    // However, creating Blobs from Buffers in Node:
    fileBuffers.forEach((buffer, index) => {
        // Convert Buffer to Uint8Array for Blob compatibility
        const uint8Array = new Uint8Array(buffer);
        const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
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
        const err = await response.json();
        throw new Error(err.detail?.message || 'Failed to add voice');
    }
    const data = await response.json();
    return data.voice_id;
};
exports.addVoice = addVoice;
/**
 * Delete a voice from ElevenLabs
 */
const deleteVoice = async (voiceId) => {
    const key = (0, exports.getApiKey)();
    if (!key)
        throw new Error('ElevenLabs API Key is missing');
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
exports.deleteVoice = deleteVoice;
/**
 * Generate Speech (TTS) returning an ArrayBuffer
 */
const generateSpeech = async (text, voiceId) => {
    const key = (0, exports.getApiKey)();
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
exports.generateSpeech = generateSpeech;
//# sourceMappingURL=elevenlabs.js.map