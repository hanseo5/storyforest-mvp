import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useStore } from './store';
import { Login } from './pages/Login';
import { logPageView, setAnalyticsUser, setAnalyticsUserProperties } from './services/analyticsService';

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
import { ToastContainer } from './components/Toast';

// Track page views on route changes
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    const pathMap: Record<string, string> = {
      '/': 'Home',
      '/welcome': 'Welcome',
      '/library': 'Library',
      '/create': 'Create Story',
      '/generating': 'Story Generating',
      '/preview': 'Story Preview',
      '/editor/metadata': 'Metadata Editor',
      '/editor/story': 'Story Editor',
      '/editor/cover': 'Cover Editor',
    };
    const pageName = pathMap[location.pathname] || (location.pathname.startsWith('/read/') ? 'Book Reader' : location.pathname);
    logPageView(pageName, location.pathname);
  }, [location.pathname]);
  return null;
}

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
      try {
        if (firebaseUser) {
          // Email/password users must verify email before entering the app
          const isEmailAuth = firebaseUser.providerData.some(p => p.providerId === 'password');
          if (isEmailAuth && !firebaseUser.emailVerified) {
            // Don't set user — Login.tsx handles the verification flow
            // Login.tsx will call signOut after sending verification email
            setLoading(false);
            return;
          }

          const { getUserSettings } = await import('./services/userService');
          const settings = await getUserSettings(firebaseUser.uid);

        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          preferredLanguage: settings?.preferredLanguage,
        });

        // Set analytics user
        setAnalyticsUser(firebaseUser.uid);
        if (settings?.preferredLanguage) {
          setAnalyticsUserProperties({ preferred_language: settings.preferredLanguage });
        }

        // Ensure email is saved in Firestore (for admin lookup)
        if (firebaseUser.email && !settings?.email) {
          const { saveUserSettings } = await import('./services/userService');
          await saveUserSettings(firebaseUser.uid, { email: firebaseUser.email });
        }

        // Register admin via secure Cloud Function (server verifies email)
        if (firebaseUser.email) {
          const { isAdminUser } = await import('./constants/admin');
          if (isAdminUser(firebaseUser.email)) {
            try {
              const { registerAdminLoginSecure } = await import('./services/cloudFunctionsService');
              await registerAdminLoginSecure();
            } catch (adminErr) {
              console.warn('[App] Admin registration CF failed (non-critical):', adminErr);
            }
          }
        }

        // Sync language to server if needed
        if (hasLanguage && targetLanguage && !settings?.preferredLanguage) {
          const { saveUserSettings } = await import('./services/userService');
          await saveUserSettings(firebaseUser.uid, { preferredLanguage: targetLanguage });
        }
      } else {
        setUser(null);
      }
      } catch (err) {
        console.error('[App] Auth state error:', err);
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
        <RouteTracker />
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    );
  }



  // LOGGED IN → Show App
  return (
    <BrowserRouter>
      <RouteTracker />
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
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
