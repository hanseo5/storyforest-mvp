/* eslint-disable react-hooks/rules-of-hooks -- Math.random for animation initial positions is acceptable */
import React, { useEffect, useState, useRef } from 'react';
import { Mic, User as UserIcon, ListMusic, Globe, AlertTriangle, Home, Sparkles, Star, Book, X, Plus, FileText, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getOfficialBooks, getUserBooks, getAllPublishedBooks } from '../services/bookService';
import { getAdminUserIds } from '../services/userService';
import { isAdminUser } from '../constants/admin';
import type { Book as BookType } from '../types';
import type { DraftBook } from '../types/draft';
import { BookDetailModal } from '../components/BookDetailModal';
import { VoiceRecordModal } from '../components/VoiceRecordModal';
import { VoiceStorageModal } from '../components/VoiceStorageModal';
import { useStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import { LanguageSelection } from './LanguageSelection';
import { cleanTranslatedText } from '../utils/textUtils';
import squirrelImage from '../assets/mascots/squirrel.png';
import { generateAllBooksAudio, generateTranslatedAudio } from '../services/bookService';
import { listDrafts, getDraft, deleteDraft } from '../services/draftService';
import { Loader2 } from 'lucide-react';

export const Library: React.FC = () => {
    const navigate = useNavigate();
    const {
        user,
        targetLanguage,
        translationCache,
        setTranslatedBook,
        isTranslatingBooks,
        translationProgress
    } = useStore();
    const { t } = useTranslation();

    // Tab state: 'bookstore' = official Storyforest, 'mybooks' = personal
    const [activeTab, setActiveTab] = useState<'bookstore' | 'mybooks'>('bookstore');
    const [officialBooks, setOfficialBooks] = useState<BookType[]>([]);
    const [myBooks, setMyBooks] = useState<BookType[]>([]);
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

    // Drafts state
    const [drafts, setDrafts] = useState<DraftBook[]>([]);
    const [draftsLoading, setDraftsLoading] = useState(false);
    const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
    const [loadingDraftId, setLoadingDraftId] = useState<string | null>(null);

    // Swipe support
    const swipeX = useMotionValue(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Derived: which books to show based on active tab
    const displayBooks = activeTab === 'bookstore' ? officialBooks : myBooks;

    useEffect(() => {
        const fetchBooks = async () => {
            setLoading(true);

            try {
                // Resolve admin UIDs
                const adminUids = await getAdminUserIds();
                console.log('[Library] Admin UIDs resolved:', adminUids);

                // If current user is admin, ensure their UID is included
                if (user?.uid && user?.email && isAdminUser(user.email)) {
                    if (!adminUids.includes(user.uid)) {
                        adminUids.push(user.uid);
                    }
                }

                // Fetch official books (by admin authors)
                let official: BookType[] = [];
                if (adminUids.length > 0) {
                    official = await getOfficialBooks(adminUids);
                    console.log('[Library] Official books by admin UIDs:', official.length, official.map(b => b.title));
                }
                // Always also fetch all books to check what exists
                const allBooks = await getAllPublishedBooks();
                console.log('[Library] ALL books in DB:', allBooks.map(b => ({ title: b.title, authorId: b.authorId, id: b.id })));
                if (official.length === 0) {
                    // Fallback: admin UIDs didn't match, show all books except current user's
                    official = user?.uid
                        ? allBooks.filter(b => b.authorId !== user.uid)
                        : allBooks;
                }
                console.log('[Library] Setting officialBooks:', official.length);
                setOfficialBooks(official);

                // Fetch personal books if user is logged in
                let personal: BookType[] = [];
                if (user?.uid) {
                    personal = await getUserBooks(user.uid);
                    setMyBooks(personal);

                    // Also load drafts
                    try {
                        setDraftsLoading(true);
                        const userDrafts = await listDrafts(user.uid);
                        setDrafts(userDrafts);
                    } catch (draftErr) {
                        console.error('[Library] Error loading drafts:', draftErr);
                    } finally {
                        setDraftsLoading(false);
                    }
                }

                // Load translation cache for visible books only
                if (targetLanguage) {
                    const { getCachedTranslation } = await import('../services/translationService');
                    const { detectLanguage } = await import('../utils/textUtils');
                    const visibleBooks = [...official, ...personal];
                    for (const book of visibleBooks) {
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
            } catch (error) {
                console.error('[Library] Error fetching books:', error);
            }

            setLoading(false);
        };
        fetchBooks();
    }, [targetLanguage, user?.uid]);

    // Draft handlers
    const handleOpenDraft = async (draftId: string) => {
        setLoadingDraftId(draftId);
        try {
            const draft = await getDraft(draftId);
            if (draft) {
                navigate('/editor/story', { state: { existingDraft: draft } });
            }
        } catch (err) {
            console.error('[Library] Error opening draft:', err);
        } finally {
            setLoadingDraftId(null);
        }
    };

    const handleDeleteDraft = async (draftId: string) => {
        if (!confirm(t('delete_draft_confirm'))) return;
        setDeletingDraftId(draftId);
        try {
            await deleteDraft(draftId);
            setDrafts(prev => prev.filter(d => d.id !== draftId));
        } catch (err) {
            console.error('[Library] Error deleting draft:', err);
        } finally {
            setDeletingDraftId(null);
        }
    };

    // Background Audio Optimization
    useEffect(() => {
        const optimizeAudio = async () => {
            const allBooks = [...officialBooks, ...myBooks];
            if (!allBooks.length) return;
            setIsAudioOptimizing(true);
            try {
                await generateAllBooksAudio(undefined);
                if (targetLanguage && targetLanguage !== 'English') {
                    await generateTranslatedAudio(targetLanguage);
                }
                const { preloadBookAudio } = await import('../services/audioPreloadService');
                const { getBookById } = await import('../services/bookService');
                for (const book of allBooks) {
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

        const totalBooks = officialBooks.length + myBooks.length;
        if (totalBooks > 0) {
            const timer = setTimeout(optimizeAudio, 1000);
            return () => clearTimeout(timer);
        }
    }, [officialBooks.length, myBooks.length, targetLanguage]);

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

            {/* Floating Side Icons - Left */}
            <div className="fixed left-4 top-6 z-30 flex flex-col gap-3">
                <button
                    onClick={() => navigate('/welcome')}
                    className="p-4 bg-white/95 backdrop-blur-sm text-emerald-600 hover:bg-emerald-50 rounded-2xl shadow-xl border-2 border-emerald-200 transition-all hover:scale-110 active:scale-95"
                    title={t('go_home')}
                >
                    <Home className="w-7 h-7" />
                </button>
                <button
                    onClick={() => setShowVoiceRecord(true)}
                    className="p-4 bg-white/95 backdrop-blur-sm text-emerald-600 hover:bg-emerald-50 rounded-2xl shadow-xl border-2 border-emerald-200 transition-all hover:scale-110 active:scale-95"
                    title={t('clone_voice')}
                >
                    <Mic className="w-7 h-7" />
                </button>
                <button
                    onClick={() => setShowVoiceStorage(true)}
                    className="p-4 bg-white/95 backdrop-blur-sm text-amber-600 hover:bg-amber-50 rounded-2xl shadow-xl border-2 border-amber-200 transition-all hover:scale-110 active:scale-95"
                    title={t('select_voice')}
                >
                    <ListMusic className="w-7 h-7" />
                </button>
            </div>

            {/* Floating Side Icons - Right */}
            <div className="fixed right-4 top-6 z-30 flex flex-col gap-3">
                <button
                    onClick={() => setShowLanguageSelection(true)}
                    className="p-4 bg-white/95 backdrop-blur-sm text-emerald-600 hover:bg-emerald-50 rounded-2xl shadow-xl border-2 border-emerald-200 transition-all hover:scale-110 active:scale-95"
                    title={t('select_language')}
                >
                    <Globe className="w-7 h-7" />
                </button>
                <button
                    onClick={() => navigate('/create')}
                    className="p-4 bg-white/95 backdrop-blur-sm text-emerald-600 hover:bg-emerald-50 rounded-2xl shadow-xl border-2 border-emerald-200 transition-all hover:scale-110 active:scale-95"
                    title={t('make_story')}
                >
                    <UserIcon className="w-7 h-7" />
                </button>
            </div>

            {/* Main Content */}
            <div className="relative z-10 px-16 md:px-20 py-4 md:py-6">
                {/* Tab Switcher: 동화책방 / 내 동화책 */}
                <div className="max-w-6xl mx-auto mb-5">
                    <div className="relative bg-emerald-100/60 backdrop-blur-sm rounded-2xl p-1.5 flex">
                        {/* Sliding indicator */}
                        <motion.div
                            className="absolute top-1.5 bottom-1.5 rounded-xl bg-white shadow-md"
                            initial={false}
                            animate={{
                                left: activeTab === 'bookstore' ? '6px' : '50%',
                                width: 'calc(50% - 9px)',
                            }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                        <button
                            onClick={() => setActiveTab('bookstore')}
                            className={`relative z-10 flex-1 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                                activeTab === 'bookstore' ? 'text-emerald-700' : 'text-gray-400'
                            }`}
                        >
                            <span className="text-lg">📚</span>
                            {t('tab_bookstore')}
                            {officialBooks.length > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    activeTab === 'bookstore' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                    {officialBooks.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('mybooks')}
                            className={`relative z-10 flex-1 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                                activeTab === 'mybooks' ? 'text-emerald-700' : 'text-gray-400'
                            }`}
                        >
                            <span className="text-lg">✨</span>
                            {t('tab_mybooks')}
                            {(myBooks.length + drafts.length) > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    activeTab === 'mybooks' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                    {myBooks.length + drafts.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

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

                {/* Swipeable Book Grid */}
                <div
                    ref={containerRef}
                    className="max-w-6xl mx-auto pr-0 md:pr-48 lg:pr-56 touch-pan-y"
                >
                    <motion.div
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.15}
                        onDragEnd={(_e, info) => {
                            const threshold = 80;
                            if (info.offset.x < -threshold && activeTab === 'bookstore') {
                                setActiveTab('mybooks');
                            } else if (info.offset.x > threshold && activeTab === 'mybooks') {
                                setActiveTab('bookstore');
                            }
                        }}
                        style={{ x: swipeX }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: activeTab === 'bookstore' ? -40 : 40 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: activeTab === 'bookstore' ? 40 : -40 }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                            >
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="w-20 h-20 border-4 border-emerald-200 border-t-emerald-600 rounded-full"
                            />
                            <p className="mt-6 text-emerald-600 font-bold text-lg">{t('fetching_books')}</p>
                        </div>
                    ) : activeTab === 'mybooks' ? (
                        /* === MY BOOKS TAB: Drafts + Published === */
                        (displayBooks.length === 0 && drafts.length === 0) ? (
                            <div className="flex flex-col items-center justify-center p-20">
                                <motion.img
                                    src={squirrelImage}
                                    alt="다람쥐"
                                    className="w-40 h-40 object-contain opacity-60 mb-6"
                                    animate={{ y: [0, -8, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <p className="text-gray-500 text-xl font-medium mb-2">{t('no_my_books_yet')}</p>
                                <p className="text-gray-400 text-sm mb-6">{t('no_my_books_desc')}</p>
                                <button
                                    onClick={() => navigate('/create')}
                                    className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg flex items-center gap-2"
                                >
                                    <Plus size={22} />
                                    {t('make_first_book')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Drafts Section */}
                                {(drafts.length > 0 || draftsLoading) && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <FileText size={16} className="text-amber-500" />
                                            <h3 className="font-bold text-amber-700 text-sm">{t('drafts_section')}</h3>
                                            <span className="text-xs text-amber-400 bg-amber-50 px-2 py-0.5 rounded-full">
                                                {drafts.length}
                                            </span>
                                        </div>
                                        {draftsLoading ? (
                                            <div className="flex items-center justify-center py-8 text-amber-400">
                                                <Loader2 size={24} className="animate-spin" />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                {drafts.map((draft, index) => (
                                                    <motion.div
                                                        key={draft.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        whileHover={{ scale: 1.03, y: -5 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-3 border-amber-100 hover:border-amber-300 flex flex-col h-full"
                                                    >
                                                        {/* Draft Cover/Preview */}
                                                        <div
                                                            onClick={() => draft.id && handleOpenDraft(draft.id)}
                                                            className="aspect-[2/3] bg-gradient-to-br from-amber-50 to-orange-50 relative overflow-hidden cursor-pointer flex flex-col items-center justify-center p-4"
                                                        >
                                                            {loadingDraftId === draft.id ? (
                                                                <Loader2 size={32} className="animate-spin text-amber-400" />
                                                            ) : (
                                                                <>
                                                                    <FileText size={36} className="text-amber-300 mb-2" />
                                                                    <span className="text-[10px] text-amber-400 font-medium">{t('open_draft')}</span>
                                                                </>
                                                            )}
                                                            {/* Draft badge */}
                                                            <div className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                                {t('drafts_section')}
                                                            </div>
                                                            {/* Delete button */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    draft.id && handleDeleteDraft(draft.id);
                                                                }}
                                                                disabled={deletingDraftId === draft.id}
                                                                className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                {deletingDraftId === draft.id ? (
                                                                    <Loader2 size={12} className="animate-spin" />
                                                                ) : (
                                                                    <Trash2 size={12} />
                                                                )}
                                                            </button>
                                                        </div>
                                                        <div className="p-3 flex-1 bg-gradient-to-b from-white to-amber-50/50">
                                                            <h3 className="font-bold text-gray-800 line-clamp-2 leading-tight text-sm">
                                                                {draft.title || t('untitled_draft')}
                                                            </h3>
                                                            <p className="text-[10px] text-amber-400 mt-1">
                                                                {draft.pageCount || 0} {t('pages_count')} · {new Date(draft.updatedAt || draft.createdAt).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Published Books Section */}
                                {displayBooks.length > 0 && (
                                    <div>
                                        {drafts.length > 0 && (
                                            <div className="flex items-center gap-2 mb-3">
                                                <Book size={16} className="text-emerald-500" />
                                                <h3 className="font-bold text-emerald-700 text-sm">{t('published_section')}</h3>
                                                <span className="text-xs text-emerald-400 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                    {displayBooks.length}
                                                </span>
                                            </div>
                                        )}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                                        >
                                            {displayBooks.map((book, index) => {
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
                                    </div>
                                )}
                            </div>
                        )
                    ) : displayBooks.length === 0 ? (
                        /* === BOOKSTORE TAB: Empty state === */
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
                            {displayBooks.map((book, index) => {
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
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};
