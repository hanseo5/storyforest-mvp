import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Edit3, Loader, BookOpen, AlertTriangle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPublishedBooks, deleteBook, getBookById } from '../services/bookService';
import { useStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import type { Book } from '../types';
import type { DraftBook } from '../types/draft';

interface BookManagementModalProps {
    onClose: () => void;
}

export const BookManagementModal: React.FC<BookManagementModalProps> = ({ onClose }) => {
    const navigate = useNavigate();
    const user = useStore((state) => state.user);
    const { t, targetLanguage } = useTranslation();
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [confirmDeleteTitle, setConfirmDeleteTitle] = useState<string>('');

    useEffect(() => {
        const loadBooks = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            try {
                const userBooks = await getPublishedBooks(user.uid);
                setBooks(userBooks);
            } catch (error) {
                console.error('[BookManagement] Error loading books:', error);
            } finally {
                setLoading(false);
            }
        };
        loadBooks();
    }, [user]);

    const handleDeleteClick = (e: React.MouseEvent, bookId: string, bookTitle: string) => {
        e.stopPropagation();
        setConfirmDeleteId(bookId);
        setConfirmDeleteTitle(bookTitle);
    };

    const handleConfirmDelete = async () => {
        if (!confirmDeleteId) return;

        const bookIdToDelete = confirmDeleteId;
        setConfirmDeleteId(null);
        setConfirmDeleteTitle('');
        setDeleting(bookIdToDelete);

        try {
            await deleteBook(bookIdToDelete);
            setBooks(books.filter(b => b.id !== bookIdToDelete));
        } catch (e) {
            console.error('[BookManagement] Delete failed:', e);
        } finally {
            setDeleting(null);
        }
    };

    const handleCancelDelete = () => {
        setConfirmDeleteId(null);
        setConfirmDeleteTitle('');
    };

    const handleEdit = async (bookId: string) => {
        // Load full book with pages, convert to DraftBook format, open in StoryEditor
        const fullBook = await getBookById(bookId);
        if (!fullBook) return;

        const existingDraft: DraftBook = {
            id: undefined, // Not a draft — will create new draft on save
            title: fullBook.title,
            authorId: fullBook.authorId,
            protagonist: fullBook.description || '',
            protagonistImage: fullBook.coverUrl || null,
            characters: [],
            style: fullBook.style || 'Soft Watercolor',
            pageCount: fullBook.pages.length,
            prompt: '',
            status: 'ready',
            createdAt: fullBook.createdAt,
            pages: fullBook.pages.map(p => ({
                pageNumber: p.pageNumber,
                text: p.text,
                imageUrl: p.imageUrl,
                imageStatus: 'complete' as const,
            })),
            originalLanguage: fullBook.originalLanguage,
        };

        onClose();
        navigate('/editor/story', {
            state: {
                existingDraft,
                protagonistImage: fullBook.coverUrl,
                editingBookId: bookId, // So StoryEditor can update instead of create
            }
        });
    };

    const formatDate = (timestamp: number) => {
        const lang = targetLanguage || 'English';
        const locale = lang === 'Korean' ? 'ko-KR' : lang === 'Japanese' ? 'ja-JP' : 'en-US';
        return new Date(timestamp).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 flex justify-between items-center text-white">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <BookOpen className="w-6 h-6" />
                        {t('bm_my_books')}
                    </h2>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader className="animate-spin text-amber-500 mb-3" size={40} />
                            <p className="text-gray-500">{t('bm_loading')}</p>
                        </div>
                    ) : books.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
                            <p className="text-lg font-medium">{t('bm_no_books')}</p>
                            <p className="text-sm mt-1">{t('bm_no_books_hint')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {books.map((book) => (
                                <motion.div
                                    key={book.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-amber-100 hover:border-amber-300 bg-amber-50/50 transition-all"
                                >
                                    {/* Book Cover */}
                                    <div className="w-16 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-amber-200 to-orange-200 flex-shrink-0 shadow-md">
                                        {book.coverUrl ? (
                                            <img
                                                src={book.coverUrl}
                                                alt={book.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <BookOpen className="text-amber-500" size={24} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Book Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 truncate">{book.title}</h3>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                            <Calendar size={12} />
                                            {formatDate(book.createdAt)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(book.id)}
                                            className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-full transition-colors"
                                            title={t('bm_view')}
                                        >
                                            <Edit3 size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteClick(e, book.id, book.title)}
                                            disabled={deleting === book.id}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                                            title={t('bm_delete')}
                                        >
                                            {deleting === book.id ? (
                                                <Loader size={18} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={18} />
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-amber-100 bg-amber-50/50">
                    <p className="text-xs text-amber-600 text-center">
                        {t('bm_total_books').replace('{count}', String(books.length))}
                    </p>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {confirmDeleteId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl"
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-5 text-white text-center">
                                <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
                                <h3 className="text-xl font-bold">{t('bm_confirm_delete')}</h3>
                            </div>

                            {/* Content */}
                            <div className="p-6 text-center">
                                <p className="text-gray-700 mb-2">
                                    <strong className="text-gray-900">"{confirmDeleteTitle}"</strong>
                                </p>
                                <p className="text-gray-600">
                                    {t('bm_delete_question')}
                                </p>
                                <p className="text-sm text-red-500 mt-2">
                                    ⚠️ {t('bm_delete_warning')}
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 p-4 bg-gray-50">
                                <button
                                    onClick={handleCancelDelete}
                                    className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:from-red-600 hover:to-orange-600 transition-all shadow-lg"
                                >
                                    {t('bm_delete')}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
