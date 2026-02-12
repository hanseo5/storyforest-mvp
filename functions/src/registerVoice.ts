import { onCall, HttpsError } from 'firebase-functions/v2/https';
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

export const registerVoice = onCall(
    {
        secrets: [apiKey],
        cors: true,
        timeoutSeconds: 120,
    },
    async (request) => {
        // Require authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        // Use authenticated UID — never trust client-provided userId
        const userId = request.auth.uid;
        const { storagePath, name } = request.data as { storagePath?: string; name?: string };

        if (!storagePath || !name) {
            throw new HttpsError('invalid-argument', 'Missing required fields: storagePath, name');
        }

        try {
            console.log(`[RegisterVoice] Request for user ${userId}, sample: ${storagePath}`);

            // 1. Download audio file from Firebase Storage
            const bucket = admin.storage().bucket();
            const file = bucket.file(storagePath);
            const [exists] = await file.exists();

            if (!exists) {
                throw new HttpsError('not-found', 'Audio sample file not found in storage');
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
                throw new HttpsError('internal', 'Failed to trigger background generation');
            }

            // 5. Clean up temp voice sample (non-critical)
            try {
                await file.delete();
                console.log(`[RegisterVoice] Cleaned up temp sample: ${storagePath}`);
            } catch (cleanupErr) {
                console.warn('[RegisterVoice] Failed to clean up temp sample:', cleanupErr);
            }

            return { success: true, voiceId, status: 'processing' };

        } catch (error: unknown) {
            if (error instanceof HttpsError) throw error;
            const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
            console.error('[RegisterVoice] Error:', error);
            throw new HttpsError('internal', errorMessage);
        }
    }
);
