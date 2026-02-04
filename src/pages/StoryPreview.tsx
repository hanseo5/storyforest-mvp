import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, RefreshCw, BookOpen, Sparkles, ChevronLeft } from 'lucide-react';
import { useStore } from '../store';
import { publishBook } from '../services/bookService';
import type { StoryVariables } from '../types/draft';
import owlImage from '../assets/mascots/owl.png';

interface GeneratedPage {
    pageNumber: number;
    text: string;
    imageUrl?: string;
}

interface GeneratedStory {
    title: string;
    style: string;
    pages: GeneratedPage[];
}

export const StoryPreview: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useStore();

    const state = location.state as {
        story: GeneratedStory;
        variables: StoryVariables
    } | null;

    const [currentPage, setCurrentPage] = useState(0);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [showCongrats, setShowCongrats] = useState(true);

    // Hide congrats after a few seconds
    React.useEffect(() => {
        const timer = setTimeout(() => setShowCongrats(false), 5000);
        return () => clearTimeout(timer);
    }, []);

    if (!state?.story) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-amber-100 to-emerald-100 flex items-center justify-center">
                <div className="text-center bg-white p-8 rounded-3xl shadow-xl border-2 border-emerald-200">
                    <img
                        src={owlImage}
                        alt="부엉이"
                        className="w-24 h-24 object-contain mx-auto mb-4 opacity-50"
                    />
                    <p className="text-gray-600 mb-4">동화책을 찾을 수 없습니다.</p>
                    <button
                        onClick={() => navigate('/create')}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                    >
                        새 동화 만들기
                    </button>
                </div>
            </div>
        );
    }

    const { story, variables } = state;
    const totalPages = story.pages.length;
    const page = story.pages[currentPage];

    const handlePrevPage = () => {
        if (currentPage > 0) setCurrentPage(currentPage - 1);
    };

    const handleNextPage = () => {
        if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
    };

    const handleRegenerate = () => {
        setIsRegenerating(true);
        navigate('/generating', { state: { variables } });
    };

    const handlePublish = async () => {
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }

        setIsPublishing(true);
        try {
            // Convert generated story to book format and publish
            const bookData = {
                title: story.title,
                authorId: user.uid,
                style: story.style,
                pages: story.pages.map(p => ({
                    pageNumber: p.pageNumber,
                    text: p.text,
                    imageUrl: p.imageUrl || ''
                })),
                status: 'published' as const,
                createdAt: Date.now(),
                variables: variables
            };

            await publishBook(bookData);

            // Navigate to library
            navigate('/library', {
                state: { message: '동화책이 출판되었습니다! ✨' }
            });
        } catch (error) {
            console.error('[StoryPreview] Publish error:', error);
            alert('출판에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-100 via-green-50 to-emerald-100 relative overflow-hidden">
            {/* Forest Background Decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Tree at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-emerald-200/50 to-transparent" />

                {/* Floating sparkles */}
                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={`sparkle-${i}`}
                        className="absolute text-amber-400/30"
                        style={{
                            left: `${5 + Math.random() * 90}%`,
                            top: `${5 + Math.random() * 90}%`,
                        }}
                        animate={{
                            opacity: [0, 1, 0],
                            scale: [0.5, 1.2, 0.5],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            delay: i * 0.4,
                        }}
                    >
                        <Sparkles size={12} />
                    </motion.div>
                ))}
            </div>

            {/* Owl Congratulations */}
            <AnimatePresence>
                {showCongrats && (
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className="fixed bottom-6 left-6 z-50 flex items-end gap-3"
                    >
                        {/* Owl */}
                        <motion.img
                            src={owlImage}
                            alt="부엉이"
                            className="w-24 h-24 object-contain drop-shadow-xl"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />

                        {/* Speech bubble */}
                        <div className="bg-white rounded-2xl px-5 py-3 shadow-xl border-2 border-amber-200 max-w-xs">
                            <p className="text-amber-800 font-medium text-sm">
                                🎉 짜잔! {variables.childName}의 동화책이 완성되었어요! 마음에 드시면 출판해주세요~
                            </p>
                            <div className="absolute -bottom-2 left-12 w-4 h-4 bg-white border-r-2 border-b-2 border-amber-200 transform rotate-45" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="sticky top-0 bg-white/90 backdrop-blur-lg border-b-2 border-emerald-100 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/create')}
                        className="flex items-center text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        처음으로
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-xl">🌲</span>
                        <h1 className="text-lg font-bold text-emerald-800 truncate max-w-[200px]">
                            {story.title}
                        </h1>
                    </div>

                    <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">
                        {currentPage + 1} / {totalPages}
                    </div>
                </div>
            </div>

            {/* Book Preview */}
            <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
                {/* Page Display */}
                <div className="relative aspect-[3/4] md:aspect-[4/3] bg-white rounded-3xl shadow-2xl overflow-hidden mb-8 border-4 border-emerald-200/50">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentPage}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.3 }}
                            className="absolute inset-0"
                        >
                            {/* Page Image */}
                            {page.imageUrl ? (
                                <img
                                    src={page.imageUrl}
                                    alt={`Page ${page.pageNumber}`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-amber-100 flex items-center justify-center">
                                    <BookOpen className="w-16 h-16 text-emerald-300" />
                                </div>
                            )}

                            {/* Text Overlay */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-900/80 via-emerald-800/60 to-transparent p-6 md:p-8">
                                <p className="text-white text-lg md:text-2xl font-medium leading-relaxed drop-shadow-lg">
                                    {page.text}
                                </p>
                            </div>

                            {/* Page Number */}
                            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur px-4 py-2 rounded-full text-sm font-bold text-emerald-700 shadow-md border border-emerald-200">
                                📄 {page.pageNumber}
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation Arrows */}
                    {currentPage > 0 && (
                        <button
                            onClick={handlePrevPage}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/95 backdrop-blur rounded-full flex items-center justify-center shadow-lg border-2 border-emerald-200 hover:scale-110 hover:border-emerald-400 transition-all"
                        >
                            <ArrowLeft className="w-6 h-6 text-emerald-700" />
                        </button>
                    )}
                    {currentPage < totalPages - 1 && (
                        <button
                            onClick={handleNextPage}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/95 backdrop-blur rounded-full flex items-center justify-center shadow-lg border-2 border-emerald-200 hover:scale-110 hover:border-emerald-400 transition-all"
                        >
                            <ArrowRight className="w-6 h-6 text-emerald-700" />
                        </button>
                    )}
                </div>

                {/* Page Dots */}
                <div className="flex justify-center gap-2 mb-8 flex-wrap">
                    {story.pages.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`w-3 h-3 rounded-full transition-all ${i === currentPage
                                ? 'bg-emerald-600 scale-125'
                                : 'bg-emerald-200 hover:bg-emerald-300'
                                }`}
                        />
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={handleRegenerate}
                        disabled={isRegenerating}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-emerald-200 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-50 hover:border-emerald-300 transition-all disabled:opacity-50 shadow-md"
                    >
                        <RefreshCw size={20} className={isRegenerating ? 'animate-spin' : ''} />
                        다시 만들기
                    </button>

                    <button
                        onClick={handlePublish}
                        disabled={isPublishing}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-emerald-300 disabled:opacity-50"
                    >
                        {isPublishing ? (
                            <>
                                <span className="animate-spin">✨</span>
                                출판 중...
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} />
                                출판하기 📚
                            </>
                        )}
                    </button>
                </div>

                {/* Story Info */}
                <div className="mt-8 p-4 bg-white/80 rounded-2xl border-2 border-emerald-100 shadow-md">
                    <div className="flex items-center gap-4 text-sm text-emerald-700">
                        <span>📖 {totalPages}페이지</span>
                        <span>🎨 {story.style}</span>
                        <span>👶 {variables.childName} ({variables.childAge}살)</span>
                    </div>
                </div>

                {/* STORYFOREST branding */}
                <div className="mt-6 text-center">
                    <p className="text-emerald-600/60 text-sm">🌲 STORYFOREST - 동화책방 🌲</p>
                </div>
            </div>
        </div>
    );
};
