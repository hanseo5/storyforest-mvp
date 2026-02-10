import { collection, addDoc, doc, setDoc, updateDoc, getDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DraftBook, DraftPage } from '../types/draft';

export const saveDraft = async (draft: DraftBook): Promise<string> => {
    try {
        console.log('[DraftService] Saving draft...', draft.title);

        // Extract pages and create clean draft data (Firestore doesn't accept undefined)
        const { pages, ...draftWithoutPages } = draft;
        const cleanDraftData = {
            ...draftWithoutPages,
            updatedAt: Date.now()
        };

        if (draft.id) {
            // Update existing draft
            const draftRef = doc(db, 'drafts', draft.id);
            await setDoc(draftRef, cleanDraftData);

            // Save pages separately
            for (const page of pages) {
                const pageRef = doc(db, 'drafts', draft.id, 'pages', String(page.pageNumber));
                await setDoc(pageRef, {
                    pageNumber: page.pageNumber,
                    text: page.text,
                    imageUrl: page.imageUrl || null,
                    imageStatus: page.imageStatus
                });
            }

            console.log('[DraftService] Draft updated:', draft.id);
            return draft.id;
        } else {
            // Create new draft
            const draftData = {
                ...cleanDraftData,
                createdAt: Date.now()
            };

            const draftRef = await addDoc(collection(db, 'drafts'), draftData);

            // Save pages
            for (const page of pages) {
                const pageRef = doc(db, 'drafts', draftRef.id, 'pages', String(page.pageNumber));
                await setDoc(pageRef, {
                    pageNumber: page.pageNumber,
                    text: page.text,
                    imageUrl: page.imageUrl || null,
                    imageStatus: page.imageStatus
                });
            }

            console.log('[DraftService] Draft created:', draftRef.id);
            return draftRef.id;
        }
    } catch (error) {
        console.error('[DraftService] Error saving draft:', error);
        throw error;
    }
};

export const updatePageImage = async (draftId: string, pageNumber: number, imageUrl: string): Promise<void> => {
    try {
        console.log('[DraftService] Updating page image...', { draftId, pageNumber });

        const pageRef = doc(db, 'drafts', draftId, 'pages', String(pageNumber));
        await updateDoc(pageRef, {
            imageUrl,
            imageStatus: 'complete'
        });

        console.log('[DraftService] Page image updated');
    } catch (error) {
        console.error('[DraftService] Error updating page image:', error);
        throw error;
    }
};

export const getDraft = async (draftId: string): Promise<DraftBook | null> => {
    try {
        console.log('[DraftService] Fetching draft:', draftId);

        const draftRef = doc(db, 'drafts', draftId);
        const draftSnap = await getDoc(draftRef);

        if (!draftSnap.exists()) {
            console.error('[DraftService] Draft not found');
            return null;
        }

        // Fetch pages from subcollection
        const pagesRef = collection(db, 'drafts', draftId, 'pages');
        const pagesSnap = await getDocs(pagesRef);
        const pages = pagesSnap.docs
            .map(doc => doc.data() as DraftPage)
            .sort((a, b) => a.pageNumber - b.pageNumber);

        const draftData: DraftBook = {
            id: draftSnap.id,
            ...draftSnap.data(),
            pages
        } as DraftBook;

        console.log('[DraftService] Draft fetched with', pages.length, 'pages');
        return draftData;
    } catch (error) {
        console.error('[DraftService] Error fetching draft:', error);
        return null;
    }
};

export const listDrafts = async (authorId: string): Promise<DraftBook[]> => {
    try {
        console.log('[DraftService] Listing drafts for:', authorId);

        const draftsRef = collection(db, 'drafts');
        // Use simple query first - composite index not required for single field filter
        const q = query(draftsRef, where('authorId', '==', authorId));
        const draftsSnap = await getDocs(q);

        const drafts: DraftBook[] = draftsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            pages: [] // Don't load pages for list view
        } as DraftBook));

        // Sort in memory by createdAt/updatedAt (most recent first)
        drafts.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

        console.log('[DraftService] Found', drafts.length, 'drafts');
        return drafts;
    } catch (error) {
        console.error('[DraftService] Error listing drafts:', error);
        // Log the full error for debugging
        if (error instanceof Error) {
            console.error('[DraftService] Error details:', error.message);
        }
        return [];
    }
};

export const deleteDraft = async (draftId: string): Promise<void> => {
    try {
        console.log('[DraftService] Deleting draft:', draftId);

        // Delete pages subcollection first
        const pagesRef = collection(db, 'drafts', draftId, 'pages');
        const pagesSnap = await getDocs(pagesRef);
        for (const pageDoc of pagesSnap.docs) {
            await deleteDoc(pageDoc.ref);
        }

        // Delete main draft document
        const draftRef = doc(db, 'drafts', draftId);
        await deleteDoc(draftRef);

        console.log('[DraftService] Draft deleted');
    } catch (error) {
        console.error('[DraftService] Error deleting draft:', error);
        throw error;
    }
};

export const publishDraft = async (draftId: string): Promise<void> => {
    // TODO: Move draft to books collection
    console.log('[DraftService] Publishing draft:', draftId);
    // This will be implemented when we add the publish flow
};
