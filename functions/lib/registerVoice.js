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
exports.registerVoice = (0, https_1.onRequest)({ secrets: [apiKey], cors: true }, async (req, res) => {
    try {
        const { storagePath, userId, name } = req.body;
        if (!storagePath || !userId || !name) {
            res.status(400).json({ error: 'Missing required fields: storagePath, userId, name' });
            return;
        }
        console.log(`[RegisterVoice] Request for user ${userId}, sample: ${storagePath}`);
        // 1. Download audio file from Firebase Storage
        const bucket = admin.storage().bucket();
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        if (!exists) {
            res.status(404).json({ error: 'Audio sample file not found in storage' });
            return;
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
            // Even if pubsub fails, we verify the user record is updated so we might retry manually or handle error
            // For now, return error to client implies failure
            throw new Error('Failed to trigger background generation');
        }
        // 5. Cleanup temporary storage file immediately (optional, or rely on lifecycle policy)
        // await file.delete(); 
        res.status(200).json({ success: true, voiceId, status: 'processing' });
    }
    catch (error) {
        console.error('[RegisterVoice] Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});
//# sourceMappingURL=registerVoice.js.map