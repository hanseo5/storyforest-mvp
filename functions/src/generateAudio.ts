import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import * as admin from 'firebase-admin';
import { generateSpeech, deleteVoice } from './elevenlabs';
import { defineSecret } from 'firebase-functions/params';

// Ensure admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();
const apiKey = defineSecret('ELEVENLABS_API_KEY');

export const generateAudio = onMessagePublished({
    topic: 'generate-audio',
    secrets: [apiKey],
    timeoutSeconds: 540, // 9 minutes (max for gen2 is higher but 540 is safe default extended)
    memory: '1GiB'
}, async (event) => {
    const { userId, voiceId } = event.data.message.json;
    console.log(`[GenerateAudio] Starting generation for user: ${userId}, voice: ${voiceId}`);

    if (!userId || !voiceId) {
        console.error('[GenerateAudio] Missing userId or voiceId');
        return;
    }

    try {
        // 1. Get all published books
        const booksSnapshot = await db.collection('books').get();
        if (booksSnapshot.empty) {
            console.log('[GenerateAudio] No books found.');
        }

        const totalTasks: { bookId: string; pageNumber: number; text: string }[] = [];

        // 2. Gather all text segments to generate
        for (const bookDoc of booksSnapshot.docs) {
            const pagesSnapshot = await bookDoc.ref.collection('pages').orderBy('pageNumber').get();
            pagesSnapshot.forEach(pageDoc => {
                const data = pageDoc.data();
                if (data.text) {
                    totalTasks.push({
                        bookId: bookDoc.id,
                        pageNumber: data.pageNumber,
                        text: data.text
                    });
                }
            });
        }
        console.log(`[GenerateAudio] Found ${totalTasks.length} segments to generate.`);

        // 3. Process in chunks to avoid rate limits or memory issues
        // ElevenLabs Concurrency limit is usually 2-3 for Starter/Creator.
        // We'll process sequentially or with low concurrency. Sequential is safer for reliability.
        let successCount = 0;
        let failCount = 0;

        for (const task of totalTasks) {
            try {
                // Generate
                const audioBuffer = await generateSpeech(task.text, voiceId);

                // Upload to Storage
                const filePath = `user_audio/${userId}/${task.bookId}/page_${task.pageNumber}.mp3`;
                const file = storage.bucket().file(filePath);

                await file.save(Buffer.from(audioBuffer), {
                    contentType: 'audio/mpeg',
                    metadata: {
                        userId,
                        bookId: task.bookId,
                        pageNumber: task.pageNumber,
                        voiceId // just for record
                    }
                });

                // Get Download URL (Assuming public or secure access pattern. For signedUrl we need key file. 
                // For simplicity in MV, we often use 'getDownloadURL' on client with SDK, OR make object public.
                // However, 'getDownloadURL' is client SDK method. 
                // In Admin SDK, 'getSignedUrl' is common. 
                // OR we just store the storagePath and let client SDK fetch URL.)
                // Strategy: Store storagePath. Client can use getDownloadURL(ref(storage, path)).

                // Save record to Firestore
                const recordId = `${userId}_${task.bookId}_${task.pageNumber}`;
                await db.collection('user_audio_files').doc(recordId).set({
                    userId,
                    bookId: task.bookId,
                    pageNumber: task.pageNumber,
                    storagePath: filePath,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                successCount++;
                // Update progress occasionally? (Too many writes. Maybe update every 10% or just at end)

            } catch (err) {
                console.error(`[GenerateAudio] Failed task Book ${task.bookId} Page ${task.pageNumber}:`, err);
                failCount++;
            }
        }

        console.log(`[GenerateAudio] Completed. Success: ${successCount}, Fail: ${failCount}`);

        // 4. Update User Status
        await db.collection('users').doc(userId).update({
            generation_status: 'complete',
            last_generation_at: admin.firestore.FieldValue.serverTimestamp()
        });

    } catch (error) {
        console.error('[GenerateAudio] Fatal Loop Error:', error);
        await db.collection('users').doc(userId).update({
            generation_status: 'error'
        });
    } finally {
        // 5. CRITICAL: Delete Voice to free up slot
        try {
            console.log(`[GenerateAudio] Deleting voice ${voiceId} to free slot...`);
            await deleteVoice(voiceId);
            // Clear voice ID from user doc
            await db.collection('users').doc(userId).update({
                elevenlabs_voice_id: admin.firestore.FieldValue.delete()
            });
            console.log('[GenerateAudio] Voice deleted.');
        } catch (cleanupError) {
            console.error('[GenerateAudio] FAILED TO DELETE VOICE! Slot might be stuck:', cleanupError);
            // Maybe alert admin?
        }
    }
});
