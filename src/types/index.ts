export interface UserProfile {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    preferredLanguage?: string;
}

export interface Book {
    id: string;
    title: string;
    authorId: string;
    coverUrl: string;
    createdAt: number;
    description?: string;
    style?: string; // e.g., "watercolor", "cartoon"
    originalLanguage?: string; // Language the book was originally written in
}

export interface Page {
    pageNumber: number;
    text: string;
    imageUrl: string;
    audioUrl?: string;  // Legacy: single audio (for backward compatibility)
    audioUrls?: {       // New: audio per voice
        default?: string;              // Default voice (Brian)
        [voiceId: string]: string | undefined;  // Custom voices by ID
    };
}

export interface SavedVoice {
    id: string;              // ElevenLabs voice ID
    name: string;            // User-given name (e.g., "Mom", "Dad")
    createdAt: number;       // Timestamp
    userId: string;          // Owner
    sampleUrl?: string;      // URL to the original recording sample (for re-sync)
}

export interface Recording {
    id: string;
    bookId: string;
    userId: string;
    name: string;
    audioUrl: string;
}

// Re-export draft types
export type { DraftBook, DraftPage } from './draft';

