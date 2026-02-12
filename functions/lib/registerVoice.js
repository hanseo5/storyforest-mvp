"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVoice = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const pubsub_1 = require("@google-cloud/pubsub");
const elevenlabs_1 = require("./elevenlabs");
const params_1 = require("firebase-functions/params");
// Ensure admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const pubsub = new pubsub_1.PubSub();
const apiKey = (0, params_1.defineSecret)('ELEVENLABS_API_KEY');
exports.registerVoice = (0, https_1.onCall)({
    secrets: [apiKey],
    cors: true,
    timeoutSeconds: 120,
}, async (request) => {
    // Require authentication
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    // Use authenticated UID — never trust client-provided userId
    const userId = request.auth.uid;
    const { storagePath, name } = request.data;
    if (!storagePath || !name) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields: storagePath, name');
    }
    try {
        console.log(`[RegisterVoice] Request for user ${userId}, sample: ${storagePath}`);
        // 1. Download audio file from Firebase Storage
        const bucket = admin.storage().bucket();
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        if (!exists) {
            throw new https_1.HttpsError('not-found', 'Audio sample file not found in storage');
        }
        const [fileBuffer] = await file.download();
        console.log(`[RegisterVoice] Downloaded sample, size: ${fileBuffer.length} bytes`);
        // 2. Add Voice to ElevenLabs
        const voiceId = await (0, elevenlabs_1.addVoice)(name, [fileBuffer]);
        console.log(`[RegisterVoice] Voice added to ElevenLabs: ${voiceId}`);
        // 3. Update Firestore User Document
        await admin.firestore().collection('users').doc(userId).update({
            elevenlabs_voice_id: voiceId,
            generation_status: 'processing',
            last_generation_request: admin.firestore.FieldValue.serverTimestamp()
        });
        // 4. Trigger Background Audio Generation via Pub/Sub
        const topicName = 'generate-audio';
        const dataBuffer = Buffer.from(JSON.stringify({ userId, voiceId }));
        try {
            await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
            console.log(`[RegisterVoice] Published message to ${topicName}`);
        }
        catch (pubsubError) {
            console.error('[RegisterVoice] Pub/Sub error:', pubsubError);
            throw new https_1.HttpsError('internal', 'Failed to trigger background generation');
        }
        return { success: true, voiceId, status: 'processing' };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('[RegisterVoice] Error:', error);
        throw new https_1.HttpsError('internal', errorMessage);
    }
});
//# sourceMappingURL=registerVoice.js.map