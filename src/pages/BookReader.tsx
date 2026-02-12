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
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Background Music State
    const [isBgmPlaying, setIsBgmPlaying] = useState(true);
    const [bgmVolume] = useState(0.3);
    const bgmRef = useRef<HTMLAudioElement | null>(null);

    // Playback Speed State
    const [playbackRate, setPlaybackRate] = useState(0.9); // Default slow as requested

    // Free ambient music from Bensound (Creative Commons License)
    const BGM_URL = 'https://www.bensound.com/bensound-music/bensound-slowmotion.mp3';

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

    // Background music initialization
    useEffect(() => {
        const bgm = new Audio(BGM_URL);
        bgm.loop = true;
        bgm.volume = bgmVolume;
        bgmRef.current = bgm;

        // Auto-play with user interaction handling
        const attemptPlay = () => {
            bgm.play().catch(e => {
            });
        };

        if (isBgmPlaying) {
            attemptPlay();
        }

        // Cleanup on unmount
        return () => {
            bgm.pause();
            bgm.src = '';
            bgmRef.current = null;
        };
    }, []);

    // Toggle BGM
    const toggleBgm = () => {
        if (!bgmRef.current) return;
        if (isBgmPlaying) {
            bgmRef.current.pause();
        } else {
            bgmRef.current.play();
        }
        setIsBgmPlaying(!isBgmPlaying);
    };

    // Update BGM volume
    useEffect(() => {
        if (bgmRef.current) {
            bgmRef.current.volume = bgmVolume;
        }
    }, [bgmVolume]);

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
            const translatedVoiceKey = `default_${targetLanguage}`;
            const cachedTranslatedAudioUrl = currentPage.audioUrls?.[translatedVoiceKey];

            if (cachedTranslatedAudioUrl) {
                // Use cached translated audio (Network fetch required)
                const audio = new Audio(cachedTranslatedAudioUrl);
                setupAudio(audio, requestId);
                return;
            }

            // No cache - generate fresh TTS for the translated text
            setIsAudioLoading(true);
            try {
                const generatedUrl = await generateSpeech(displayText, selectedVoiceId || undefined);
                // Double check cancellation after await generateSpeech
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

        const audioUrl = currentPage.audioUrls?.[voiceKey] || currentPage.audioUrls?.default || currentPage.audioUrl;

        if (audioUrl) {
            // Use existing (pre-generated) audio for selected voice
            const audio = new Audio(audioUrl);
            setupAudio(audio, requestId);
            return;
        }

        // No cached audio - generate TTS with selected voice
        setIsAudioLoading(true);
        try {
            const generatedUrl = await generateSpeech(displayText, selectedVoiceId || undefined);
            // Double check cancellation after await generateSpeech
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
            playAudio();
        }
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
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
            </div>

            {/* Top Left: Home */}
            <button
                onClick={() => navigate('/library')}
                className="absolute top-6 left-6 z-50 bg-white/20 hover:bg-white/30 backdrop-blur-md p-3 rounded-full text-white transition-all"
                aria-label={t('return_to_library')}
            >
                <Home size={24} />
            </button>

            {/* Top Right: Speed Toggle */}
            <button
                onClick={toggleSpeed}
                className="absolute top-6 right-20 z-50 backdrop-blur-md px-3 py-2 rounded-full text-white transition-all bg-white/20 hover:bg-white/30 flex items-center gap-1 font-bold text-sm"
                title="Playback Speed"
            >
                <Gauge size={16} />
                <span>{playbackRate.toFixed(1)}x</span>
            </button>

            {/* Top Right: BGM Toggle */}
            <button
                onClick={toggleBgm}
                className={`absolute top-6 right-6 z-50 backdrop-blur-md p-3 rounded-full text-white transition-all ${isBgmPlaying ? 'bg-purple-500/60 hover:bg-purple-500/80' : 'bg-white/20 hover:bg-white/30'}`}
                aria-label={isBgmPlaying ? t('bgm_on') : t('bgm_off')}
                title={isBgmPlaying ? t('bgm_on') : t('bgm_off')}
            >
                {isBgmPlaying ? <Music size={24} /> : <VolumeX size={24} />}
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
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full flex items-center gap-6 text-white border border-white/10">

                    <button
                        onClick={togglePlay}
                        disabled={isAudioLoading}
                        className="hover:text-yellow-400 transition-colors disabled:opacity-50"
                        aria-label={isPlaying ? "Pause" : "Play"}
                    >
                        {isAudioLoading ? (
                            <Loader size={24} className="animate-spin" />
                        ) : isPlaying ? (
                            <Pause size={24} fill="currentColor" />
                        ) : (
                            <Play size={24} fill="currentColor" />
                        )}
                    </button>
                    <div className="h-1 w-24 bg-gray-600 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-yellow-400 transition-all duration-[200ms]"
                            style={{ width: isPlaying ? '100%' : '0%' }}
                        />
                    </div>
                    <Volume2 size={20} className="text-gray-400" />
                </div>
            )}

            {/* Navigation Arrows */}
            {pageIndex > 0 && (
                <button
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-4 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all"
                    aria-label="Previous Page"
                >
                    <ArrowLeft size={48} />
                </button>
            )}

            {!isLastPage && (
                <button
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-4 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all"
                    aria-label="Next Page"
                >
                    <ArrowRight size={48} />
                </button>
            )}

            {/* Text Overlay */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl z-40 text-center">
                <div className="bg-black/60 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl">
                    <p className="text-xl md:text-3xl font-medium text-white leading-relaxed font-serif drop-shadow-md">
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
                    <p className="text-xs text-gray-400 mt-4 uppercase tracking-widest">
                        {t('page_of', { current: String(pageIndex + 1), total: String(book.pages.length) })}
                    </p>
                </div>
            </div>


        </div>
    );
};
