/**
 * One-time script: Delete all books except "우당탕탕! 숲속 도서관"
 * Run from project root: node scripts/deleteBooks.mjs
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

initializeApp({
    credential: applicationDefault(),
    projectId: 'storyforest-mvp-hsl02',
    storageBucket: 'storyforest-mvp-hsl02.firebasestorage.app',
});

const db = getFirestore();
const bucket = getStorage().bucket();

const KEEP_TITLE = '우당탕탕! 숲속 도서관';

async function deleteBook(bookId, title) {
    console.log(`  Deleting: "${title}" (${bookId})`);

    // Delete pages subcollection
    const pagesSnapshot = await db.collection('books').doc(bookId).collection('pages').get();
    const batch = db.batch();
    pagesSnapshot.docs.forEach(d => batch.delete(d.ref));
    if (pagesSnapshot.size > 0) await batch.commit();
    console.log(`    - Deleted ${pagesSnapshot.size} pages`);

    // Delete storage files
    try {
        const [files] = await bucket.getFiles({ prefix: `books/${bookId}/` });
        for (const file of files) {
            await file.delete();
        }
        console.log(`    - Deleted ${files.length} storage files`);
    } catch {
        console.log('    - No storage files');
    }

    // Delete book document
    await db.collection('books').doc(bookId).delete();
    console.log(`    ✓ Done`);
}

async function main() {
    console.log('Fetching all books...');
    const snapshot = await db.collection('books').get();
    console.log(`Found ${snapshot.size} books total.\n`);

    let kept = 0, deleted = 0;

    for (const bookDoc of snapshot.docs) {
        const data = bookDoc.data();
        const title = data.title || '(no title)';

        if (title === KEEP_TITLE) {
            console.log(`  KEEPING: "${title}" (${bookDoc.id})`);
            kept++;
            continue;
        }

        await deleteBook(bookDoc.id, title);
        deleted++;
    }

    console.log(`\nDone! Kept: ${kept}, Deleted: ${deleted}`);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
