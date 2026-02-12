import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import type { UserProfile } from '../types';
import { ADMIN_EMAILS } from '../constants/admin';

/**
 * Register an admin UID in the global config document.
 * Also migrates books from previous admin UIDs to the current one.
 * Called when an admin user logs in — ensures all users can find official books.
 */
export const registerAdminUid = async (uid: string): Promise<void> => {
    try {
        const configRef = doc(db, 'config', 'admins');
        const snap = await getDoc(configRef);
        let previousUids: string[] = [];

        if (snap.exists()) {
            const data = snap.data();
            previousUids = (data?.uids as string[]) || [];
            if (!previousUids.includes(uid)) {
                await updateDoc(configRef, { uids: arrayUnion(uid) });
            }
        } else {
            await setDoc(configRef, { uids: [uid] });
        }

        // Migrate books from old admin UIDs to current UID
        const oldUids = previousUids.filter(id => id !== uid);
        for (const oldUid of oldUids) {
            const booksQuery = query(
                collection(db, 'books'),
                where('authorId', '==', oldUid)
            );
            const booksSnap = await getDocs(booksQuery);
            for (const bookDoc of booksSnap.docs) {
                await updateDoc(doc(db, 'books', bookDoc.id), { authorId: uid });
            }
            if (booksSnap.size > 0) {
                console.log(`[UserService] Migrated ${booksSnap.size} books from old UID ${oldUid} to ${uid}`);
            }
        }

        // Clean up: keep only current UID in config
        if (oldUids.length > 0) {
            await setDoc(configRef, { uids: [uid] });
        }
    } catch (e) {
        console.error('[UserService] Error registering admin UID:', e);
    }
};

/**
 * One-time migration: find books whose authorId doesn't match any known user
 * and reassign them to the current admin. Handles cases where admin previously
 * logged in with a different auth provider (phone vs email/Google).
 */
export const migrateOrphanAdminBooks = async (currentAdminUid: string): Promise<void> => {
    try {
        // Check if migration already done
        const configRef = doc(db, 'config', 'admins');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists() && configSnap.data()?.migrated) return;

        // Get all books and find ones not owned by current admin
        const booksQuery = query(collection(db, 'books'));
        const booksSnap = await getDocs(booksQuery);

        let migratedCount = 0;
        for (const bookDoc of booksSnap.docs) {
            const authorId = bookDoc.data().authorId;
            if (authorId && authorId !== currentAdminUid) {
                // Check if this authorId belongs to a real non-admin user
                const userRef = doc(db, 'users', authorId);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.exists() ? userSnap.data() : null;
                const hasEmail = userData?.email;

                // If no user doc or no email, it's likely an old admin account — migrate
                if (!userSnap.exists() || !hasEmail || ADMIN_EMAILS.includes(hasEmail.toLowerCase())) {
                    await updateDoc(doc(db, 'books', bookDoc.id), { authorId: currentAdminUid });
                    migratedCount++;
                }
            }
        }

        if (migratedCount > 0) {
            console.log(`[UserService] Migrated ${migratedCount} orphan books to admin ${currentAdminUid}`);
        }

        // Mark migration as done
        await updateDoc(configRef, { migrated: true });
    } catch (e) {
        console.error('[UserService] Error migrating orphan books:', e);
    }
};

/**
 * Get UIDs of admin users.
 * 1. Reads from global config/admins doc (set when admin logs in)
 * 2. Falls back to querying users collection by email
 */
export const getAdminUserIds = async (): Promise<string[]> => {
    try {
        // Primary: read from global config doc (works for ALL users)
        const configRef = doc(db, 'config', 'admins');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
            const data = configSnap.data();
            if (data?.uids && data.uids.length > 0) {
                return data.uids as string[];
            }
        }

        // Fallback: query users collection by email
        if (ADMIN_EMAILS.length === 0) return [];
        const usersQuery = query(
            collection(db, 'users'),
            where('email', 'in', ADMIN_EMAILS)
        );
        const snapshot = await getDocs(usersQuery);
        return snapshot.docs.map(d => d.id);
    } catch (e) {
        console.error('[UserService] Error resolving admin UIDs:', e);
        return [];
    }
};

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
