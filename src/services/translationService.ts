import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { translateContent } from './geminiService';
import { getAllPublishedBooks, getBookById } from './bookService';

export interface TranslatedBook {
    title: string;
    description: string;
    pages: Record<number, string>;
}

/**
 * Get translation for a specific book and language
 */
export const getCachedTranslation = async (bookId: string, lang: string): Promise<TranslatedBook | null> => {
    try {
        const docRef = doc(db, 'books', bookId, 'translations', lang);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as TranslatedBook;
        }
        return null;
    } catch (e) {
        console.error('[TranslationService] Error fetching translation:', e);
        return null;
    }
};

/**
 * Translate an entire book and cache it in Firestore
 */
export const translateAndCacheBook = async (bookId: string, lang: string): Promise<TranslatedBook | null> => {
    try {
        const book = await getBookById(bookId);
        if (!book) return null;

        // 1. Translate Metadata
        const [translatedTitle, translatedDesc] = await Promise.all([
            translateContent(book.title, lang),
            translateContent(book.description || '', lang)
        ]);

        // 2. Translate Pages (Sequential to avoid rate limits/token explosion)
        const translatedPages: Record<number, string> = {};
        for (const page of book.pages) {
            translatedPages[page.pageNumber] = await translateContent(page.text, lang);
        }

        const result: TranslatedBook = {
            title: translatedTitle,
            description: translatedDesc,
            pages: translatedPages
        };

        // 3. Cache in Firestore
        await setDoc(doc(db, 'books', bookId, 'translations', lang), result);

        return result;
    } catch (e) {
        console.error('[TranslationService] Error translating book:', e);
        return null;
    }
};

/**
 * Background task to translate ALL books to a target language
 */
export const translateAllBooks = async (lang: string, onProgress?: (current: number, total: number) => void) => {
    try {
        const books = await getAllPublishedBooks();

        const { useStore } = await import('../store');

        for (let i = 0; i < books.length; i++) {
            const bookId = books[i].id;

            // Check if already translated
            let result = await getCachedTranslation(bookId, lang);
            if (result) {
            } else {
                result = await translateAndCacheBook(bookId, lang);
            }

            // Sync to store for immediate UI update
            if (result) {
                useStore.getState().setTranslatedBook(bookId!, lang, result);
            }

            if (onProgress) onProgress(i + 1, books.length);
        }
    } catch (e) {
        console.error('[TranslationService] Error in translateAllBooks:', e);
    }
};
