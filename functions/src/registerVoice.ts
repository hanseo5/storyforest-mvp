import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { PubSub } from '@google-cloud/pubsub';
import { addVoice } from './elevenlabs';
import { defineSecret } from 'firebase-functions/params';

// Ensure admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const pubsub = new PubSub();
const apiKey = defineSecret('ELEVENLABS_API_KEY');

export const registerVoice = onRequest({ secrets: [apiKey], cors: true }, async (req, res) => {
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
        const voiceId = await addVoice(name, [fileBuffer]);
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
        } catch (pubsubError) {
            console.error('[RegisterVoice] Pub/Sub error:', pubsubError);
            // Even if pubsub fails, we verify the user record is updated so we might retry manually or handle error
            // For now, return error to client implies failure
            throw new Error('Failed to trigger background generation');
        }

        // 5. Cleanup temporary storage file immediately (optional, or rely on lifecycle policy)
        // await file.delete(); 

        res.status(200).json({ success: true, voiceId, status: 'processing' });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        console.error('[RegisterVoice] Error:', error);
        res.status(500).json({ error: errorMessage });
    }
});
