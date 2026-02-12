/**
 * Firebase Analytics Service
 * 
 * Tracks user behavior across the Storyforest app.
 * Events are visible in Firebase Console > Analytics.
 * 
 * Auto-tracked by Firebase:
 *   - first_open, session_start, user_engagement
 *   - page_view (when logPageView is called)
 * 
 * Custom events we track:
 *   - story_created: User starts AI story generation
 *   - story_completed: Story generation finishes
 *   - book_read: User opens a book to read
 *   - book_published: User publishes a book
 *   - draft_saved: User saves a draft
 *   - draft_opened: User opens a draft to continue editing
 *   - voice_recorded: User records voice for cloning
 *   - voice_selected: User selects a voice
 *   - art_style_selected: User picks an art style
 *   - photo_uploaded: User uploads a photo for story
 *   - language_changed: User changes target language
 *   - account_deleted: User deletes their account
 *   - login_method: User logs in (Google / Email)
 *   - signup_completed: User signs up
 */

import { logEvent as firebaseLogEvent, setUserId, setUserProperties } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { analyticsPromise } from '../lib/firebase';

let analyticsInstance: Analytics | null = null;

// Resolve analytics instance once
analyticsPromise.then(a => {
    analyticsInstance = a;
}).catch(() => {
    // Analytics not supported (e.g. SSR, blocked by browser)
});

/**
 * Log a custom event to Firebase Analytics.
 * Safe to call even if analytics is not yet initialized.
 */
export const logEvent = (eventName: string, params?: Record<string, string | number | boolean>) => {
    if (!analyticsInstance) return;
    try {
        firebaseLogEvent(analyticsInstance, eventName, params);
    } catch (err) {
        console.warn('[Analytics] Failed to log event:', eventName, err);
    }
};

/**
 * Log a page/screen view.
 */
export const logPageView = (pageName: string, pagePath: string) => {
    logEvent('page_view', {
        page_title: pageName,
        page_location: window.location.href,
        page_path: pagePath,
    });
};

/**
 * Set the user ID for analytics (called after login).
 */
export const setAnalyticsUser = async (uid: string) => {
    const analytics = await analyticsPromise;
    if (!analytics) return;
    try {
        setUserId(analytics, uid);
    } catch (err) {
        console.warn('[Analytics] Failed to set user ID:', err);
    }
};

/**
 * Set user properties (e.g., preferred language).
 */
export const setAnalyticsUserProperties = async (properties: Record<string, string>) => {
    const analytics = await analyticsPromise;
    if (!analytics) return;
    try {
        setUserProperties(analytics, properties);
    } catch (err) {
        console.warn('[Analytics] Failed to set user properties:', err);
    }
};

// ─── Convenience event helpers ───────────────────────────────

export const trackStoryCreated = (params: { childAge: number; artStyle: string; interests: string; hasPhoto: boolean }) => {
    logEvent('story_created', {
        child_age: params.childAge,
        art_style: params.artStyle,
        interests: params.interests,
        has_photo: params.hasPhoto,
    });
};

export const trackStoryCompleted = (params: { title: string; pageCount: number; artStyle: string }) => {
    logEvent('story_completed', {
        title: params.title,
        page_count: params.pageCount,
        art_style: params.artStyle,
    });
};

export const trackBookRead = (params: { bookId: string; title: string }) => {
    logEvent('book_read', {
        book_id: params.bookId,
        title: params.title,
    });
};

export const trackBookPublished = (params: { bookId: string; title: string }) => {
    logEvent('book_published', {
        book_id: params.bookId,
        title: params.title,
    });
};

export const trackDraftSaved = (params: { draftId: string; title: string }) => {
    logEvent('draft_saved', {
        draft_id: params.draftId,
        title: params.title,
    });
};

export const trackDraftOpened = (params: { draftId: string }) => {
    logEvent('draft_opened', {
        draft_id: params.draftId,
    });
};

export const trackVoiceRecorded = () => {
    logEvent('voice_recorded');
};

export const trackVoiceSelected = (params: { voiceId: string }) => {
    logEvent('voice_selected', {
        voice_id: params.voiceId,
    });
};

export const trackArtStyleSelected = (params: { artStyle: string }) => {
    logEvent('art_style_selected', {
        art_style: params.artStyle,
    });
};

export const trackPhotoUploaded = () => {
    logEvent('photo_uploaded');
};

export const trackLanguageChanged = (params: { language: string }) => {
    logEvent('language_changed', {
        language: params.language,
    });
};

export const trackLogin = (params: { method: string }) => {
    logEvent('login', {
        method: params.method,
    });
};

export const trackSignup = (params: { method: string }) => {
    logEvent('sign_up', {
        method: params.method,
    });
};

export const trackAccountDeleted = () => {
    logEvent('account_deleted');
};
