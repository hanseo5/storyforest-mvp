import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { generateSpeechBlob } from './elevenLabsService';
import type { Book, Page } from '../types';
import type { DraftBook } from '../types/draft';

export interface PublishedBook extends Book {
    pages: Page[];
}

/**
 * Direct publish a generated story (from Magic Maker auto-complete flow)
 */
export interface GeneratedStoryData {
    title: string;
    authorId: string;
    style: string;
    pages: { pageNumber: number; text: string; imageUrl?: string }[];
    variables?: {
        childName: string;
        childAge: number;
        interests: string[];
        message: string;
    };
}

/**
 * Helper function to upload base64 image to Firebase Storage
 */
const uploadBase64Image = async (
    base64Data: string,
    bookId: string,
    pageNumber: number
): Promise<string> => {
    try {
        // Check if it's already a URL (not base64)
        if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
            return base64Data;
        }

        // Extract base64 content
        const base64Content = base64Data.includes(',')
            ? base64Data.split(',')[1]
            : base64Data;

        // Convert base64 to blob
        const byteCharacters = atob(base64Content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });

        // Upload to Firebase Storage
        const storagePath = `books/${bookId}/pages/page_${pageNumber}.png`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, blob);

        const downloadUrl = await getDownloadURL(storageRef);

        return downloadUrl;
    } catch (error) {
        console.error(`[BookService] Failed to upload image for page ${pageNumber}:`, error);
        return ''; // Return empty string on failure
    }
};

export const publishBook = async (storyData: GeneratedStoryData): Promise<string> => {
    try {

        // First create the book document to get the ID
        const bookData = {
            title: storyData.title,
            authorId: storyData.authorId,
            coverUrl: '', // Will update after uploading first image
            description: `${storyData.variables?.childName || '아이'}를 위한 특별한 동화`,
            style: storyData.style,
            createdAt: Date.now(),
            originalLanguage: 'English',
            variables: storyData.variables,
        };

        const bookRef = await addDoc(collection(db, 'books'), bookData);

        // Upload images and save pages
        let coverUrl = '';
        for (const page of storyData.pages) {
            // Upload image to Storage if it exists
            let imageUrl = '';
            if (page.imageUrl) {
                imageUrl = await uploadBase64Image(page.imageUrl, bookRef.id, page.pageNumber);

                // Use first page image as cover
                if (page.pageNumber === 1 && imageUrl) {
                    coverUrl = imageUrl;
                }
            }

            // Save page to subcollection
            const pageRef = doc(db, 'books', bookRef.id, 'pages', String(page.pageNumber));
            await setDoc(pageRef, {
                pageNumber: page.pageNumber,
                text: page.text,
                imageUrl: imageUrl,
            });
        }

        // Update cover URL if we have one
        if (coverUrl) {
            const bookDocRef = doc(db, 'books', bookRef.id);
            await updateDoc(bookDocRef, { coverUrl });
        }

        // Track analytics
        const { trackBookPublished } = await import('./analyticsService');
        trackBookPublished({ bookId: bookRef.id, title: storyData.title });

        return bookRef.id;

    } catch (error) {
        console.error('[BookService] Error publishing book:', error);
        throw error;
    }
};

/**
 * Publish a draft to the books collection
 */
export const publishDraft = async (draft: DraftBook): Promise<string> => {
    try {

        if (!draft.id) {
            throw new Error('Draft must be saved before publishing');
        }

        // Check if all pages have text
        const hasAllText = draft.pages.every(p => p.text && p.text.trim().length > 0);
        if (!hasAllText) {
            throw new Error('All pages must have text before publishing');
        }

        // Create book document
        const bookData = {
            title: draft.title,
            authorId: draft.authorId,
            coverUrl: draft.protagonistImage || draft.pages[0]?.imageUrl || '',
            description: draft.protagonist || '',
            style: draft.style || '',
            createdAt: Date.now(),
            draftId: draft.id, // Reference to original draft
            originalLanguage: draft.originalLanguage || 'English', // Language the book was written in
        };

        const bookRef = await addDoc(collection(db, 'books'), bookData);

        // Save pages to subcollection
        for (const page of draft.pages) {
            const pageRef = doc(db, 'books', bookRef.id, 'pages', String(page.pageNumber));
            await setDoc(pageRef, {
                pageNumber: page.pageNumber,
                text: page.text,
                imageUrl: page.imageUrl || '',
            });
        }

        // Update draft status to published
        const draftRef = doc(db, 'drafts', draft.id);
        await updateDoc(draftRef, {
            status: 'published',
            publishedBookId: bookRef.id,
            updatedAt: Date.now()
        });

        return bookRef.id;

    } catch (error) {
        console.error('[BookService] Error publishing draft:', error);
        throw error;
    }
};

/**
 * Update an existing published book with new data
 */
export const updatePublishedBook = async (bookId: string, draft: DraftBook): Promise<void> => {
    try {
        const bookDocRef = doc(db, 'books', bookId);
        const bookSnap = await getDoc(bookDocRef);
        if (!bookSnap.exists()) {
            throw new Error(`Book ${bookId} not found`);
        }

        // Update book document (preserve createdAt, authorId)
        await updateDoc(bookDocRef, {
            title: draft.title,
            coverUrl: draft.protagonistImage || draft.pages[0]?.imageUrl || '',
            description: draft.protagonist || '',
            style: draft.style || '',
            updatedAt: Date.now(),
        });

        // Delete old pages and write new ones
        const oldPagesSnap = await getDocs(collection(db, 'books', bookId, 'pages'));
        for (const pageDoc of oldPagesSnap.docs) {
            await deleteDoc(pageDoc.ref);
        }

        for (const page of draft.pages) {
            const pageRef = doc(db, 'books', bookId, 'pages', String(page.pageNumber));
            await setDoc(pageRef, {
                pageNumber: page.pageNumber,
                text: page.text,
                imageUrl: page.imageUrl || '',
            });
        }

        // Update coverUrl if first page changed
        const coverUrl = draft.protagonistImage || draft.pages[0]?.imageUrl || '';
        if (coverUrl) {
            await updateDoc(bookDocRef, { coverUrl });
        }

        console.log(`[BookService] Book ${bookId} updated successfully`);
    } catch (error) {
        console.error('[BookService] Error updating book:', error);
        throw error;
    }
};

/**
 * Get all published books for a user
 */
export const getPublishedBooks = async (userId: string): Promise<Book[]> => {
    try {

        const booksQuery = query(
            collection(db, 'books'),
            where('authorId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(booksQuery);
        const books: Book[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Book));

        return books;

    } catch (error) {
        console.error('[BookService] Error fetching books:', error);
        return [];
    }
};

/**
 * Get all published books (for library - all users)
 */
export const getAllPublishedBooks = async (): Promise<Book[]> => {
    try {

        const booksQuery = query(
            collection(db, 'books'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(booksQuery);
        const books: Book[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Book));

        return books;

    } catch (error) {
        console.error('[BookService] Error fetching all books:', error);
        return [];
    }
};

/**
 * Get official Storyforest books (created by admin accounts)
 */
export const getOfficialBooks = async (adminUserIds: string[]): Promise<Book[]> => {
    try {
        if (adminUserIds.length === 0) return [];
        const booksQuery = query(
            collection(db, 'books'),
            where('authorId', 'in', adminUserIds),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(booksQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book));
    } catch (error) {
        console.error('[BookService] Error fetching official books:', error);
        return [];
    }
};

/**
 * Get books created by a specific user (personal library)
 */
export const getUserBooks = async (userId: string): Promise<Book[]> => {
    try {
        const booksQuery = query(
            collection(db, 'books'),
            where('authorId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(booksQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book));
    } catch (error) {
        console.error('[BookService] Error fetching user books:', error);
        return [];
    }
};

/**
 * Get a book by ID with all its pages
 */
export const getBookById = async (bookId: string): Promise<PublishedBook | null> => {
    try {

        const bookRef = doc(db, 'books', bookId);
        const bookSnap = await getDoc(bookRef);

        if (!bookSnap.exists()) {
            return null;
        }

        const bookData = bookSnap.data();

        // Get pages
        const pagesQuery = query(
            collection(db, 'books', bookId, 'pages'),
            orderBy('pageNumber', 'asc')
        );
        const pagesSnap = await getDocs(pagesQuery);
        const pages: Page[] = pagesSnap.docs.map(doc => doc.data() as Page);


        return {
            id: bookSnap.id,
            title: bookData.title,
            authorId: bookData.authorId,
            coverUrl: bookData.coverUrl,
            createdAt: bookData.createdAt,
            description: bookData.description,
            style: bookData.style,
            pages
        };

    } catch (error) {
        console.error('[BookService] Error fetching book:', error);
        return null;
    }
};
/**
 * Generate audio for all pages in a book and save to Firebase Storage
 * Audio is stored per voice in audioUrls map
 * @param bookId - The book ID
 * @param customVoiceId - Optional custom voice ID (default = Brian)
 */
export const generateBookAudio = async (bookId: string, customVoiceId?: string): Promise<void> => {
    try {
        const voiceKey = customVoiceId || 'default';

        // Get book pages
        const book = await getBookById(bookId);
        if (!book) throw new Error('Book not found');

        // Process each page sequentially
        for (const page of book.pages) {
            // Check if audio already exists for this voice
            const existingAudioUrl = page.audioUrls?.[voiceKey];
            if (existingAudioUrl && existingAudioUrl.length > 0) {
                continue;
            }


            // Generate Speech
            const audioBlob = await generateSpeechBlob(page.text, customVoiceId);

            // Upload to Storage with voice-specific path
            const storagePath = `books/${bookId}/pages/${page.pageNumber}_audio_${voiceKey}.mp3`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, audioBlob);

            // Get URL
            const audioUrl = await getDownloadURL(storageRef);

            // Update Firestore Page - merge into audioUrls map
            const pageRef = doc(db, 'books', bookId, 'pages', String(page.pageNumber));
            const existingAudioUrls = page.audioUrls || {};
            await updateDoc(pageRef, {
                audioUrls: {
                    ...existingAudioUrls,
                    [voiceKey]: audioUrl
                }
            });

        }


    } catch (error) {
        console.error('[BookService] Error generating audiobook:', error);
        throw error;
    }
};

/**
 * Progress callback type for batch audio generation
 */
export type AudioGenerationProgress = {
    currentBook: number;
    totalBooks: number;
    currentPage: number;
    totalPages: number;
    bookTitle: string;
};

/**
 * Generate audio for ALL books with a specific voice
 * @param customVoiceId - Optional voice ID (default = Brian)
 * @param onProgress - Callback for progress updates
 */
export const generateAllBooksAudio = async (
    customVoiceId?: string,
    onProgress?: (progress: AudioGenerationProgress) => void
): Promise<void> => {
    try {
        const voiceKey = customVoiceId || 'default';

        // Get all books
        const books = await getAllPublishedBooks();

        for (let bookIdx = 0; bookIdx < books.length; bookIdx++) {
            const bookMeta = books[bookIdx];
            const book = await getBookById(bookMeta.id);
            if (!book) continue;


            for (let pageIdx = 0; pageIdx < book.pages.length; pageIdx++) {
                const page = book.pages[pageIdx];

                // Report progress
                onProgress?.({
                    currentBook: bookIdx + 1,
                    totalBooks: books.length,
                    currentPage: pageIdx + 1,
                    totalPages: book.pages.length,
                    bookTitle: book.title,
                });

                // Check if audio already exists for this voice
                const existingAudioUrl = page.audioUrls?.[voiceKey];
                if (existingAudioUrl && existingAudioUrl.length > 0) {
                    continue;
                }


                // Generate Speech
                const audioBlob = await generateSpeechBlob(page.text, customVoiceId);

                // Upload to Storage
                const storagePath = `books/${book.id}/pages/${page.pageNumber}_audio_${voiceKey}.mp3`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, audioBlob);

                // Get URL
                const audioUrl = await getDownloadURL(storageRef);

                // Update Firestore Page
                const pageRef = doc(db, 'books', book.id, 'pages', String(page.pageNumber));
                const existingAudioUrls = page.audioUrls || {};
                await updateDoc(pageRef, {
                    audioUrls: {
                        ...existingAudioUrls,
                        [voiceKey]: audioUrl
                    }
                });

            }
        }


    } catch (error) {
        console.error('[BookService] Error in batch audio generation:', error);
        throw error;
    }
};

/**
 * Generate and cache translated audio for all books in a specific language
 * @param language - Target language (e.g., 'Korean', 'Japanese')
 * @param onProgress - Callback for progress updates
 */
export const generateTranslatedAudio = async (
    language: string,
    onProgress?: (progress: AudioGenerationProgress) => void
): Promise<void> => {
    try {
        const voiceKey = `default_${language}`;

        const books = await getAllPublishedBooks();

        for (let bookIdx = 0; bookIdx < books.length; bookIdx++) {
            const bookMeta = books[bookIdx];
            const book = await getBookById(bookMeta.id);
            if (!book) continue;

            // Get cached translation from Firestore
            const { getCachedTranslation } = await import('./translationService');
            const translation = await getCachedTranslation(book.id, language);

            if (!translation?.pages) {
                continue;
            }

            for (let pageIdx = 0; pageIdx < book.pages.length; pageIdx++) {
                const page = book.pages[pageIdx];
                const translatedText = translation.pages[page.pageNumber];

                if (!translatedText) continue;

                onProgress?.({
                    currentBook: bookIdx + 1,
                    totalBooks: books.length,
                    currentPage: pageIdx + 1,
                    totalPages: book.pages.length,
                    bookTitle: book.title,
                });

                // Check if translated audio already exists
                const existingAudioUrl = page.audioUrls?.[voiceKey];
                if (existingAudioUrl && existingAudioUrl.length > 0) {
                    continue;
                }


                const audioBlob = await generateSpeechBlob(translatedText);

                const storagePath = `books/${book.id}/pages/${page.pageNumber}_audio_${voiceKey}.mp3`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, audioBlob);

                const audioUrl = await getDownloadURL(storageRef);

                const pageRef = doc(db, 'books', book.id, 'pages', String(page.pageNumber));
                const existingAudioUrls = page.audioUrls || {};
                await updateDoc(pageRef, {
                    audioUrls: {
                        ...existingAudioUrls,
                        [voiceKey]: audioUrl
                    }
                });

            }
        }


    } catch (error) {
        console.error('[BookService] Error generating translated audio:', error);
        throw error;
    }
};

/**
 * Delete a book and all its associated data (pages, audio, images)
 * @param bookId - The book ID to delete
 */
export const deleteBook = async (bookId: string): Promise<void> => {
    try {

        // 1. Delete all pages subcollection
        const pagesRef = collection(db, 'books', bookId, 'pages');
        const pagesSnapshot = await getDocs(pagesRef);

        for (const pageDoc of pagesSnapshot.docs) {
            await deleteDoc(pageDoc.ref);
        }

        // 2. Delete from Storage (images and audio)
        try {
            const bookStorageRef = ref(storage, `books/${bookId}`);
            const listResult = await listAll(bookStorageRef);

            // Delete files in pages folder
            if (listResult.prefixes.length > 0) {
                for (const folderRef of listResult.prefixes) {
                    const folderContents = await listAll(folderRef);
                    for (const fileRef of folderContents.items) {
                        await deleteObject(fileRef);
                    }
                }
            }

            // Delete any files directly in the book folder
            for (const fileRef of listResult.items) {
                await deleteObject(fileRef);
            }

        } catch (storageError) {
            console.warn('[BookService] Storage cleanup failed (may not exist):', storageError);
        }

        // 3. Delete the book document
        const bookRef = doc(db, 'books', bookId);
        await deleteDoc(bookRef);


    } catch (error) {
        console.error('[BookService] Error deleting book:', error);
        throw error;
    }
};
