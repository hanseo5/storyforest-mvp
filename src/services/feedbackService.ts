/**
 * Feedback Service
 * Stores user feedback in Firestore for beta testing.
 */

import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type FeedbackCategory = 'bug' | 'suggestion' | 'usability' | 'other';

export interface FeedbackData {
    category: FeedbackCategory;
    message: string;
    currentPage?: string;
    screenshot?: string; // base64 (optional, not used for now)
}

export const submitFeedback = async (data: FeedbackData): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        email: user.email || '',
        category: data.category,
        message: data.message,
        currentPage: data.currentPage || window.location.pathname,
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        createdAt: serverTimestamp(),
        status: 'new', // new | reviewed | resolved
    });
};
