import { collection, addDoc, doc, setDoc, updateDoc, getDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DraftBook, DraftPage } from '../types/draft';
import { trackDraftSaved } from './analyticsService';

export const saveDraft = async (draft: DraftBook): Promise<string> => {
    try {

        // Extract pages and create clean draft data (Firestore doesn't accept undefined)
        const { pages, ...draftWithoutPages } = draft;
        const cleanDraftData = JSON.parse(JSON.stringify({
            ...draftWithoutPages,
            updatedAt: Date.now()
        }));

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

            trackDraftSaved({ draftId: draft.id, title: draft.title || '' });
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

            trackDraftSaved({ draftId: draftRef.id, title: draft.title || '' });
            return draftRef.id;
        }
    } catch (error) {
        console.error('[DraftService] Error saving draft:', error);
        throw error;
    }
};

export const updatePageImage = async (draftId: string, pageNumber: number, imageUrl: string): Promise<void> => {
    try {

        const pageRef = doc(db, 'drafts', draftId, 'pages', String(pageNumber));
        await updateDoc(pageRef, {
            imageUrl,
            imageStatus: 'complete'
        });

    } catch (error) {
        console.error('[DraftService] Error updating page image:', error);
        throw error;
    }
};

export const getDraft = async (draftId: string): Promise<DraftBook | null> => {
    try {

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

        return draftData;
    } catch (error) {
        console.error('[DraftService] Error fetching draft:', error);
        return null;
    }
};

export const listDrafts = async (authorId: string): Promise<DraftBook[]> => {
    try {

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

        // Delete pages subcollection first
        const pagesRef = collection(db, 'drafts', draftId, 'pages');
        const pagesSnap = await getDocs(pagesRef);
        for (const pageDoc of pagesSnap.docs) {
            await deleteDoc(pageDoc.ref);
        }

        // Delete main draft document
        const draftRef = doc(db, 'drafts', draftId);
        await deleteDoc(draftRef);

    } catch (error) {
        console.error('[DraftService] Error deleting draft:', error);
        throw error;
    }
};

export const publishDraft = async (draftId: string): Promise<void> => {
    // TODO: Move draft to books collection
    // This will be implemented when we add the publish flow
};
