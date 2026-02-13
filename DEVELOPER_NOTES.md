# StoryForest MVP - Developer Notes

## Project Overview
StoryForest is an interactive AI-powered storybook application for children. It allows users to:
1.  **Read** stories with AI-generated audio (Audiobooks).
2.  **Translate** stories into multiple languages (Korean, English, Japanese, Chinese) on the fly.
3.  **Clone** their own voice (or parents' voices) to read the stories.
4.  **Record** their own narration for each book.

## Tech Stack
-   **Frontend**: React (Vite), TypeScript, Tailwind CSS, Framer Motion
-   **State Management**: Zustand (`src/store`)
-   **Backend / DB**: Firebase (Firestore, Storage, Auth)
-   **AI Services**:
    -   **TTS & Voice Cloning**: ElevenLabs API
    -   **Translation**: Google Gemini API

## Key Architectures

### 1. Audio Generation & Voice Cloning
The app uses a **Background Generation** pattern to handle long-running TTS tasks without freezing the UI.
-   **Component**: `src/components/BackgroundAudioGenerator.tsx`
-   **Logic**:
    -   When a user selects a voice or opens a book, a task is added to the `pendingTasks` queue in the Zustand store.
    -   The generator processes books page-by-page, calling ElevenLabs API.
    -   Generated audio is uploaded to **Firebase Storage** and the URL is saved to Firestore (`books/{bookId}/pages/{pageId}`).
    -   **Optimization**: To save ElevenLabs voice slots, we clone the voice -> generate all audio -> **delete the voice from ElevenLabs immediately**. The original voice sample is kept in Firebase Storage for future re-cloning if needed.

### 2. Audio Playback Strategy (`BookReader.tsx`)
-   **Pre-generation**: The app prioritizes playing pre-generated audio files from Firebase Storage.
-   **On-the-fly Fallback**: If using the default voice (Brian) and no file exists, it generates audio on the fly.
-   **Custom Voices**: For custom voices, we **require** pre-generation. If audio isn't ready, the UI prompts the user to wait or listen to the default voice. This prevents wasting API quota on unoptimized single-page generations.

### 3. User Recording vs AI Audio
-   **Two Modes**:
    -   **AI Audiobook**: Uses ElevenLabs TTS.
    -   **User Recording**: Users can record themselves reading page-by-page.
-   **Data Storage**:
    -   AI Audio: Stored in `audioUrls` map in Firestore (keyed by voice ID).
    -   User Audio: Stored in the legacy `audioUrl` field (backward compatibility) or prioritized logic in `BookReader`.

### 4. Translation System
-   **Service**: `src/services/geminiService.ts`
-   **Caching**: Translations are cached in Firestore (`translations` collection) to minimize API costs and latency.
-   **UI**: `BookDetailModal` checks for cached translations before calling the API.

## Key Files for Review
-   `src/pages/BookReader.tsx`: Core reading experience. Handles audio playback, recording, and page navigation.
-   `src/components/BookDetailModal.tsx`: Entry point for books. Handles translation setup and "Record" vs "Listen" buttons.
-   `src/components/BackgroundAudioGenerator.tsx`: The worker component that manages the global audio generation queue.
-   `src/services/bookService.ts`: Firebase interactions for books and pages.
-   `src/store/index.ts`: Global state definition.

## Environment Variables
Ensure `.env` contains:
-   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc.
-   `VITE_ELEVENLABS_API_KEY`
-   `VITE_GEMINI_API_KEY`
