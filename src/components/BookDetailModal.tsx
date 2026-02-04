import React, { useRef, useState, useEffect } from 'react';
import { X, BookOpen, Headphones, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { translateContent } from '../services/geminiService';
import { useStore } from '../store';
import type { Book } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { detectLanguage, cleanTranslatedText } from '../utils/textUtils';

interface BookDetailModalProps {
    book: Book | null;
    onClose: () => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({ book, onClose }) => {
    const navigate = useNavigate();
    const modalRef = useRef<HTMLDivElement>(null);
    const { targetLanguage, setTranslatedBook, translationCache } = useStore();
    const { t } = useTranslation();
    const [fullBook, setFullBook] = useState<(Book & { pages: any[] }) | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);

    // Automatic translation when language changes (if modal is open)
    useEffect(() => {
        if (!book || !targetLanguage) return;

        const originalLang = book.originalLanguage || 'English';
        const detectedLang = detectLanguage(book.title) || originalLang;

        // Skip translation if target matches detected content language
        if (targetLanguage === detectedLang) return;

        const prepareContent = async () => {
            // 1. Check existing state cache
            if (translationCache[book.id]?.[targetLanguage]?.pages) {
                return;
            }

            setIsTranslating(true);
            try {
                // 2. Check Firestore cache
                const { getCachedTranslation } = await import('../services/translationService');
                const cached = await getCachedTranslation(book.id, targetLanguage);

                if (cached) {
                    setTranslatedBook(book.id, targetLanguage, cached);
                    setIsTranslating(false);
                    return;
                }

                // 3. Not in Firestore - Manual translate (Fall-back if background sync hasn't reached it)
                let currentPages = fullBook?.pages;
                if (!fullBook || fullBook.id !== book.id) {
                    const data = await import('../services/bookService').then(m => m.getBookById(book.id));
                    if (data) {
                        setFullBook(data);
                        currentPages = data.pages;
                    }
                }

                if (!currentPages) return;

                const [tTitle, tDesc, ...tPages] = await Promise.all([
                    translateContent(book.title, targetLanguage),
                    translateContent(book.description || '', targetLanguage),
                    ...currentPages.map(p => translateContent(p.text, targetLanguage))
                ]);

                const pagesMap: Record<number, string> = {};
                currentPages.forEach((p, i) => {
                    pagesMap[p.pageNumber] = tPages[i];
                });

                setTranslatedBook(book.id, targetLanguage, {
                    title: tTitle,
                    description: tDesc,
                    pages: pagesMap
                });
            } catch (e) {
                console.error('[BookDetailModal] Pre-translation failed:', e);
            } finally {
                setIsTranslating(false);
            }
        };

        prepareContent();
    }, [book, targetLanguage, translationCache, book?.id]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    const handleListen = () => {
        if (!book) return;
        // Audio is already pre-generated during preload, just navigate to reader
        navigate(`/read/${book.id}?mode=listen`);
    };

    if (!book) return null;

    const originalLang = book?.originalLanguage || 'English';
    const detectedLang = detectLanguage(book.title) || originalLang;
    const needsTranslation = targetLanguage && targetLanguage !== detectedLang;

    const cachedData = needsTranslation ? translationCache[book.id]?.[targetLanguage] || {} : {};
    const displayTitle = cachedData.title ? cleanTranslatedText(cachedData.title) : book.title;
    const displayDesc = cachedData.description ? cleanTranslatedText(cachedData.description) : (book.description || t('no_description'));

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={handleBackdropClick}
            >
                <motion.div
                    ref={modalRef}
                    initial={{ scale: 0.9, y: 100, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 100, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
                >
                    <div className="w-full md:w-2/5 h-64 md:h-auto bg-gray-100 relative">
                        <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                        <button
                            onClick={onClose}
                            className="absolute top-4 left-4 md:hidden bg-white/50 p-2 rounded-full backdrop-blur-md"
                        >
                            <X size={24} />
                        </button>

                    </div>

                    <div className="flex-1 p-8 flex flex-col relative">
                        <div className="mb-6 mt-4 md:mt-0">
                            <h2 className={`text-3xl font-bold text-gray-800 mb-2 leading-tight ${isTranslating ? 'animate-pulse' : ''}`}>
                                {isTranslating ? '...' : displayTitle}
                            </h2>
                            <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                {book.style || "Story"}
                            </span>
                        </div>

                        <p className={`text-gray-600 leading-relaxed mb-8 flex-1 overflow-y-auto pr-2 ${isTranslating ? 'animate-pulse' : ''}`}>
                            {isTranslating ? t('translating') : displayDesc}
                        </p>

                        <div className="grid grid-cols-1 gap-4">
                            <button
                                onClick={() => navigate(`/read/${book.id}`)}
                                disabled={isTranslating}
                                className={`flex items-center justify-center gap-3 bg-indigo-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-transform active:scale-95 shadow-lg shadow-indigo-200 ${isTranslating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isTranslating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        {t('preparing_story')}
                                    </>
                                ) : (
                                    <>
                                        <BookOpen className="w-6 h-6" />
                                        {t('read_story_btn')}
                                    </>
                                )}
                            </button>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={handleListen}
                                    className="flex items-center justify-center gap-2 bg-orange-50 text-orange-700 py-3 px-4 rounded-xl font-bold hover:bg-orange-100 transition-colors border border-orange-100"
                                >
                                    <Headphones className="w-5 h-5" />
                                    {t('listen')}
                                </button>
                                <button
                                    className="flex items-center justify-center gap-2 bg-pink-50 text-pink-700 py-3 px-4 rounded-xl font-bold hover:bg-pink-100 transition-colors border border-pink-100"
                                    onClick={() => navigate(`/read/${book.id}?mode=record`)}
                                >
                                    <Mic className="w-5 h-5" />
                                    {t('record')}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
