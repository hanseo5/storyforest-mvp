import React, { useEffect, useState } from 'react';
import { Settings, Mic, User as UserIcon, ListMusic, Globe, AlertTriangle, Home, Sparkles, Star, Book, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getAllPublishedBooks } from '../services/bookService';
import type { Book as BookType } from '../types';
import { BookDetailModal } from '../components/BookDetailModal';
import { VoiceRecordModal } from '../components/VoiceRecordModal';
import { VoiceStorageModal } from '../components/VoiceStorageModal';
import { useStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import { LanguageSelection } from './LanguageSelection';
import { cleanTranslatedText } from '../utils/textUtils';
import squirrelImage from '../assets/mascots/squirrel.png';
import { generateAllBooksAudio, generateTranslatedAudio } from '../services/bookService';
import { Loader2 } from 'lucide-react';

export const Library: React.FC = () => {
    const navigate = useNavigate();
    const {
        targetLanguage,
        translationCache,
        setTranslatedBook,
        isTranslatingBooks,
        translationProgress
    } = useStore();
    const { t } = useTranslation();
    const [books, setBooks] = useState<BookType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showLanguageSelection, setShowLanguageSelection] = useState(false);
    const [selectedBook, setSelectedBook] = useState<BookType | null>(null);
    const [showVoiceRecord, setShowVoiceRecord] = useState(false);
    const [showVoiceStorage, setShowVoiceStorage] = useState(false);
    const [showVoiceWarning, setShowVoiceWarning] = useState(false);
    const [showSquirrel, setShowSquirrel] = useState(true);
    const squirrelMessages = [t('squirrel_lib_1'), t('squirrel_lib_2'), t('squirrel_lib_3'), t('squirrel_lib_4')];
    const [squirrelMessage, setSquirrelMessage] = useState(squirrelMessages[0]);
    const [isSquirrelHovered, setIsSquirrelHovered] = useState(false);
    const [isAudioOptimizing, setIsAudioOptimizing] = useState(false);

    useEffect(() => {
        const fetchBooksAndTranslations = async () => {
            setLoading(true);
            const data = await getAllPublishedBooks();
            setBooks(data);

            if (targetLanguage) {
                const { getCachedTranslation } = await import('../services/translationService');
                const { detectLanguage } = await import('../utils/textUtils');

                for (const book of data) {
                    const originalLang = book.originalLanguage || 'English';
                    const detectedLang = detectLanguage(book.title) || originalLang;

                    if (targetLanguage !== detectedLang) {
                        const cached = await getCachedTranslation(book.id!, targetLanguage);
                        if (cached) {
                            setTranslatedBook(book.id!, targetLanguage, cached);
                        }
                    }
                }
            }
            setLoading(false);
        };
        fetchBooksAndTranslations();
    }, [targetLanguage]);

    // Background Audio Optimization
    useEffect(() => {
        const optimizeAudio = async () => {
            if (!books.length) return;
            setIsAudioOptimizing(true);
            try {
                // 1. Generate default audio
                await generateAllBooksAudio(undefined);

                // 2. Translate if needed
                if (targetLanguage && targetLanguage !== 'English') {
                    await generateTranslatedAudio(targetLanguage);
                }

                // 3. Preload assets
                const { preloadBookAudio } = await import('../services/audioPreloadService');
                const { getBookById } = await import('../services/bookService');

                for (const book of books) {
                    const fullBook = await getBookById(book.id);
                    if (fullBook) {
                        await preloadBookAudio(fullBook, targetLanguage || 'English', undefined, () => { });
                    }
                }
            } catch (e) {
                console.error("Background audio optimization failed", e);
            } finally {
                setIsAudioOptimizing(false);
            }
        };

        if (books.length > 0) {
            // Small delay to prioritize UI rendering
            const timer = setTimeout(optimizeAudio, 1000);
            return () => clearTimeout(timer);
        }
    }, [books.length, targetLanguage]);

    // Cycle squirrel messages
    useEffect(() => {
        const interval = setInterval(() => {
            setSquirrelMessage(squirrelMessages[Math.floor(Math.random() * squirrelMessages.length)]);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 via-emerald-50 to-amber-50 relative overflow-hidden">
            {/* Forest Background Decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Tree at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-emerald-200/40 to-transparent" />

                {/* Floating leaves */}
                {[...Array(10)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-5 h-5"
                        style={{
                            left: `${5 + i * 10}%`,
                            top: '-25px',
                        }}
                        animate={{
                            y: ['0vh', '110vh'],
                            rotate: [0, 360],
                            opacity: [0, 0.7, 0.7, 0],
                        }}
                        transition={{
                            duration: 18 + i * 2,
                            repeat: Infinity,
                            delay: i * 1.5,
                            ease: 'linear',
                        }}
                    >
                        <div
                            className="w-full h-full bg-green-500/30"
                            style={{
                                borderRadius: '0 50% 50% 50%',
                                transform: 'rotate(45deg)',
                            }}
                        />
                    </motion.div>
                ))}

                {/* Sparkles */}
                {[...Array(12)].map((_, i) => (
                    <motion.div
                        key={`sparkle-${i}`}
                        className="absolute text-amber-400/50"
                        style={{
                            left: `${5 + Math.random() * 90}%`,
                            top: `${5 + Math.random() * 90}%`,
                        }}
                        animate={{
                            opacity: [0, 1, 0],
                            scale: [0.5, 1.3, 0.5],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            delay: i * 0.4,
                        }}
                    >
                        <Sparkles size={14} />
                    </motion.div>
                ))}
            </div>

            {/* Modals */}
            <BookDetailModal book={selectedBook} onClose={() => setSelectedBook(null)} />
            {showVoiceRecord && (
                <VoiceRecordModal
                    onClose={() => setShowVoiceRecord(false)}
                    onSuccess={() => setShowVoiceRecord(false)}
                />
            )}
            {showVoiceStorage && (
                <VoiceStorageModal
                    onClose={() => setShowVoiceStorage(false)}
                />
            )}
            {showLanguageSelection && (
                <LanguageSelection
                    onClose={() => setShowLanguageSelection(false)}
                    isClosable={true}
                />
            )}

            {/* Voice Cloning Warning Modal */}
            {showVoiceWarning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-4 border-emerald-200">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                            <AlertTriangle className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">{t('language_changed')}</h2>
                        <p className="text-gray-600 text-center mb-8 leading-relaxed">
                            {t('language_changed_desc', { lang: targetLanguage || '' })}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    setShowVoiceWarning(false);
                                    setShowVoiceRecord(true);
                                }}
                                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
                            >
                                {t('clone_voice_now')}
                            </button>
                            <button
                                onClick={() => setShowVoiceWarning(false)}
                                className="w-full bg-gray-100 text-gray-600 font-bold py-4 rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
                            >
                                {t('ill_do_it_later')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LARGE Squirrel Mascot - Fixed Position */}
            <AnimatePresence>
                {showSquirrel && (
                    <motion.div
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 100 }}
                        className="fixed bottom-0 right-0 z-40 flex flex-col items-end"
                        onMouseEnter={() => setIsSquirrelHovered(true)}
                        onMouseLeave={() => setIsSquirrelHovered(false)}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setShowSquirrel(false)}
                            className="absolute top-4 right-4 z-50 p-1 bg-white/80 rounded-full text-gray-500 hover:text-gray-700 hover:bg-white transition-all"
                        >
                            <X size={16} />
                        </button>

                        {/* Speech bubble */}
                        <motion.div
                            key={squirrelMessage}
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className="mr-8 mb-2 bg-white rounded-2xl px-6 py-4 shadow-2xl border-3 border-emerald-300 max-w-xs"
                        >
                            <motion.p
                                className="text-emerald-800 font-bold text-base text-center"
                                animate={isSquirrelHovered ? { scale: [1, 1.05, 1] } : {}}
                                transition={{ duration: 0.5 }}
                            >
                                {squirrelMessage}
                            </motion.p>
                            <div className="absolute -bottom-3 right-20 w-5 h-5 bg-white border-r-3 border-b-3 border-emerald-300 transform rotate-45" />
                        </motion.div>

                        {/* LARGE Squirrel */}
                        <motion.div
                            className="relative"
                            animate={isSquirrelHovered ? {
                                scale: 1.05,
                                rotate: [-3, 3, -3],
                            } : {
                                y: [0, -10, 0],
                            }}
                            transition={isSquirrelHovered ? {
                                rotate: { duration: 0.5, repeat: Infinity },
                                scale: { duration: 0.3 },
                            } : {
                                duration: 3,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                        >
                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-3xl scale-75" />

                            <motion.img
                                src={squirrelImage}
                                alt="다람쥐"
                                className="w-44 md:w-56 lg:w-64 h-auto object-contain drop-shadow-2xl relative z-10"
                                style={{ filter: 'drop-shadow(0 15px 30px rgba(5, 150, 105, 0.35))' }}
                            />

                            {/* Floating stars when hovered */}
                            <AnimatePresence>
                                {isSquirrelHovered && [...Array(5)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{
                                            opacity: [0, 1, 0],
                                            scale: [0, 1.3, 0],
                                            y: [0, -60 - Math.random() * 40],
                                            x: Math.random() * 80 - 40,
                                        }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 1, delay: i * 0.15 }}
                                        className="absolute"
                                        style={{
                                            left: `${30 + Math.random() * 40}%`,
                                            top: '20%',
                                            color: ['#facc15', '#f472b6', '#60a5fa', '#34d399'][i % 4],
                                        }}
                                    >
                                        <Star size={16} fill="currentColor" />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="relative z-10 p-6">
                {/* Header */}
                <header className="flex items-center justify-between mb-8 max-w-6xl mx-auto px-5 py-4 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border-3 border-emerald-200">
                    <div className="flex items-center gap-3">
                        {/* Home Button */}
                        <button
                            onClick={() => navigate('/welcome')}
                            className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                            title="홈으로"
                        >
                            <Home className="w-6 h-6" />
                        </button>

                        {/* Language Selector Trigger */}
                        <button
                            onClick={() => setShowLanguageSelection(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 rounded-xl border-2 border-emerald-100 hover:border-emerald-200 group transition-all active:scale-95"
                        >
                            <Globe className="w-5 h-5 text-emerald-600 group-hover:rotate-12 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 group-hover:text-emerald-700">
                                {targetLanguage || t('select_language')}
                            </span>
                        </button>

                        <button className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" title={t('settings')}>
                            <Settings className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowVoiceRecord(true)}
                            className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors relative group"
                            title="Clone Voice"
                        >
                            <Mic className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowVoiceStorage(true)}
                            className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-full transition-colors relative group"
                            title="Voice Library"
                        >
                            <ListMusic className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🌲</span>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-green-700">
                            {isTranslatingBooks ? t('translating_library') : t('story_bookshelf')}
                        </h1>
                    </div>

                    <button className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors border-2 border-transparent hover:border-emerald-100">
                        <UserIcon className="w-6 h-6" />
                    </button>
                </header>

                {/* Background Optimization Indicator */}
                <AnimatePresence>
                    {isAudioOptimizing && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="max-w-6xl mx-auto mb-4 px-4 flex justify-end"
                        >
                            <div className="bg-emerald-100/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-3 text-emerald-700 text-xs font-medium shadow-sm border border-emerald-200">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{t('audio_preparing')}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Translation Progress */}
                {isTranslatingBooks && translationProgress && (
                    <div className="max-w-6xl mx-auto mb-6 px-4">
                        <div className="bg-emerald-50 border-3 border-emerald-200 rounded-2xl p-5 flex items-center justify-between shadow-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center animate-spin">
                                    <Globe className="text-white w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-emerald-900">{t('translating_books')}</h4>
                                    <p className="text-emerald-600 text-sm">
                                        {t('processing_books', { current: String(translationProgress.current), total: String(translationProgress.total) })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex-1 max-w-xs mx-8 h-3 bg-emerald-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-600 transition-all duration-500"
                                    style={{ width: `${(translationProgress.current / translationProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Book Grid */}
                <div className="max-w-6xl mx-auto pr-0 md:pr-48 lg:pr-56">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-20 h-20 border-4 border-emerald-200 border-t-emerald-600 rounded-full"
                            />
                            <p className="mt-6 text-emerald-600 font-bold text-lg">{t('fetching_books')}</p>
                        </div>
                    ) : books.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20">
                            <motion.img
                                src={squirrelImage}
                                alt="다람쥐"
                                className="w-40 h-40 object-contain opacity-60 mb-6"
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                            <p className="text-gray-500 text-xl font-medium mb-4">{t('no_books_yet')}</p>
                            <button
                                onClick={() => navigate('/create')}
                                className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg flex items-center gap-2"
                            >
                                <Book size={22} />
                                {t('make_first_book')}
                            </button>
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                        >
                            {books.map((book, index) => {
                                const translatedTitle = targetLanguage && translationCache[book.id!]?.[targetLanguage]?.title;
                                const displayTitle = translatedTitle ? cleanTranslatedText(translatedTitle) : book.title;

                                return (
                                    <motion.div
                                        key={book.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        whileHover={{ scale: 1.03, y: -5 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setSelectedBook(book)}
                                        className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer border-3 border-emerald-100 hover:border-emerald-300 flex flex-col h-full"
                                    >
                                        <div className="aspect-[2/3] bg-emerald-50 relative overflow-hidden">
                                            <img
                                                src={book.coverUrl}
                                                alt={book.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            {isTranslatingBooks && (!targetLanguage || !translationCache[book.id!]?.[targetLanguage]?.title) && (
                                                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center">
                                                    <div className="animate-pulse text-emerald-600 font-bold text-xs uppercase tracking-widest">{t('translating')}</div>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                                                <span className="text-white font-bold text-sm flex items-center gap-2">
                                                    <Book size={16} />
                                                    {t('read_label')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-4 flex-1 bg-gradient-to-b from-white to-emerald-50/50">
                                            <h3 className={`font-bold text-gray-800 line-clamp-2 leading-tight text-sm ${(isTranslatingBooks && targetLanguage && !translationCache[book.id!]?.[targetLanguage]?.title) ? 'opacity-30' : ''}`}>
                                                {displayTitle}
                                            </h3>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
};
