import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Sparkles, BookOpen, Star, Music, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAllBooksAudio, generateTranslatedAudio, type AudioGenerationProgress } from '../services/bookService';
import { useStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import squirrelImage from '../assets/mascots/squirrel.png';

// 다람쥐 가이드 메시지
const SQUIRREL_MESSAGES = {
    loading: ["책들을 찾아보고 있어요... 📚", "잠깐만 기다려 주세요~ 🐿️"],
    generating: [
        "목소리를 준비하고 있어요! 🎵",
        "예쁜 목소리로 읽어줄게요~ 🎤",
        "열심히 녹음 중이에요! ✨",
        "마법의 음악을 만들어요! 🪄"
    ],
    translating: [
        "다른 언어로 바꾸고 있어요! 🌍",
        "번역된 책을 준비 중이에요~ 📖",
        "여러 나라 말로 읽어줄게요! 🌈"
    ],
    downloading: [
        "책을 다운로드하고 있어요! 📥",
        "곧 준비가 끝나요~ 🐿️",
        "오디오를 저장하는 중이에요! 💾"
    ],
    done: ["짜잔! 모든 준비가 완료되었어요! 🎉"],
    error: ["앗, 문제가 생겼어요... 😢"]
};

export const AudioPreloadScreen: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const voiceId = searchParams.get('voiceId'); // Optional: for cloned voice
    const redirectTo = searchParams.get('redirect') || '/library';
    const { targetLanguage } = useStore();
    const { t } = useTranslation();

    const [status, setStatus] = useState<'loading' | 'generating' | 'translating' | 'downloading' | 'done' | 'error'>('loading');
    const [progress, setProgress] = useState<AudioGenerationProgress | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [phase, setPhase] = useState<'default' | 'translated' | 'download'>('default');
    const [squirrelMessage, setSquirrelMessage] = useState(SQUIRREL_MESSAGES.loading[0]);

    // Update squirrel message based on status
    useEffect(() => {
        const messages = SQUIRREL_MESSAGES[status];
        let index = 0;
        setSquirrelMessage(messages[0]);

        if (messages.length > 1) {
            const interval = setInterval(() => {
                index = (index + 1) % messages.length;
                setSquirrelMessage(messages[index]);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [status]);

    useEffect(() => {
        const generateAudio = async () => {
            setStatus('generating');
            setPhase('default');

            try {
                // Phase 1: Generate default voice audio for all books
                await generateAllBooksAudio(voiceId || undefined, (prog) => {
                    setProgress(prog);
                });

                // Phase 2: If not English, also generate translated audio
                if (targetLanguage && targetLanguage !== 'English') {
                    setPhase('translated');
                    setStatus('translating');
                    await generateTranslatedAudio(targetLanguage, (prog) => {
                        setProgress(prog);
                    });
                }

                // Phase 3: Pre-download assets (Audio Preloading)
                setPhase('download');
                setStatus('downloading');
                const { getAllPublishedBooks, getBookById } = await import('../services/bookService');
                const { preloadBookAudio } = await import('../services/audioPreloadService');

                const books = await getAllPublishedBooks();
                for (let i = 0; i < books.length; i++) {
                    const book = await getBookById(books[i].id);
                    if (book) {
                        await preloadBookAudio(book, targetLanguage || 'English', voiceId || undefined, (prog) => {
                            setProgress({
                                currentBook: i + 1,
                                totalBooks: books.length,
                                currentPage: prog.loaded,
                                totalPages: prog.total,
                                bookTitle: book.title
                            });
                        });
                    }
                }

                setStatus('done');

                // Navigate after a short delay to show completion
                setTimeout(() => {
                    navigate(redirectTo);
                }, 1500);

            } catch (error) {
                console.error('[AudioPreload] Error:', error);
                setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
                setStatus('error');
            }
        };

        generateAudio();
    }, [voiceId, navigate, redirectTo, targetLanguage]);

    const getStatusText = () => {
        if (status === 'loading') return t('loading');
        if (status === 'generating') {
            if (voiceId) return t('generating_audio') + ' (Custom Voice)';
            return t('generating_audio') + ' (Default)';
        }
        if (status === 'translating') return t('generating_audio') + ` (${targetLanguage})`;
        if (status === 'downloading') return '오디오 다운로드 중...';
        if (status === 'done') return t('done');
        if (status === 'error') return t('error');
        return '';
    };

    const getSubtitleText = () => {
        if (status === 'loading') return t('loading');
        if (status === 'generating') {
            return voiceId
                ? '녹음된 목소리로 오디오를 만들고 있어요...'
                : '기본 내레이터로 오디오를 만들고 있어요...';
        }
        if (status === 'translating') {
            return `${targetLanguage} 오디오를 생성하고 있어요...`;
        }
        if (status === 'done') return '모든 오디오북을 들을 준비가 되었어요!';
        if (status === 'error') return errorMessage;
        return '';
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-800 via-green-900 to-emerald-950 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Forest Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Trees silhouette at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-emerald-950 to-transparent opacity-70" />

                {/* Stars/Fireflies */}
                {[...Array(35)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1.5 h-1.5 bg-emerald-300 rounded-full"
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

                {/* Floating sparkles */}
                {[...Array(10)].map((_, i) => (
                    <motion.div
                        key={`sparkle-${i}`}
                        className="absolute text-emerald-400"
                        style={{
                            left: `${10 + i * 9}%`,
                            top: `${20 + (i % 4) * 18}%`,
                        }}
                        animate={{
                            y: [0, -20, 0],
                            opacity: [0.3, 1, 0.3],
                            rotate: [0, 360],
                        }}
                        transition={{
                            duration: 4 + i,
                            repeat: Infinity,
                            delay: i * 0.35,
                        }}
                    >
                        <Sparkles size={16} />
                    </motion.div>
                ))}

                {/* Music notes floating for audio theme */}
                <AnimatePresence>
                    {(status === 'generating' || status === 'translating') && [...Array(6)].map((_, i) => (
                        <motion.div
                            key={`music-${i}`}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{
                                opacity: [0, 1, 0],
                                scale: [0, 1.2, 0],
                                y: [0, -80 - Math.random() * 60],
                                x: [-20 + Math.random() * 40],
                            }}
                            exit={{ opacity: 0 }}
                            transition={{
                                duration: 2.5,
                                repeat: Infinity,
                                delay: i * 0.5,
                            }}
                            className="absolute text-emerald-300/70"
                            style={{
                                left: `${45 + Math.random() * 10}%`,
                                top: '40%',
                            }}
                        >
                            <Music size={18} />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 max-w-xl w-full text-center"
            >
                {/* LARGE Squirrel Mascot */}
                <div className="relative mb-4">
                    {/* Multi-layer glow effect */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                            className="w-72 h-72 bg-emerald-400/15 rounded-full blur-3xl"
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
                            className="w-48 h-48 bg-teal-400/20 rounded-full blur-2xl"
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
                        key={squirrelMessage}
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl px-8 py-4 shadow-2xl border-3 border-emerald-400 whitespace-nowrap z-30"
                    >
                        <motion.p
                            className="text-emerald-800 font-bold text-lg"
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                        >
                            {squirrelMessage}
                        </motion.p>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-3 border-b-3 border-emerald-400 transform rotate-45" />
                    </motion.div>

                    {/* SQUIRREL - VERY LARGE */}
                    <motion.div
                        className="relative mx-auto w-56 h-56 md:w-72 md:h-72"
                        animate={status === 'done'
                            ? { y: [0, -20, 0], scale: [1, 1.1, 1] }
                            : status === 'generating' || status === 'translating'
                                ? { rotate: [-3, 3, -3], y: [0, -8, 0] }
                                : { scale: [1, 1.05, 1] }
                        }
                        transition={{
                            duration: status === 'done' ? 1 : 2.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <img
                            src={squirrelImage}
                            alt="다람쥐"
                            className="w-full h-full object-contain drop-shadow-2xl"
                            style={{
                                filter: 'drop-shadow(0 0 40px rgba(52, 211, 153, 0.45))'
                            }}
                        />

                        {/* Book icon for reading effect */}
                        {(status === 'generating' || status === 'translating') && (
                            <motion.div
                                className="absolute -right-6 bottom-14 text-emerald-300"
                                animate={{
                                    rotate: [-8, 8, -8],
                                    y: [0, -5, 0]
                                }}
                                transition={{
                                    duration: 0.8,
                                    repeat: Infinity,
                                }}
                            >
                                <BookOpen size={40} />
                            </motion.div>
                        )}

                        {/* Headphones icon for audio effect */}
                        {status === 'downloading' && (
                            <motion.div
                                className="absolute -left-6 top-14 text-cyan-300"
                                animate={{
                                    scale: [1, 1.15, 1],
                                    opacity: [0.6, 1, 0.6]
                                }}
                                transition={{
                                    duration: 0.8,
                                    repeat: Infinity,
                                }}
                            >
                                <Headphones size={36} />
                            </motion.div>
                        )}

                        {/* Celebration stars for done */}
                        {status === 'done' && (
                            <>
                                {[...Array(8)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        className="absolute"
                                        style={{
                                            left: `${10 + Math.random() * 80}%`,
                                            top: `${10 + Math.random() * 60}%`,
                                            color: ['#facc15', '#f472b6', '#60a5fa', '#34d399'][i % 4],
                                        }}
                                        animate={{
                                            opacity: [0, 1, 0],
                                            scale: [0, 1.5, 0],
                                            y: [0, -30, 0],
                                        }}
                                        transition={{
                                            duration: 1.2,
                                            repeat: Infinity,
                                            delay: i * 0.15,
                                        }}
                                    >
                                        <Star size={18} fill="currentColor" />
                                    </motion.div>
                                ))}
                            </>
                        )}
                    </motion.div>
                </div>

                {/* Card */}
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
                    {/* Status Icon */}
                    <div className="mb-6">
                        {status === 'done' ? (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-20 h-20 bg-emerald-500/30 rounded-full flex items-center justify-center mx-auto"
                            >
                                <CheckCircle className="w-10 h-10 text-emerald-400" />
                            </motion.div>
                        ) : (
                            <div className="flex justify-center gap-3 mb-2">
                                <div className={`w-4 h-4 rounded-full transition-all ${phase === 'default' || status === 'generating' ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-emerald-400/30'}`}></div>
                                <div className={`w-4 h-4 rounded-full transition-all ${phase === 'translated' ? 'bg-teal-400 shadow-lg shadow-teal-400/50' : 'bg-emerald-400/30'}`}></div>
                                <div className={`w-4 h-4 rounded-full transition-all ${phase === 'download' ? 'bg-cyan-400 shadow-lg shadow-cyan-400/50' : 'bg-emerald-400/30'}`}></div>
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
                        {getStatusText()}
                    </h1>
                    <p className="text-emerald-200/80 mb-2 text-lg">🌲 STORYFOREST 🌲</p>

                    {/* Subtitle */}
                    <p className="text-white/70 mb-6 text-lg">
                        {getSubtitleText()}
                    </p>

                    {/* Progress */}
                    {(status === 'generating' || status === 'translating' || status === 'downloading') && progress && (
                        <div className="space-y-5">
                            {/* Book Progress */}
                            <div>
                                <div className="flex justify-between text-sm text-white/70 mb-2 font-medium">
                                    <span>📚 {progress.currentBook} / {progress.totalBooks} 책</span>
                                    <span>{Math.round((progress.currentBook / progress.totalBooks) * 100)}%</span>
                                </div>
                                <div className="h-4 bg-white/20 rounded-full overflow-hidden border border-white/15">
                                    <motion.div
                                        className={`h-full transition-all duration-300 ${phase === 'translated'
                                            ? 'bg-gradient-to-r from-teal-400 to-cyan-400'
                                            : phase === 'download'
                                                ? 'bg-gradient-to-r from-cyan-400 to-blue-400'
                                                : 'bg-gradient-to-r from-emerald-400 to-teal-400'
                                            }`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(progress.currentBook / progress.totalBooks) * 100}%` }}
                                    >
                                        {/* Shimmer effect */}
                                        <motion.div
                                            className="w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
                                            animate={{ x: ['-100%', '100%'] }}
                                            transition={{
                                                duration: 1.2,
                                                repeat: Infinity,
                                                ease: "linear"
                                            }}
                                        />
                                    </motion.div>
                                </div>
                            </div>

                            {/* Current Book Info */}
                            <div className="bg-white/10 rounded-2xl p-5 border border-white/15">
                                <p className="text-white font-bold truncate text-base">{progress.bookTitle}</p>
                                <p className="text-white/50 text-sm mt-1">📄 {progress.currentPage} / {progress.totalPages} 페이지</p>
                            </div>
                        </div>
                    )}

                    {/* Error Retry */}
                    {status === 'error' && (
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold transition-colors shadow-lg text-lg"
                        >
                            다시 시도하기
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
