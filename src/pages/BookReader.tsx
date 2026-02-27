import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Home, Play, Pause, Volume2, Loader, Mic, Square, Save, PlayCircle, Trash2, Music, VolumeX, Gauge } from 'lucide-react';
import { getBookById } from '../services/bookService';
import { generateSpeech } from '../services/elevenLabsService';
import { getSelectedVoice } from '../services/voiceService';
import { useStore } from '../store';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { Book, Page } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { detectLanguage, cleanTranslatedText } from '../utils/textUtils';
import { getBgmFilePath, DEFAULT_BGM_ID } from '../constants/bgm';

export const BookReader: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const mode = searchParams.get('mode'); // 'read' or 'listen'
    const navigate = useNavigate();

    const [book, setBook] = useState<(Book & { pages: Page[] }) | null>(null);
    const [pageIndex, setPageIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
    const { targetLanguage, translationCache, setTranslatedBook } = useStore();
    const user = useStore((state) => state.user);
    const { t } = useTranslation();


    // Audio State
    const [isPlaying, setIsPlaying] = useState(mode === 'listen');
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [customVoiceNotReady, setCustomVoiceNotReady] = useState(false);
    const useDefaultFallbackRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Background Music State
    const [isBgmPlaying, setIsBgmPlaying] = useState(false);
    const bgmContextRef = useRef<AudioContext | null>(null);
    const bgmGainRef = useRef<GainNode | null>(null);
    const bgmTimerRef = useRef<number | null>(null);
    const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
    const bgmModeRef = useRef<'file' | 'synth' | null>(null);

    // Playback Speed State
    const [playbackRate, setPlaybackRate] = useState(0.9); // Default slow as requested

    // Update voice playback rate dynamically
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    const toggleSpeed = () => {
        // Cycle: 0.8 -> 0.9 -> 1.0 -> 1.2 -> 0.8
        setPlaybackRate(prev => {
            if (prev === 0.8) return 0.9;
            if (prev === 0.9) return 1.0;
            if (prev === 1.0) return 1.2;
            return 0.8;
        });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setRecordedBlob(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Cannot access microphone. Please allow permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const playPreview = () => {
        if (recordedBlob) {
            const url = URL.createObjectURL(recordedBlob);
            const audio = new Audio(url);
            audio.playbackRate = playbackRate; // Apply rate to preview too
            audio.play();
        }
    };

    const saveRecording = async () => {
        if (!recordedBlob || !book) return;
        try {
            // Show loading indicator manually or reuse isAudioLoading
            setIsAudioLoading(true); // Reusing this for loading UI
            const currentPage = book.pages[pageIndex];
            const path = `books/${book.id}/pages/${currentPage.pageNumber}_user_audio.webm`;
            const storageRef = ref(storage, path);

            await uploadBytes(storageRef, recordedBlob);
            const url = await getDownloadURL(storageRef);

            // Save to Firestore (Overwrite audioUrl)
            const pageRef = doc(db, 'books', book.id, 'pages', String(currentPage.pageNumber));
            await updateDoc(pageRef, {
                audioUrl: url
            });

            // Update local state to reflect change
            const updatedPages = [...book.pages];
            updatedPages[pageIndex] = { ...updatedPages[pageIndex], audioUrl: url };
            setBook({ ...book, pages: updatedPages });

            alert('Recording saved! It will now play in Listen Mode.');
            setRecordedBlob(null);
        } catch (e) {
            console.error(e);
            alert('Failed to save recording');
        } finally {
            setIsAudioLoading(false);
        }
    };

    // Load translation if targetLanguage is set
    useEffect(() => {
        if (!id || !targetLanguage || targetLanguage === 'English') return;

        const loadTranslation = async () => {
            const { getCachedTranslation } = await import('../services/translationService');
            const data = await getCachedTranslation(id, targetLanguage);
            if (data) {
                setTranslatedBook(id, targetLanguage, data);
            }
        };

        loadTranslation();
    }, [id, targetLanguage, setTranslatedBook]);

    // ── BGM: use book's selected bgmId, fallback to synthesized music-box ──

    // Try to start BGM from /bgm/{bgmId}.mp3 file
    const startFileBgm = (): Promise<boolean> => {
        const bgmId = book?.bgmId || DEFAULT_BGM_ID;
        if (bgmId === 'none') return Promise.resolve(true); // No BGM wanted

        const filePath = getBgmFilePath(bgmId);
        if (!filePath) return Promise.resolve(false); // No file for this preset → synth

        return new Promise((resolve) => {
            fetch(filePath, { method: 'HEAD' })
                .then((res) => {
                    if (!res.ok) {
                        resolve(false);
                        return;
                    }
                    const audio = new Audio(filePath);
                    audio.loop = true;
                    audio.volume = 0.25;
                    bgmAudioRef.current = audio;
                    bgmModeRef.current = 'file';

                    audio.play()
                        .then(() => resolve(true))
                        .catch(() => resolve(true)); // Autoplay blocked but ref is set
                })
                .catch(() => resolve(false));
        });
    };

    // Synthesized music-box fallback (Web Audio API)
    const startSynthBgm = () => {
        if (bgmContextRef.current) return;

        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        bgmContextRef.current = ctx;
        bgmModeRef.current = 'synth';

        const master = ctx.createGain();
        master.gain.value = 0.18;
        master.connect(ctx.destination);
        bgmGainRef.current = master;

        const noteFreq = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

        const playBell = (freq: number, time: number, dur: number, vol: number) => {
            const o1 = ctx.createOscillator();
            const o2 = ctx.createOscillator();
            o1.type = 'sine';
            o2.type = 'triangle';
            o1.frequency.value = freq;
            o2.frequency.value = freq * 2;
            o2.detune.value = 3;
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(vol, time + 0.01);
            env.gain.exponentialRampToValueAtTime(0.001, time + dur);
            const mix = ctx.createGain();
            mix.gain.value = 0.5;
            o1.connect(env); o2.connect(mix); mix.connect(env); env.connect(master);
            o1.start(time); o2.start(time); o1.stop(time + dur); o2.stop(time + dur);
        };

        const playPad = (notes: number[], time: number, dur: number, vol: number) => {
            notes.forEach((midi, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = noteFreq(midi);
                osc.detune.value = (i - 1) * 4;
                const env = ctx.createGain();
                env.gain.setValueAtTime(0, time);
                env.gain.linearRampToValueAtTime(vol, time + 0.4);
                env.gain.setValueAtTime(vol, time + dur - 0.5);
                env.gain.linearRampToValueAtTime(0, time + dur);
                osc.connect(env); env.connect(master);
                osc.start(time); osc.stop(time + dur + 0.1);
            });
        };

        const melody = [
            { n: 72, t: 0.0 }, { n: 76, t: 0.4 }, { n: 79, t: 0.8 }, { n: 84, t: 1.2 },
            { n: 81, t: 1.8 }, { n: 79, t: 2.2 }, { n: 76, t: 2.6 }, { n: 79, t: 3.0 },
            { n: 84, t: 3.6 }, { n: 81, t: 4.0 }, { n: 79, t: 4.4 }, { n: 76, t: 4.8 },
            { n: 74, t: 5.4 }, { n: 76, t: 5.8 }, { n: 72, t: 6.2 },
            { n: 79, t: 7.2 }, { n: 81, t: 7.6 }, { n: 84, t: 8.0 }, { n: 81, t: 8.6 },
            { n: 76, t: 9.0 }, { n: 79, t: 9.3 }, { n: 84, t: 9.6 }, { n: 79, t: 10.0 },
            { n: 81, t: 10.6 }, { n: 79, t: 11.0 }, { n: 76, t: 11.4 }, { n: 74, t: 11.8 },
            { n: 72, t: 12.4 }, { n: 76, t: 12.8 }, { n: 72, t: 13.4 },
        ];
        const LOOP_DURATION = 14.4;
        const padChords = [
            { notes: [48, 55, 60, 64], t: 0, dur: 7.2 },
            { notes: [53, 57, 60, 65], t: 7.2, dur: 7.2 },
        ];

        const scheduleLoop = (startTime: number) => {
            melody.forEach(({ n, t }) => playBell(noteFreq(n), startTime + t, 1.2, 0.35));
            padChords.forEach(({ notes, t, dur }) => playPad(notes, startTime + t, dur, 0.06));
        };

        let nextLoopTime = ctx.currentTime + 0.05;
        scheduleLoop(nextLoopTime);
        scheduleLoop(nextLoopTime + LOOP_DURATION);
        nextLoopTime += LOOP_DURATION * 2;

        const scheduleAhead = () => {
            if (!bgmContextRef.current) return;
            const now = bgmContextRef.current.currentTime;
            while (nextLoopTime < now + LOOP_DURATION * 2) {
                scheduleLoop(nextLoopTime);
                nextLoopTime += LOOP_DURATION;
            }
            bgmTimerRef.current = window.setTimeout(scheduleAhead, 10000);
        };
        bgmTimerRef.current = window.setTimeout(scheduleAhead, 10000);
    };

    // Unified start: try file first, then synth
    const startBgm = async () => {
        if (bgmAudioRef.current || bgmContextRef.current) return;
        const bgmId = book?.bgmId || DEFAULT_BGM_ID;
        if (bgmId === 'none') return; // User chose no BGM

        const fileOk = await startFileBgm();
        if (!fileOk) {
            startSynthBgm();
        }
    };

    const stopBgm = () => {
        // Stop file-based BGM
        if (bgmAudioRef.current) {
            bgmAudioRef.current.pause();
            bgmAudioRef.current.src = '';
            bgmAudioRef.current = null;
        }
        // Stop synth-based BGM
        if (bgmTimerRef.current) {
            clearTimeout(bgmTimerRef.current);
            bgmTimerRef.current = null;
        }
        if (bgmContextRef.current) {
            bgmContextRef.current.close().catch(() => {});
            bgmContextRef.current = null;
        }
        bgmGainRef.current = null;
        bgmModeRef.current = null;
    };

    // Auto-play BGM on mount; if blocked by browser, start on first user interaction
    useEffect(() => {
        let removed = false;

        const tryAutoPlay = async () => {
            if (bgmAudioRef.current || bgmContextRef.current) return;
            await startBgm();

            // Check if playing (file mode)
            if (bgmAudioRef.current && !bgmAudioRef.current.paused) {
                setIsBgmPlaying(true);
                return;
            }
            // Check if playing (synth mode)
            const ctx = bgmContextRef.current;
            if (ctx && ctx.state === 'running') {
                setIsBgmPlaying(true);
                return;
            }

            // Autoplay blocked → wait for user gesture
            const onGesture = () => {
                if (bgmAudioRef.current) {
                    bgmAudioRef.current.play().then(() => setIsBgmPlaying(true)).catch(() => {});
                } else if (bgmContextRef.current && bgmContextRef.current.state !== 'running') {
                    bgmContextRef.current.resume().then(() => setIsBgmPlaying(true)).catch(() => {});
                } else if (!bgmContextRef.current && !bgmAudioRef.current) {
                    startBgm().then(() => setIsBgmPlaying(true));
                }
                doCleanup();
            };
            const doCleanup = () => {
                removed = true;
                document.removeEventListener('touchstart', onGesture);
                document.removeEventListener('click', onGesture);
            };
            document.addEventListener('touchstart', onGesture, { once: true });
            document.addEventListener('click', onGesture, { once: true });
        };

        tryAutoPlay();

        return () => {
            if (!removed) {
                document.removeEventListener('touchstart', () => {});
                document.removeEventListener('click', () => {});
            }
            stopBgm();
        };
    }, []);

    // Toggle BGM - pause / resume
    const toggleBgm = () => {
        if (isBgmPlaying) {
            if (bgmAudioRef.current) {
                bgmAudioRef.current.pause();
            } else {
                stopBgm();
            }
            setIsBgmPlaying(false);
        } else {
            if (bgmAudioRef.current) {
                bgmAudioRef.current.play().catch(() => {});
            } else {
                startBgm();
            }
            setIsBgmPlaying(true);
        }
    };

    useEffect(() => {
        if (!id) return;
        const fetchBook = async () => {
            const data = await getBookById(id);
            if (data) {
                setBook(data);
            } else {
                console.error('[BookReader] Failed to load book');
                navigate('/library');
            }

            // Load user's selected voice
            if (user) {
                const voiceId = await getSelectedVoice(user.uid);
                setSelectedVoiceId(voiceId);
            }

            setLoading(false);
        };
        fetchBook();

        return () => {
            // Cleanup audio
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, [id, user]);


    // Translation is now handled globally in the store/Library/Modal

    const playRequestRef = useRef(0);
    const isMountedRef = useRef(true);

    // Track component mount status
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            // Force stop any playing audio on unmount
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Cleanup and Reset Audio on Page Change
    useEffect(() => {
        // Increment request ID to invalidate any pending async audio plays
        playRequestRef.current += 1;

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setIsPlaying(false);
        setCustomVoiceNotReady(false);

        // If in listen mode, auto-play with selected voice
        // Only play when we have the book and voice selection is ready (loading is done)
        if (mode === 'listen' && book && !loading) {
            const currentRequestId = playRequestRef.current;
            // Using a small timeout to allow state to settle
            setTimeout(() => {
                if (document.hasFocus() && currentRequestId === playRequestRef.current) {
                    playAudio(currentRequestId);
                }
            }, 500);
        }
    }, [pageIndex, book, loading, selectedVoiceId, mode]);

    const playAudio = async (requestId?: number) => {
        // If requestId is provided, ensure it matches the current request
        if (requestId !== undefined && requestId !== playRequestRef.current) {
            return;
        }

        if (!book) return;
        const currentPage = book.pages[pageIndex];

        // Use robust language detection
        const hasKorean = detectLanguage(currentPage.text) === 'Korean';
        const displayedOriginalLang = hasKorean ? 'Korean' : (book.originalLanguage || 'English');

        // Only use translated text if targetLanguage differs from original
        const needsTranslation = targetLanguage && targetLanguage !== displayedOriginalLang;

        // Get text to speak
        const cachedPages = needsTranslation ? translationCache[id!]?.[targetLanguage]?.pages : null;
        const rawText = cachedPages?.[currentPage.pageNumber] || currentPage.text;

        // Clean the text before speaking (remove "Translation:" prefixes etc)
        const displayText = cleanTranslatedText(rawText);

        if (audioRef.current) {
            // Resume if exists
            audioRef.current.play();
            setIsPlaying(true);
            return;
        }

        // Determine which audio to play based on selected voice
        const voiceKey = selectedVoiceId || 'default';
        const { determineVoiceKey, getPreloadedAudio } = await import('../services/audioPreloadService');

        // Double check cancellation after await import
        if (requestId !== undefined && requestId !== playRequestRef.current) return;

        // Use the consistent key logic
        const effectiveKey = determineVoiceKey(book, targetLanguage || 'English', selectedVoiceId || undefined);
        const preloadedUrl = getPreloadedAudio(book.id, currentPage.pageNumber, effectiveKey);

        if (!isMountedRef.current) return;

        if (preloadedUrl) {
            const audio = new Audio(preloadedUrl);
            setupAudio(audio, requestId);
            return;
        }

        // Only translate/use translated audio if targetLanguage differs from original
        if (needsTranslation) {
            // Only use cached translated audio if NO custom voice is selected
            if (!selectedVoiceId) {
                const translatedVoiceKey = `default_${targetLanguage}`;
                const cachedTranslatedAudioUrl = currentPage.audioUrls?.[translatedVoiceKey];

                if (cachedTranslatedAudioUrl) {
                    // Use cached translated audio (Network fetch required)
                    const audio = new Audio(cachedTranslatedAudioUrl);
                    setupAudio(audio, requestId);
                    return;
                }
            }

            // Custom voice selected but no cached audio
            if (selectedVoiceId && !useDefaultFallbackRef.current) {
                // console.log('[BookReader] Custom voice translated audio not yet generated for this page');
                setCustomVoiceNotReady(true);
                setIsPlaying(false);
                return;
            }

            // Default voice only: generate translated TTS on-the-fly
            setIsAudioLoading(true);
            try {
                const generatedUrl = await generateSpeech(displayText);
                if (requestId !== undefined && requestId !== playRequestRef.current) return;
                if (!isMountedRef.current) return;
                const audio = new Audio(generatedUrl);
                setupAudio(audio, requestId);
            } catch (error) {
                console.error('[BookReader] Translated TTS Error:', error);
                if (isMountedRef.current) alert('Failed to play translated audio.');
                setIsPlaying(false);
            } finally {
                if ((requestId === undefined || requestId === playRequestRef.current) && isMountedRef.current) {
                    setIsAudioLoading(false);
                }
            }
            return;
        }

        // CHECK: If user requested to listen to their own recording (voice=user)
        const voiceParam = searchParams.get('voice');
        if (voiceParam === 'user') {
            // Prioritize the direct audioUrl (legacy/user recording field)
            // User recordings are saved to `audioUrl` directly in saveRecording()
            if (currentPage.audioUrl) {
                const audio = new Audio(currentPage.audioUrl);
                setupAudio(audio, requestId);
                return;
            }
            // If no user recording found, alerting or falling back might be appropriate
            // For now, let's just log and fall through to AI fallback if desired, 
            // or return early to avoid playing AI voice unexpectedly.
            // console.log('[BookReader] User recording requested but not found for this page.');
            // Optional: alert('No recording found for this page.');
        }

        // If custom voice selected, only use audio cached for that exact voice
        // Don't fall back to default audio — generate TTS with the custom voice instead
        const audioUrl = selectedVoiceId
            ? currentPage.audioUrls?.[voiceKey]
            : (currentPage.audioUrls?.default || currentPage.audioUrl);

        if (audioUrl) {
            const audio = new Audio(audioUrl);
            setupAudio(audio, requestId);
            return;
        }

        // Custom voice selected but no pre-generated audio: show "not ready" message
        if (selectedVoiceId && !useDefaultFallbackRef.current) {
            // console.log('[BookReader] Custom voice audio not yet generated for this page');
            setCustomVoiceNotReady(true);
            setIsPlaying(false);
            return;
        }

        // Default voice only: generate TTS on-the-fly (doesn't consume custom voice slots)
        setIsAudioLoading(true);
        try {
            const generatedUrl = await generateSpeech(displayText);
            if (requestId !== undefined && requestId !== playRequestRef.current) return;
            if (!isMountedRef.current) return;
            const audio = new Audio(generatedUrl);
            setupAudio(audio, requestId);
        } catch (error) {
            console.error('[BookReader] TTS Error:', error);
            if (isMountedRef.current) alert('Failed to play audio. Please check your API key.');
            setIsPlaying(false);
        } finally {
            if ((requestId === undefined || requestId === playRequestRef.current) && isMountedRef.current) {
                setIsAudioLoading(false);
            }
        }
    };

    const setupAudio = (audio: HTMLAudioElement, requestId?: number) => {
        // If requestId is provided, ensure it matches the current request
        if (requestId !== undefined && requestId !== playRequestRef.current) {
            audio.pause(); // Stop the audio if it somehow started
            audio.src = ''; // Clear the source
            return;
        }

        audioRef.current = audio;
        audio.playbackRate = playbackRate; // Apply current rate
        audio.onended = () => {
            setIsPlaying(false);
            // Auto turn page?
            if (mode === 'listen' && pageIndex < book!.pages.length - 1) {
                setTimeout(() => setPageIndex(prev => prev + 1), 1000);
            }
        };
        audio.play().catch(e => {
            console.warn('Autoplay prevented:', e);
            setIsPlaying(false);
        });
        setIsPlaying(true);
    };

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            setCustomVoiceNotReady(false);
            playAudio();
        }
    };

    // Play with default voice when custom voice audio is not ready
    // Sets persistent flag so all subsequent pages also use default voice
    const playWithDefaultVoice = async () => {
        useDefaultFallbackRef.current = true;
        setCustomVoiceNotReady(false);
        playAudio();
    };

    // Auto-turn Logic for Listen Mode (Removed simple timer, relying on audio end)

    if (loading) return <div className="text-center p-20 text-white">{t('loading')}</div>;
    if (!book) return <div className="text-center p-20 text-white">Book not found in the forest!</div>;

    const currentPage = book.pages[pageIndex];
    const isLastPage = pageIndex === book.pages.length - 1;

    // Stop audio and reset when changing pages
    const stopCurrentAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setIsPlaying(false);
    };

    const handleNext = () => {
        if (!isLastPage) {
            stopCurrentAudio();
            setPageIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (pageIndex > 0) {
            stopCurrentAudio();
            setPageIndex(prev => prev - 1);
        }
    };

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src={currentPage.imageUrl}
                    alt={`Page ${currentPage.pageNumber}`}
                    className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 md:from-black/60 md:to-black/80" />
            </div>

            {/* Top Left: Home */}
            <button
                onClick={() => navigate('/library')}
                className="absolute top-3 left-3 md:top-6 md:left-6 z-50 bg-white/20 hover:bg-white/30 backdrop-blur-md p-1.5 md:p-3 rounded-full text-white transition-all"
                aria-label={t('return_to_library')}
            >
                <Home size={16} className="md:hidden" />
                <Home size={24} className="hidden md:block" />
            </button>

            {/* Top Right: Speed Toggle */}
            <button
                onClick={toggleSpeed}
                className="absolute top-3 right-14 md:top-6 md:right-20 z-50 backdrop-blur-md px-2 py-1 md:px-3 md:py-2 rounded-full text-white transition-all bg-white/20 hover:bg-white/30 flex items-center gap-0.5 md:gap-1 font-bold text-[10px] md:text-sm"
                title="Playback Speed"
            >
                <Gauge size={12} className="md:hidden" />
                <Gauge size={16} className="hidden md:block" />
                <span>{playbackRate.toFixed(1)}x</span>
            </button>

            {/* Top Right: BGM Toggle */}
            <button
                onClick={toggleBgm}
                className={`absolute top-3 right-3 md:top-6 md:right-6 z-50 backdrop-blur-md p-1.5 md:p-3 rounded-full text-white transition-all ${isBgmPlaying ? 'bg-purple-500/60 hover:bg-purple-500/80' : 'bg-white/20 hover:bg-white/30'}`}
                aria-label={isBgmPlaying ? t('bgm_on') : t('bgm_off')}
                title={isBgmPlaying ? t('bgm_on') : t('bgm_off')}
            >
                {isBgmPlaying ? <Music size={16} className="md:hidden" /> : <VolumeX size={16} className="md:hidden" />}
                {isBgmPlaying ? <Music size={24} className="hidden md:block" /> : <VolumeX size={24} className="hidden md:block" />}
            </button>

            {/* Audio Controls OR Recording Controls */}
            {mode === 'record' ? (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-6 text-white border border-red-500/50 shadow-2xl">
                    {/* Record/Stop Button */}
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`p-3 rounded-full transition-all shadow-lg ${isRecording ? 'bg-white text-red-600 animate-pulse scale-110' : 'bg-red-600 text-white hover:bg-red-500 hover:scale-105'}`}
                    >
                        {isRecording ? <Square size={24} fill="currentColor" /> : <Mic size={24} />}
                    </button>

                    {/* Status Text */}
                    <span className="font-mono text-sm tracking-widest text-red-100 font-bold w-24 text-center">
                        {isRecording ? 'RECORDING' : recordedBlob ? 'DONE' : 'READY'}
                    </span>

                    {/* Preview & Save */}
                    {recordedBlob && !isRecording && (
                        <div className="flex gap-3 animate-in fade-in slide-in-from-left duration-300">
                            <button onClick={playPreview} className="hover:text-green-400 hover:scale-110 transition-transform" title="Preview"><PlayCircle size={28} /></button>
                            <button onClick={() => setRecordedBlob(null)} className="hover:text-red-400 hover:scale-110 transition-transform" title="Delete"><Trash2 size={28} /></button>
                            <div className="w-px bg-white/20 h-6 my-auto mx-1"></div>
                            <button
                                onClick={saveRecording}
                                disabled={isAudioLoading}
                                className="bg-white text-red-900 px-4 py-1.5 rounded-full font-bold text-xs hover:bg-gray-100 flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                            >
                                {isAudioLoading ? <Loader size={14} className="animate-spin" /> : <Save size={14} />} SAVE
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-black/60 backdrop-blur-md px-3 py-1 md:px-6 md:py-2 rounded-full flex items-center gap-3 md:gap-6 text-white border border-white/10">

                    <button
                        onClick={togglePlay}
                        disabled={isAudioLoading}
                        className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                        aria-label={isPlaying ? "Pause" : "Play"}
                    >
                        {isAudioLoading ? (
                            <Loader size={18} className="animate-spin md:hidden" />
                        ) : isPlaying ? (
                            <Pause size={18} fill="currentColor" className="md:hidden" />
                        ) : (
                            <Play size={18} fill="currentColor" className="md:hidden" />
                        )}
                        {isAudioLoading ? (
                            <Loader size={24} className="animate-spin hidden md:block" />
                        ) : isPlaying ? (
                            <Pause size={24} fill="currentColor" className="hidden md:block" />
                        ) : (
                            <Play size={24} fill="currentColor" className="hidden md:block" />
                        )}
                    </button>
                    <div className="h-1 w-16 md:w-24 bg-gray-600 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-yellow-400 transition-all duration-[200ms]"
                            style={{ width: isPlaying ? '100%' : '0%' }}
                        />
                    </div>
                    <Volume2 size={14} className="text-gray-400 md:hidden" />
                    <Volume2 size={20} className="text-gray-400 hidden md:block" />
                </div>
            )}

            {/* Custom Voice Not Ready Banner */}
            {customVoiceNotReady && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top duration-300">
                    <div className="bg-amber-900/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-amber-500/30 shadow-xl text-center max-w-xs">
                        <p className="text-amber-100 text-sm font-medium mb-2">
                            {t('custom_voice_generating')}
                        </p>
                        <button
                            onClick={playWithDefaultVoice}
                            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-full transition-all active:scale-95"
                        >
                            🎧 {t('listen_default_voice')}
                        </button>
                    </div>
                </div>
            )}

            {/* Navigation Arrows */}
            {pageIndex > 0 && (
                <button
                    onClick={handlePrev}
                    className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-40 p-2 md:p-4 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
                    aria-label="Previous Page"
                >
                    <ArrowLeft size={28} className="md:hidden" />
                    <ArrowLeft size={48} className="hidden md:block" />
                </button>
            )}

            {!isLastPage && (
                <button
                    onClick={handleNext}
                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-40 p-2 md:p-4 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
                    aria-label="Next Page"
                >
                    <ArrowRight size={28} className="md:hidden" />
                    <ArrowRight size={48} className="hidden md:block" />
                </button>
            )}

            {/* Text Overlay */}
            <div className="absolute bottom-2 md:bottom-12 left-1/2 -translate-x-1/2 w-[88%] md:w-[92%] max-w-3xl z-40 text-center">
                <div className="bg-black/50 backdrop-blur-sm p-2.5 md:p-8 rounded-xl md:rounded-3xl border border-white/10 shadow-2xl">
                    <p className="text-xs md:text-xl lg:text-3xl font-medium text-white leading-snug md:leading-relaxed font-serif drop-shadow-md">
                        {(() => {
                            // Robust Language Detection
                            // If the text contains Korean characters, assume it is Korean regardless of metadata
                            const hasKorean = detectLanguage(currentPage.text) === 'Korean';
                            const displayedOriginalLang = hasKorean ? 'Korean' : (book.originalLanguage || 'English');

                            const needsTranslation = targetLanguage && targetLanguage !== displayedOriginalLang;
                            let text = currentPage.text;

                            if (needsTranslation) {
                                text = translationCache[id!]?.[targetLanguage]?.pages?.[currentPage.pageNumber] || text;
                            }

                            return cleanTranslatedText(text);
                        })()}
                    </p>
                    <p className="text-[8px] md:text-xs text-gray-400 mt-1 md:mt-4 uppercase tracking-wider md:tracking-widest">
                        {t('page_of', { current: String(pageIndex + 1), total: String(book.pages.length) })}
                    </p>
                </div>
            </div>


        </div>
    );
};
