import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bug, Lightbulb, ThumbsUp, HelpCircle, Send } from 'lucide-react';
import { submitFeedback, type FeedbackCategory } from '../services/feedbackService';
import { useTranslation } from '../hooks/useTranslation';
import squirrelImage from '../assets/mascots/squirrel.png';

const CATEGORIES: { key: FeedbackCategory; icon: React.ReactNode; colorClass: string }[] = [
    { key: 'bug', icon: <Bug size={18} />, colorClass: 'from-red-400 to-rose-500' },
    { key: 'suggestion', icon: <Lightbulb size={18} />, colorClass: 'from-amber-400 to-yellow-500' },
    { key: 'usability', icon: <ThumbsUp size={18} />, colorClass: 'from-blue-400 to-cyan-500' },
    { key: 'other', icon: <HelpCircle size={18} />, colorClass: 'from-gray-400 to-slate-500' },
];

export const FeedbackWidget: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [category, setCategory] = useState<FeedbackCategory | null>(null);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
    const [showBubble, setShowBubble] = useState(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Show bubble on mount, then hide after 6 seconds
    useEffect(() => {
        const timer = setTimeout(() => setShowBubble(false), 6000);
        return () => clearTimeout(timer);
    }, []);

    // Auto-focus textarea when category is selected
    useEffect(() => {
        if (category && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [category]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(() => {
            setCategory(null);
            setMessage('');
            setStatus('idle');
        }, 300);
    };

    const handleSubmit = async () => {
        if (!category || !message.trim()) return;
        setStatus('sending');
        try {
            await submitFeedback({ category, message: message.trim() });
            setStatus('sent');
            setTimeout(() => handleClose(), 1800);
        } catch {
            setStatus('error');
        }
    };

    // Don't show on certain pages
    const hiddenPaths = ['/generating'];
    if (hiddenPaths.includes(window.location.pathname)) return null;

    return (
        <>
            {/* Mascot + Speech Bubble (feedback trigger) */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: 80 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 80 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className="fixed bottom-0 right-0 z-[200] flex flex-col items-end pointer-events-none"
                    >
                        {/* Speech Bubble */}
                        <AnimatePresence>
                            {showBubble && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.85 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.85 }}
                                    className="mr-6 mb-2 pointer-events-auto"
                                >
                                    <button
                                        onClick={() => { setShowBubble(false); setIsOpen(true); }}
                                        className="relative bg-white rounded-2xl px-5 py-3 shadow-xl border-2 border-emerald-300 hover:border-emerald-400 hover:shadow-2xl transition-all active:scale-95 cursor-pointer group"
                                    >
                                        <p className="text-emerald-800 font-bold text-sm whitespace-nowrap">
                                            {t('fb_mascot_bubble')}
                                        </p>
                                        <div className="absolute -bottom-2 right-16 w-4 h-4 bg-white border-r-2 border-b-2 border-emerald-300 transform rotate-45 group-hover:border-emerald-400 transition-colors" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Squirrel Mascot */}
                        <motion.button
                            onClick={() => { setShowBubble(false); setIsOpen(true); }}
                            className="pointer-events-auto relative cursor-pointer focus:outline-none"
                            animate={{ y: [0, -6, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.95 }}
                            onMouseEnter={() => setShowBubble(true)}
                            aria-label={t('fb_title')}
                        >
                            <div className="absolute inset-0 bg-emerald-400/15 rounded-full blur-2xl scale-75" />
                            <img
                                src={squirrelImage}
                                alt={t('fb_title')}
                                className="w-28 md:w-36 h-auto object-contain drop-shadow-xl relative z-10"
                                style={{ filter: 'drop-shadow(0 8px 16px rgba(5, 150, 105, 0.3))' }}
                            />
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Feedback Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={panelRef}
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed bottom-6 right-6 z-[201] w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                                <img src={squirrelImage} alt="" className="w-6 h-6 object-contain" />
                                <span className="font-semibold text-sm">{t('fb_title')}</span>
                            </div>
                            <button
                                onClick={handleClose}
                                className="text-white/70 hover:text-white p-1 rounded transition-colors"
                                aria-label={t('close')}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4">
                            {status === 'sent' ? (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-center py-6"
                                >
                                    <div className="text-4xl mb-3">🌟</div>
                                    <p className="text-emerald-700 font-semibold text-sm">{t('fb_thanks')}</p>
                                    <p className="text-gray-500 text-xs mt-1">{t('fb_thanks_sub')}</p>
                                </motion.div>
                            ) : (
                                <>
                                    <p className="text-gray-500 text-xs mb-3">{t('fb_subtitle')}</p>

                                    {/* Category Selection */}
                                    <div className="grid grid-cols-4 gap-2 mb-3">
                                        {CATEGORIES.map(cat => (
                                            <button
                                                key={cat.key}
                                                onClick={() => setCategory(cat.key)}
                                                className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-medium transition-all ${
                                                    category === cat.key
                                                        ? `bg-gradient-to-br ${cat.colorClass} text-white shadow-md scale-105`
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {cat.icon}
                                                <span className="truncate w-full text-center">{t(`fb_cat_${cat.key}`)}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Message Input */}
                                    <textarea
                                        ref={textareaRef}
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        placeholder={category ? t(`fb_placeholder_${category}`) : t('fb_placeholder_default')}
                                        rows={3}
                                        maxLength={1000}
                                        className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-transparent transition-all"
                                    />

                                    {/* Footer */}
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[10px] text-gray-400">{message.length}/1000</span>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={!category || !message.trim() || status === 'sending'}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md active:scale-95 transition-all"
                                        >
                                            {status === 'sending' ? (
                                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <Send size={13} />
                                            )}
                                            {status === 'sending' ? t('fb_sending') : t('fb_send')}
                                        </button>
                                    </div>

                                    {status === 'error' && (
                                        <p className="text-red-500 text-xs mt-2">{t('fb_error')}</p>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
