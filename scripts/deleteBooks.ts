/**
 * One-time script: Delete all books except "우당탕탕! 숲속 도서관"
 * Run: npx tsx scripts/deleteBooks.ts
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query } from 'firebase/firestore';
import { getStorage, ref, listAll, deleteObject } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyBJ9JQDvm3q1DFoYnqpNwA_fjscxRbNsLw",
    authDomain: "storyforest-mvp-hsl02.firebaseapp.com",
    projectId: "storyforest-mvp-hsl02",
    storageBucket: "storyforest-mvp-hsl02.firebasestorage.app",
    messagingSenderId: "553452892498",
    appId: "1:553452892498:web:d0c8e2b3fb1f4512094c0e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const KEEP_TITLE = '우당탕탕! 숲속 도서관';

async function deleteBook(bookId: string, title: string) {
    console.log(`  Deleting: "${title}" (${bookId})`);

    // Delete pages subcollection
    const pagesRef = collection(db, 'books', bookId, 'pages');
    const pagesSnapshot = await getDocs(pagesRef);
    for (const pageDoc of pagesSnapshot.docs) {
        await deleteDoc(pageDoc.ref);
    }
    console.log(`    - Deleted ${pagesSnapshot.size} pages`);

    // Delete storage
    try {
        const bookStorageRef = ref(storage, `books/${bookId}`);
        const listResult = await listAll(bookStorageRef);
        let fileCount = 0;

        for (const folderRef of listResult.prefixes) {
            const folderContents = await listAll(folderRef);
            for (const fileRef of folderContents.items) {
                await deleteObject(fileRef);
                fileCount++;
            }
        }
        for (const fileRef of listResult.items) {
            await deleteObject(fileRef);
            fileCount++;
        }
        console.log(`    - Deleted ${fileCount} storage files`);
    } catch {
        console.log('    - No storage files (or already cleaned)');
    }

    // Delete book document
    await deleteDoc(doc(db, 'books', bookId));
    console.log(`    ✓ Done`);
}

async function main() {
    console.log('Fetching all books...');
    const booksQuery = query(collection(db, 'books'));
    const snapshot = await getDocs(booksQuery);

    console.log(`Found ${snapshot.size} books total.\n`);

    let kept = 0;
    let deleted = 0;

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
    process.exit(0);
}

main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
