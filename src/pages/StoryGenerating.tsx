/* eslint-disable react-hooks/rules-of-hooks -- Math.random for animation initial positions is acceptable */
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BookOpen, Image as ImageIcon, Feather, Star, Palette } from 'lucide-react';
import { generateCompleteStory, generatePhotoBasedStory } from '../services/geminiService';
import {
    createGenerationId,
    savePendingGeneration,
    getPendingGeneration,
    clearPendingGeneration,
    listenToGeneration,
    type GenerationProgress,
    type GeneratedStory,
} from '../services/cloudFunctionsService';
import type { StoryVariables } from '../types/draft';
import owlImage from '../assets/mascots/owl.png';
import { useTranslation } from '../hooks/useTranslation';
import { useStore } from '../store';

// Owl message keys for translation
const OWL_MESSAGE_KEYS = {
    text: [
        'gen_owl_text_1',
        'gen_owl_text_2',
        'gen_owl_text_3',
        'gen_owl_text_4'
    ],
    images: [
        'gen_owl_images_1',
        'gen_owl_images_2',
        'gen_owl_images_3',
        'gen_owl_images_4'
    ],
    complete: [
        'gen_owl_complete_1',
        'gen_owl_complete_2'
    ]
};

export const StoryGenerating: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { targetLanguage } = useStore();
    const state = location.state as {
        variables: StoryVariables;
        photoBase64?: string;
        photoMimeType?: string;
        photoDescription?: string;
        isPhotoBased?: boolean;
    } | null;

    const [phase, setPhase] = useState<'text' | 'images' | 'complete'>('text');
    const [progress, setProgress] = useState(0);
    const [pageProgress, setPageProgress] = useState({ current: 0, total: 12 });
    const [statusMessage, setStatusMessage] = useState(t('gen_writing_story'));
    const [owlMessageKey, setOwlMessageKey] = useState(OWL_MESSAGE_KEYS.text[0]);

    const isGenerating = useRef(false);
    const generationIdRef = useRef<string | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const httpCompletedRef = useRef(false);

    // Pre-compute sparkle stars for complete phase (must be called unconditionally)
    const completeSparkles = useMemo(() => {
        return [...Array(6)].map((_, i) => {
            const left = 20 + Math.random() * 60;
            const top = 10 + Math.random() * 60;
            const color = ['#facc15', '#f472b6', '#60a5fa'][i % 3];
            return { left, top, color };
        });
    }, []);

    // Update owl message based on phase
    useEffect(() => {
        const keys = OWL_MESSAGE_KEYS[phase];
        let index = 0;
        setOwlMessageKey(keys[0]); // Reset to first message of new phase

        const interval = setInterval(() => {
            index = (index + 1) % keys.length;
            setOwlMessageKey(keys[index]);
        }, 3000);
        return () => clearInterval(interval);
    }, [phase]);

    // Navigate to preview with the generated story
    const navigateToPreview = useCallback((story: GeneratedStory, variables: StoryVariables) => {
        clearPendingGeneration();
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }
        setPhase('complete');
        setProgress(100);
        setStatusMessage(t('gen_complete'));
        setTimeout(() => {
            navigate('/preview', { state: { story, variables } });
        }, 800);
    }, [navigate, t]);

    // Set up Firestore listener for background recovery
    const setupFirestoreListener = useCallback((genId: string, variables: StoryVariables) => {
        if (unsubscribeRef.current) unsubscribeRef.current();

        unsubscribeRef.current = listenToGeneration(genId, (progress: GenerationProgress) => {
            // Don't override if HTTP already completed
            if (httpCompletedRef.current) return;

            if (progress.phase === 'text') {
                setPhase('text');
                setProgress(20);
                setStatusMessage(t('gen_writing_story'));
            } else if (progress.phase === 'images' && progress.totalPages) {
                setPhase('images');
                const current = progress.currentPage || 0;
                const total = progress.totalPages;
                setPageProgress({ current, total });
                setProgress(Math.round((current / total) * 100));
                setStatusMessage(t('gen_drawing_images', { current: String(current), total: String(total) }));
            }

            if (progress.status === 'completed' && progress.result) {
                console.log('[StoryGenerating] Completed via Firestore listener');
                navigateToPreview(progress.result, variables);
            } else if (progress.status === 'error') {
                console.error('[StoryGenerating] Error from Firestore:', progress.error);
                clearPendingGeneration();
                alert(t('error'));
                navigate('/create');
            }
        });
    }, [navigate, navigateToPreview, t]);

    // Handle visibility change (app comes back from background)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && generationIdRef.current) {
                console.log('[StoryGenerating] App resumed, checking Firestore for result...');
                // Firestore listener auto-reconnects, but ensure it's active
                const pending = getPendingGeneration();
                if (pending && !unsubscribeRef.current) {
                    setupFirestoreListener(pending.generationId, pending.variables);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [setupFirestoreListener]);

    useEffect(() => {
        if (!state?.variables) {
            // Check for pending generation from background
            const pending = getPendingGeneration();
            if (pending) {
                console.log('[StoryGenerating] Found pending generation:', pending.generationId);
                generationIdRef.current = pending.generationId;
                setupFirestoreListener(pending.generationId, pending.variables);
                return;
            }
            navigate('/create');
            return;
        }

        if (isGenerating.current) return;
        isGenerating.current = true;

        const generate = async () => {
            try {
                // Create a unique generation ID for background recovery
                const genId = createGenerationId();
                generationIdRef.current = genId;
                savePendingGeneration(genId, state.variables);

                // Set up Firestore listener as backup
                setupFirestoreListener(genId, state.variables);

                // Phase 1: Generate story text
                setPhase('text');
                setStatusMessage(t('gen_creating_story', { name: state.variables.childName }));

                let story;

                if (state.isPhotoBased && state.photoBase64) {
                    // Photo-based story generation
                    story = await generatePhotoBasedStory(
                        {
                            ...state.variables,
                            targetLanguage: targetLanguage || 'English',
                            photoBase64: state.photoBase64,
                            photoMimeType: state.photoMimeType,
                            photoDescription: state.photoDescription,
                            generationId: genId,
                        },
                        (pageNum, total, imageProgress) => {
                            if (imageProgress !== undefined) {
                                setPhase('images');
                                setPageProgress({ current: pageNum, total });
                                setProgress(Math.round((pageNum / total) * 100));
                                setStatusMessage(t('gen_drawing_images', { current: String(pageNum), total: String(total) }));
                            } else {
                                setProgress(30);
                                setStatusMessage(t('gen_writing_story'));
                            }
                        }
                    );
                } else {
                    // Standard story generation
                    story = await generateCompleteStory(
                        { ...state.variables, targetLanguage: targetLanguage || 'English', generationId: genId },
                        (pageNum, total, imageProgress) => {
                            if (imageProgress !== undefined) {
                                setPhase('images');
                                setPageProgress({ current: pageNum, total });
                                setProgress(Math.round((pageNum / total) * 100));
                                setStatusMessage(t('gen_drawing_images', { current: String(pageNum), total: String(total) }));
                            } else {
                                setProgress(30);
                                setStatusMessage(t('gen_writing_story'));
                            }
                        }
                    );
                }

                // HTTP call succeeded — mark as completed
                httpCompletedRef.current = true;
                navigateToPreview(story, state.variables);

            } catch (error) {
                console.error('[StoryGenerating] HTTP call error:', error);
                // Don't fail immediately — the CF may still be running in the background
                // Check if Firestore listener already saw the result
                if (!httpCompletedRef.current && generationIdRef.current) {
                    console.log('[StoryGenerating] HTTP lost, waiting for Firestore result...');
                    setStatusMessage(t('gen_writing_story'));
                    // Firestore listener is already active, just wait
                    // Set a 10 minute timeout as last resort
                    setTimeout(() => {
                        if (!httpCompletedRef.current) {
                            console.error('[StoryGenerating] Timeout waiting for background result');
                            clearPendingGeneration();
                            alert(t('error'));
                            navigate('/create');
                        }
                    }, 10 * 60 * 1000);
                } else {
                    clearPendingGeneration();
                    alert(t('error'));
                    navigate('/create');
                }
            }
        };

        generate();

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [state, navigate, t, targetLanguage, setupFirestoreListener, navigateToPreview]);

    if (!state?.variables) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-800 via-amber-900 to-emerald-900 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Forest Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Trees silhouette at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-emerald-950 to-transparent opacity-60" />

                {/* Stars/Fireflies */}
                {[...Array(40)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1.5 h-1.5 bg-amber-300 rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                            opacity: [0.2, 1, 0.2],
                            scale: [0.5, 1.5, 0.5],
                        }}
                        transition={{
                            duration: 2 + Math.random() * 2,
                            repeat: Infinity,
                            delay: Math.random() * 2,
                        }}
                    />
                ))}

                {/* Floating Sparkles */}
                {[...Array(10)].map((_, i) => (
                    <motion.div
                        key={`sparkle-${i}`}
                        className="absolute text-amber-400"
                        style={{
                            left: `${10 + i * 8}%`,
                            top: `${15 + (i % 4) * 15}%`,
                        }}
                        animate={{
                            y: [0, -30, 0],
                            opacity: [0.3, 1, 0.3],
                            rotate: [0, 360],
                        }}
                        transition={{
                            duration: 4 + i,
                            repeat: Infinity,
                            delay: i * 0.4,
                        }}
                    >
                        <Sparkles size={18} />
                    </motion.div>
                ))}

                {/* Magic stars for image phase */}
                <AnimatePresence>
                    {phase === 'images' && [...Array(8)].map((_, i) => {
                        // Generate random values only when rendering
                        const left = 30 + Math.random() * 40;
                        const top = 40 + Math.random() * 20;
                        const color = ['#facc15', '#f472b6', '#60a5fa', '#34d399'][i % 4];
                        return (
                            <motion.div
                                key={`color-star-${i}`}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                    opacity: [0, 1, 0],
                                    scale: [0, 1.5, 0],
                                    y: [0, -100],
                                }}
                                exit={{ opacity: 0 }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.3,
                                }}
                                className="absolute"
                                style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    color,
                                }}
                            >
                                <Star size={16} fill="currentColor" />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center relative z-10 max-w-2xl"
            >
                {/* Large Owl Mascot with Animations */}
                <div className="relative mb-6">
                    {/* Multi-layer glow effect behind owl */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                            className="w-80 h-80 bg-amber-400/15 rounded-full blur-3xl"
                            animate={{
                                scale: [1, 1.3, 1],
                                opacity: [0.2, 0.4, 0.2],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                            }}
                        />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                            className="w-56 h-56 bg-orange-400/20 rounded-full blur-2xl"
                            animate={{
                                scale: [1.2, 1, 1.2],
                                opacity: [0.3, 0.5, 0.3],
                            }}
                            transition={{
                                duration: 2.5,
                                repeat: Infinity,
                                delay: 0.5,
                            }}
                        />
                    </div>


                    {/* Speech bubble - prominent */}
                    <motion.div
                        key={owlMessageKey}
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl px-8 py-4 shadow-2xl border-3 border-amber-400 whitespace-nowrap z-30"
                    >
                        <motion.p
                            className="text-amber-800 font-bold text-lg"
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                        >
                            {t(owlMessageKey)}
                        </motion.p>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-3 border-b-3 border-amber-400 transform rotate-45" />
                    </motion.div>

                    {/* OWL - VERY LARGE and animated based on phase */}
                    <motion.div
                        className="relative mx-auto w-64 h-64 md:w-80 md:h-80"
                        animate={phase === 'text'
                            ? { rotate: [-4, 4, -4], y: [0, -5, 0] }
                            : phase === 'images'
                                ? { scale: [1, 1.08, 1], rotate: [0, 2, 0, -2, 0] }
                                : { y: [0, -20, 0], scale: [1, 1.1, 1] }
                        }
                        transition={{
                            duration: phase === 'text' ? 1.5 : phase === 'images' ? 2 : 0.8,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <img
                            src={owlImage}
                            alt="Owl"
                            className="w-full h-full object-contain drop-shadow-2xl"
                            style={{
                                filter: 'drop-shadow(0 0 50px rgba(251, 191, 36, 0.5))'
                            }}
                        />

                        {/* Quill animation for text phase */}
                        {phase === 'text' && (
                            <motion.div
                                className="absolute -right-8 bottom-20 text-amber-300"
                                animate={{
                                    rotate: [0, -20, 0],
                                    y: [0, -8, 0]
                                }}
                                transition={{
                                    duration: 0.6,
                                    repeat: Infinity,
                                }}
                            >
                                <Feather size={48} />
                            </motion.div>
                        )}

                        {/* Palette for images phase */}
                        {phase === 'images' && (
                            <motion.div
                                className="absolute -left-8 bottom-20 text-pink-300"
                                animate={{
                                    rotate: [0, 10, 0],
                                    scale: [1, 1.1, 1]
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                }}
                            >
                                <Palette size={44} />
                            </motion.div>
                        )}

                        {/* Sparkles for complete phase */}
                        {phase === 'complete' && (
                            <>
                                {completeSparkles.map((sparkle, i) => (
                                    <motion.div
                                        key={i}
                                        className="absolute"
                                        style={{
                                            left: `${sparkle.left}%`,
                                            top: `${sparkle.top}%`,
                                            color: sparkle.color,
                                        }}
                                        animate={{
                                            opacity: [0, 1, 0],
                                            scale: [0, 1.5, 0],
                                            y: [0, -30, 0],
                                        }}
                                        transition={{
                                            duration: 1,
                                            repeat: Infinity,
                                            delay: i * 0.2,
                                        }}
                                    >
                                        <Star size={20} fill="currentColor" />
                                    </motion.div>
                                ))}
                            </>
                        )}
                    </motion.div>
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-4xl font-black text-white mb-2 drop-shadow-lg">
                    {t('gen_creating_story', { name: state.variables.childName })}
                </h1>
                <p className="text-amber-200 mb-6 text-lg">🌲 STORYFOREST 🌲</p>

                {/* Status Message */}
                <motion.p
                    key={statusMessage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl text-white/90 mb-8 font-medium"
                >
                    {statusMessage}
                </motion.p>

                {/* Progress Bar */}
                <div className="w-96 mx-auto max-w-full">
                    <div className="bg-white/20 rounded-full h-5 overflow-hidden border-2 border-white/30 shadow-inner">
                        <motion.div
                            className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 h-full rounded-full relative"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        >
                            {/* Shimmer effect */}
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                                animate={{ x: ['-100%', '100%'] }}
                                transition={{
                                    duration: 1.2,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            />
                        </motion.div>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                        <span className="text-amber-200 text-lg font-bold">{progress}%</span>
                        <span className="text-amber-200/70 text-sm">
                            {phase === 'images' && `${pageProgress.current}/${pageProgress.total} ${t('gen_pages')}`}
                        </span>
                    </div>
                </div>

                {/* Phase indicator */}
                <div className="flex justify-center gap-4 mt-8">
                    <div className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all ${phase === 'text'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg scale-105'
                        : phase === 'complete' || phase === 'images'
                            ? 'bg-amber-400/20 text-amber-200'
                            : 'text-white/40'
                        }`}>
                        <BookOpen size={18} />
                        <span className="text-sm font-bold">{t('gen_story')}</span>
                        {phase === 'text' && (
                            <motion.div
                                className="w-2 h-2 bg-white rounded-full"
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            />
                        )}
                    </div>
                    <div className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all ${phase === 'images'
                        ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg scale-105'
                        : phase === 'complete'
                            ? 'bg-orange-400/20 text-orange-200'
                            : 'text-white/40'
                        }`}>
                        <ImageIcon size={18} />
                        <span className="text-sm font-bold">{t('gen_images')}</span>
                        {phase === 'images' && (
                            <motion.div
                                className="w-2 h-2 bg-white rounded-full"
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                            />
                        )}
                    </div>
                    <div className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all ${phase === 'complete'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                        : 'text-white/40'
                        }`}>
                        <Sparkles size={18} />
                        <span className="text-sm font-bold">{t('gen_done')}</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
