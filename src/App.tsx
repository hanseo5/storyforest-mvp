import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useStore } from './store';
import { Login } from './pages/Login';

import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { CreateStory } from './pages/CreateStory';
import { BookReader } from './pages/BookReader';
import { MetadataEditor } from './pages/MetadataEditor';
import { StoryEditor } from './pages/StoryEditor';
import { CoverEditor } from './pages/CoverEditor';
import { AudioPreloadScreen } from './pages/AudioPreloadScreen';
import { LanguageSelection } from './pages/LanguageSelection';
import { StoryGenerating } from './pages/StoryGenerating';
import { StoryPreview } from './pages/StoryPreview';

import { BackgroundAudioGenerator } from './components/BackgroundAudioGenerator';

function App() {
  const { setUser, setLoading, isLoading, user, setTargetLanguage, targetLanguage } = useStore();
  const [hasLanguage, setHasLanguage] = useState<boolean | null>(null);

  // Check if user has visited before (for split screen skipping)
  const [hasVisited] = useState(() => !!localStorage.getItem('storyforest_visited'));

  // Step 1: Check localStorage for language FIRST (before anything else)
  useEffect(() => {
    const savedLang = localStorage.getItem('storyforest_lang');
    if (savedLang) {
      setTargetLanguage(savedLang);
      setHasLanguage(true);
    } else {
      setHasLanguage(false);
    }
  }, [setTargetLanguage]);

  // Step 2: Handle Firebase auth (only after language check)
  useEffect(() => {
    if (hasLanguage === null) return; // Wait for language check

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        const { getUserSettings } = await import('./services/userService');
        const settings = await getUserSettings(firebaseUser.uid);

        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          preferredLanguage: settings?.preferredLanguage,
        });

        // Sync language to server if needed
        if (hasLanguage && targetLanguage && !settings?.preferredLanguage) {
          const { saveUserSettings } = await import('./services/userService');
          await saveUserSettings(firebaseUser.uid, { preferredLanguage: targetLanguage });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading, hasLanguage, targetLanguage]);

  // Handle language selection
  const handleLanguageSelected = (lang: string) => {
    localStorage.setItem('storyforest_lang', lang);
    setTargetLanguage(lang);
    setHasLanguage(true);
  };

  // Loading: Checking language from localStorage
  if (hasLanguage === null) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">Loading...</div>;
  }

  // NO LANGUAGE → Show Language Selection FIRST (even before login check)
  if (!hasLanguage) {
    return <LanguageSelection onLanguageSelected={handleLanguageSelected} />;
  }

  // Loading: Checking Firebase auth
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // NOT LOGGED IN → Show Login
  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    );
  }



  // LOGGED IN → Show App
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" />} />
        <Route
          path="/"
          element={hasVisited ? <Navigate to="/library" /> : <Navigate to="/welcome" />}
        />
        <Route path="/welcome" element={<Home />} />
        <Route path="/preload" element={<AudioPreloadScreen />} />
        <Route path="/library" element={<Library />} />
        <Route path="/create" element={<CreateStory />} />
        <Route path="/generating" element={<StoryGenerating />} />
        <Route path="/preview" element={<StoryPreview />} />
        <Route path="/editor/metadata" element={<MetadataEditor />} />
        <Route path="/editor/story" element={<StoryEditor />} />
        <Route path="/editor/cover" element={<CoverEditor />} />
        <Route path="/read/:id" element={<BookReader />} />
      </Routes>

      {/* Background Audio Generation Progress */}
      <BackgroundAudioGenerator />
    </BrowserRouter>
  );
}

export default App;
