import React from 'react';
import { Globe, ArrowRight, X, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import owlImage from '../assets/mascots/owl.png';
import squirrelImage from '../assets/mascots/squirrel.png';

const LANGUAGES = [
    { code: 'English', label: 'English', sub: 'Default language', emoji: '🇬🇧' },
    { code: 'Korean', label: '한국어', sub: '한국인을 위한 설정', emoji: '🇰🇷' },
    { code: 'Japanese', label: '日本語', sub: '日本人向けの設定', emoji: '🇯🇵' },
];

interface LanguageSelectionProps {
    onClose?: () => void;
    isClosable?: boolean;
    onLanguageSelected?: (lang: string) => void;
}

export const LanguageSelection: React.FC<LanguageSelectionProps> = ({ onClose, isClosable, onLanguageSelected }) => {
    const { setTargetLanguage, targetLanguage } = useStore();
    const { t } = useTranslation();

    const handleSelect = async (code: string) => {
        if (onLanguageSelected) {
            onLanguageSelected(code);
        } else {
            await setTargetLanguage(code);
        }
        if (onClose) onClose();
    };

    return (
        <div className="fixed inset-0 z-[999] bg-gradient-to-b from-emerald-900 via-green-900 to-emerald-950 flex items-center justify-center p-6 overflow-hidden">
            {/* Close button for settings mode */}
            {isClosable && (
                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 z-[1001] p-3 text-emerald-300 hover:text-white bg-emerald-800/50 hover:bg-emerald-700 rounded-full backdrop-blur-md transition-all active:scale-95"
                >
                    <X size={28} />
                </button>
            )}

            {/* Forest Background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[100px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-20%] w-[50%] h-[50%] bg-amber-500/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>

                {/* Trees silhouette at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-emerald-950 to-transparent opacity-70" />

                {/* Fireflies */}
                {[...Array(15)].map((_, i) => {
                    const left = Math.random() * 100;
                    const top = Math.random() * 100;
                    const duration = 2 + Math.random() * 2;
                    const delay = Math.random() * 2;
                    return (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-amber-300 rounded-full"
                            style={{
                                left: `${left}%`,
                                top: `${top}%`,
                            }}
                            animate={{
                                opacity: [0.2, 1, 0.2],
                                scale: [0.5, 1.3, 0.5],
                            }}
                            transition={{
                                duration,
                                repeat: Infinity,
                                delay,
                            }}
                        />
                    );
                })}

                {/* Sparkles */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={`sparkle-${i}`}
                        className="absolute text-amber-400/50"
                        style={{
                            left: `${10 + i * 15}%`,
                            top: `${15 + (i % 3) * 25}%`,
                        }}
                        animate={{
                            y: [0, -10, 0],
                            opacity: [0.2, 0.6, 0.2],
                        }}
                        transition={{
                            duration: 3 + i,
                            repeat: Infinity,
                            delay: i * 0.3,
                        }}
                    >
                        <Sparkles size={14} />
                    </motion.div>
                ))}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full relative z-10"
            >
                {/* Mascots */}
                <div className="flex justify-center gap-16 mb-6">
                    {/* Owl */}
                    <motion.img
                        src={owlImage}
                        alt="부엉이"
                        className="w-20 h-20 object-contain drop-shadow-2xl"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{ filter: 'drop-shadow(0 0 15px rgba(251, 191, 36, 0.3))' }}
                    />

                    {/* Squirrel */}
                    <motion.img
                        src={squirrelImage}
                        alt="다람쥐"
                        className="w-20 h-20 object-contain drop-shadow-2xl"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        style={{ filter: 'drop-shadow(0 0 15px rgba(52, 211, 153, 0.3))' }}
                    />
                </div>

                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border-4 border-white/20">
                        <Globe className="text-white w-10 h-10" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight drop-shadow-lg">{t('select_language')}</h1>
                    <p className="text-emerald-200 text-lg">{t('select_language_subtitle')}</p>
                </div>

                <div className="space-y-4">
                    {LANGUAGES.map((lang, idx) => (
                        <motion.button
                            key={lang.code}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            onClick={() => handleSelect(lang.code)}
                            className={`w-full backdrop-blur-xl ${targetLanguage === lang.code
                                    ? 'bg-emerald-500/30 border-emerald-400'
                                    : 'bg-white/10 border-white/20 hover:bg-white/20'
                                } border-2 p-5 rounded-2xl flex items-center justify-between group transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-95`}
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-2xl">{lang.emoji}</span>
                                <div className="flex flex-col items-start">
                                    <span className="text-xl font-bold text-white group-hover:text-emerald-200 transition-colors">
                                        {lang.label}
                                    </span>
                                    <span className="text-sm text-emerald-300/70 font-medium">{lang.sub}</span>
                                </div>
                            </div>
                            <div className={`w-10 h-10 ${targetLanguage === lang.code
                                    ? 'bg-emerald-500'
                                    : 'bg-emerald-700/50 group-hover:bg-emerald-600'
                                } rounded-xl flex items-center justify-center text-white transition-all transform group-hover:rotate-12`}>
                                <ArrowRight size={20} />
                            </div>
                        </motion.button>
                    ))}
                </div>

                <div className="mt-12 text-center space-y-4">
                    <p className="text-emerald-300/60 text-sm font-medium">
                        {t('change_language_hint')}
                    </p>
                    <div className="flex justify-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-700"></div>
                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                        <div className="w-2 h-2 rounded-full bg-emerald-700"></div>
                    </div>
                    <p className="text-emerald-400/50 text-xs mt-4">🌲 STORYFOREST 🌲</p>
                </div>
            </motion.div>
        </div>
    );
};
