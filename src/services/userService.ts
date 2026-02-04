import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '../types';

export const getUserSettings = async (uid: string) => {
    try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (e) {
        console.error('[UserService] Error getting settings:', e);
        return null;
    }
};

export const saveUserSettings = async (uid: string, data: Partial<UserProfile>) => {
    try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            await updateDoc(docRef, data);
        } else {
            await setDoc(docRef, data);
        }
    } catch (e) {
        console.error('[UserService] Error saving settings:', e);
    }
};
