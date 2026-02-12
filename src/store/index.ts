import { create } from 'zustand';
import type { UserProfile } from '../types';

export interface BackgroundTask {
    bookId?: string;
    voiceId: string;
    type: 'all' | 'single' | 'single-reclone';
    savedVoiceId?: string; // For re-clone: the Firestore voice doc ID with stored sample
}

interface AppState {
    user: UserProfile | null;
    isLoading: boolean;

    // Background generation state (Audio)
    isGenerating: boolean;
    generationProgress: {
        bookTitle: string;
        currentPage: number;
        totalPages: number;
    } | null;
    pendingTasks: BackgroundTask[];

    // Background translation state
    isTranslatingBooks: boolean;
    translationProgress: { current: number; total: number } | null;

    targetLanguage: string | null;
    setTargetLanguage: (lang: string) => Promise<void>;

    // Translation cache: Record<bookId, Record<language, TranslatedContent>>
    translationCache: Record<string, Record<string, { title: string; description: string; pages: Record<number, string> }>>;
    setTranslatedBook: (bookId: string, lang: string, data: { title: string; description: string; pages: Record<number, string> }) => void;

    setUser: (user: UserProfile | null) => void;
    setLoading: (loading: boolean) => void;

    // Actions
    addBackgroundTask: (task: BackgroundTask) => void;
    setGenerationProgress: (progress: AppState['generationProgress']) => void;
    setGenerating: (generating: boolean) => void;
    popBackgroundTask: () => BackgroundTask | undefined;
}

export const useStore = create<AppState>((set: (fn: (state: AppState) => Partial<AppState>) => void, get: () => AppState) => ({
    user: null,
    isLoading: true,

    isGenerating: false,
    generationProgress: null,
    pendingTasks: [],

    isTranslatingBooks: false,
    translationProgress: null,

    targetLanguage: 'English',
    setTargetLanguage: async (lang: string) => {
        const { user } = get();
        if (user) {
            const { saveUserSettings } = await import('../services/userService');
            await saveUserSettings(user.uid, { preferredLanguage: lang });
        }
        // Track language change
        const { trackLanguageChanged } = await import('../services/analyticsService');
        trackLanguageChanged({ language: lang });
        set({ targetLanguage: lang, isTranslatingBooks: true });

        // Trigger background translation for all books
        const { translateAllBooks } = await import('../services/translationService');
        translateAllBooks(lang, (current, total) => {
            set({ translationProgress: { current, total } });
            if (current === total) set({ isTranslatingBooks: false, translationProgress: null });
        });
    },

    translationCache: {},
    setTranslatedBook: (bookId: string, lang: string, data: { title: string; description: string; pages: Record<number, string> }) => set((state: AppState) => ({
        translationCache: {
            ...state.translationCache,
            [bookId]: {
                ...(state.translationCache[bookId] || {}),
                [lang]: data
            }
        }
    })),

    setUser: (user: UserProfile | null) => set({ user }),
    setLoading: (loading: boolean) => set({ isLoading: loading }),

    addBackgroundTask: (task: BackgroundTask) => set((state: AppState) => ({
        pendingTasks: [...state.pendingTasks, task]
    })),

    setGenerationProgress: (progress: AppState['generationProgress']) => set({ generationProgress: progress }),

    setGenerating: (generating: boolean) => set({ isGenerating: generating }),

    popBackgroundTask: () => {
        const { pendingTasks } = get();
        if (pendingTasks.length === 0) return undefined;
        const task = pendingTasks[0];
        set({ pendingTasks: pendingTasks.slice(1) });
        return task;
    }
}));
