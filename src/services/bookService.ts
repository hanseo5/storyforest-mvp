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

        console.log(`[BookService] Uploading image for page ${pageNumber}...`);
        await uploadBytes(storageRef, blob);

        const downloadUrl = await getDownloadURL(storageRef);
        console.log(`[BookService] Image uploaded for page ${pageNumber}`);

        return downloadUrl;
    } catch (error) {
        console.error(`[BookService] Failed to upload image for page ${pageNumber}:`, error);
        return ''; // Return empty string on failure
    }
};

export const publishBook = async (storyData: GeneratedStoryData): Promise<string> => {
    try {
        console.log('[BookService] Publishing generated story:', storyData.title);

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
        console.log('[BookService] Book created:', bookRef.id);

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

        console.log('[BookService] Book published successfully!');
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
        console.log('[BookService] Publishing draft:', draft.title);

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
        console.log('[BookService] Book created:', bookRef.id);

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

        console.log('[BookService] Draft marked as published');
        return bookRef.id;

    } catch (error) {
        console.error('[BookService] Error publishing draft:', error);
        throw error;
    }
};

/**
 * Get all published books for a user
 */
export const getPublishedBooks = async (userId: string): Promise<Book[]> => {
    try {
        console.log('[BookService] Fetching published books for:', userId);

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

        console.log('[BookService] Found', books.length, 'books');
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
        console.log('[BookService] Fetching all published books');

        const booksQuery = query(
            collection(db, 'books'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(booksQuery);
        const books: Book[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Book));

        console.log('[BookService] Found', books.length, 'books total');
        return books;

    } catch (error) {
        console.error('[BookService] Error fetching all books:', error);
        return [];
    }
};

/**
 * Get a book by ID with all its pages
 */
export const getBookById = async (bookId: string): Promise<PublishedBook | null> => {
    try {
        console.log('[BookService] Fetching book:', bookId);

        const bookRef = doc(db, 'books', bookId);
        const bookSnap = await getDoc(bookRef);

        if (!bookSnap.exists()) {
            console.log('[BookService] Book not found');
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

        console.log('[BookService] Book loaded with', pages.length, 'pages');

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
        console.log('[BookService] Starting audiobook generation for:', bookId, 'VoiceKey:', voiceKey);

        // Get book pages
        const book = await getBookById(bookId);
        if (!book) throw new Error('Book not found');

        // Process each page sequentially
        for (const page of book.pages) {
            // Check if audio already exists for this voice
            const existingAudioUrl = page.audioUrls?.[voiceKey];
            if (existingAudioUrl && existingAudioUrl.length > 0) {
                console.log(`[BookService] Page ${page.pageNumber} already has audio for voice ${voiceKey}, skipping.`);
                continue;
            }

            console.log(`[BookService] Generating audio for page ${page.pageNumber} (VoiceKey: ${voiceKey})...`);

            // Generate Speech
            const audioBlob = await generateSpeechBlob(page.text, customVoiceId);

            // Upload to Storage with voice-specific path
            const storagePath = `books/${bookId}/pages/${page.pageNumber}_audio_${voiceKey}.mp3`;
            const storageRef = ref(storage, storagePath);

            console.log(`[BookService] Uploading audio to ${storagePath}...`);
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

            console.log(`[BookService] Page ${page.pageNumber} audio saved for voice ${voiceKey}:`, audioUrl);
        }

        console.log('[BookService] Audiobook generation complete!');

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
        console.log('[BookService] Starting batch audio generation for all books. VoiceKey:', voiceKey);

        // Get all books
        const books = await getAllPublishedBooks();
        console.log('[BookService] Found', books.length, 'books to process');

        for (let bookIdx = 0; bookIdx < books.length; bookIdx++) {
            const bookMeta = books[bookIdx];
            const book = await getBookById(bookMeta.id);
            if (!book) continue;

            console.log(`[BookService] Processing book ${bookIdx + 1}/${books.length}: ${book.title}`);

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
                    console.log(`[BookService] Book "${book.title}" Page ${page.pageNumber} already has audio for ${voiceKey}, skipping.`);
                    continue;
                }

                console.log(`[BookService] Generating audio for "${book.title}" Page ${page.pageNumber}...`);

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

                console.log(`[BookService] Audio saved for "${book.title}" Page ${page.pageNumber}`);
            }
        }

        console.log('[BookService] Batch audio generation complete!');

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
        console.log('[BookService] Starting translated audio generation for:', language);

        const books = await getAllPublishedBooks();

        for (let bookIdx = 0; bookIdx < books.length; bookIdx++) {
            const bookMeta = books[bookIdx];
            const book = await getBookById(bookMeta.id);
            if (!book) continue;

            // Get cached translation from Firestore
            const { getCachedTranslation } = await import('./translationService');
            const translation = await getCachedTranslation(book.id, language);

            if (!translation?.pages) {
                console.log(`[BookService] No translation found for "${book.title}" in ${language}, skipping.`);
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
                    console.log(`[BookService] Translated audio already exists for "${book.title}" Page ${page.pageNumber}, skipping.`);
                    continue;
                }

                console.log(`[BookService] Generating translated audio for "${book.title}" Page ${page.pageNumber}...`);

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

                console.log(`[BookService] Translated audio saved for "${book.title}" Page ${page.pageNumber}`);
            }
        }

        console.log('[BookService] Translated audio generation complete!');

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
        console.log('[BookService] Deleting book:', bookId);

        // 1. Delete all pages subcollection
        const pagesRef = collection(db, 'books', bookId, 'pages');
        const pagesSnapshot = await getDocs(pagesRef);

        for (const pageDoc of pagesSnapshot.docs) {
            await deleteDoc(pageDoc.ref);
        }
        console.log('[BookService] Deleted', pagesSnapshot.docs.length, 'pages');

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

            console.log('[BookService] Deleted storage files');
        } catch (storageError) {
            console.warn('[BookService] Storage cleanup failed (may not exist):', storageError);
        }

        // 3. Delete the book document
        const bookRef = doc(db, 'books', bookId);
        await deleteDoc(bookRef);

        console.log('[BookService] Book deleted successfully:', bookId);

    } catch (error) {
        console.error('[BookService] Error deleting book:', error);
        throw error;
    }
};
