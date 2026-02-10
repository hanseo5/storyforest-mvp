/* eslint-disable react-hooks/rules-of-hooks -- Math.random for animation initial positions is acceptable */
import React, { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Star, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../hooks/useTranslation';
import owlImage from '../assets/mascots/owl.png';
import squirrelImage from '../assets/mascots/squirrel.png';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const { t } = useTranslation();

    const handleGuestLogin = async () => {
        try {
            // Simplified Login (Anonymous)
            await signInAnonymously(auth);
            navigate('/');
        } catch (err: unknown) {
            console.error('Login failed:', err);
            if (err instanceof Error) {
                // Friendly error message for "Anonymous auth not enabled"
                if (err.message.includes('admin-restricted-operation')) {
                    setError('Firebase Console에서 "익명(Anonymous)" 로그인을 활성화해주세요.');
                } else {
                    setError(err.message);
                }
            } else {
                setError(JSON.stringify(err));
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-100 via-green-100 to-emerald-200 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Forest Background Decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Tree silhouettes at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-emerald-700/40 to-transparent" />

                {/* Floating leaves */}
                {[...Array(12)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-6 h-6"
                        style={{
                            left: `${5 + i * 8}%`,
                            top: '-30px',
                        }}
                        animate={{
                            y: ['0vh', '110vh'],
                            rotate: [0, 360],
                            opacity: [0, 0.8, 0.8, 0],
                        }}
                        transition={{
                            duration: 14 + i * 1.5,
                            repeat: Infinity,
                            delay: i * 1.2,
                            ease: 'linear',
                        }}
                    >
                        <div
                            className="w-full h-full bg-green-500/40"
                            style={{
                                borderRadius: '0 50% 50% 50%',
                                transform: 'rotate(45deg)',
                            }}
                        />
                    </motion.div>
                ))}

                {/* Sparkles */}
                {[...Array(15)].map((_, i) => (
                    <motion.div
                        key={`sparkle-${i}`}
                        className="absolute text-amber-400"
                        style={{
                            left: `${5 + Math.random() * 90}%`,
                            top: `${5 + Math.random() * 90}%`,
                        }}
                        animate={{
                            opacity: [0, 1, 0],
                            scale: [0.5, 1.5, 0.5],
                        }}
                        transition={{
                            duration: 2.5,
                            repeat: Infinity,
                            delay: i * 0.3,
                        }}
                    >
                        <Sparkles size={14 + Math.random() * 8} />
                    </motion.div>
                ))}

                {/* Magic stars floating */}
                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={`star-${i}`}
                        className="absolute"
                        style={{
                            left: `${10 + Math.random() * 80}%`,
                            top: `${15 + Math.random() * 70}%`,
                            color: ['#facc15', '#f472b6', '#60a5fa', '#34d399'][i % 4],
                        }}
                        animate={{
                            y: [0, -30, 0],
                            opacity: [0.3, 1, 0.3],
                            rotate: [0, 180],
                        }}
                        transition={{
                            duration: 4 + i,
                            repeat: Infinity,
                            delay: i * 0.5,
                        }}
                    >
                        <Star size={12} fill="currentColor" />
                    </motion.div>
                ))}
            </div>

            {/* Main Content - Full Screen Layout */}
            <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">

                {/* Owl - Left Side (Large) */}
                <motion.div
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
                    className="relative hidden md:block"
                >
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-3xl scale-90" />

                    {/* Speech bubble */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8, type: 'spring' }}
                        className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white rounded-2xl px-5 py-3 shadow-xl border-2 border-amber-300 whitespace-nowrap z-20"
                    >
                        <p className="text-amber-800 font-bold text-sm">
                            ✏️ 동화를 써볼까요?
                        </p>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-amber-300 transform rotate-45" />
                    </motion.div>

                    <motion.img
                        src={owlImage}
                        alt="부엉이"
                        className="w-56 lg:w-72 h-auto object-contain drop-shadow-2xl relative z-10"
                        animate={{
                            y: [0, -15, 0],
                            rotate: [-2, 2, -2],
                        }}
                        transition={{
                            y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                            rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                        }}
                        style={{ filter: 'drop-shadow(0 25px 35px rgba(180, 83, 9, 0.35))' }}
                    />
                </motion.div>

                {/* Center - Login Card */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full max-w-md"
                >
                    {/* Mobile mascots (shown only on mobile) */}
                    <div className="flex justify-center gap-6 mb-6 md:hidden">
                        <motion.img
                            src={owlImage}
                            alt="부엉이"
                            className="w-24 h-24 object-contain drop-shadow-xl"
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 2.5, repeat: Infinity }}
                        />
                        <motion.img
                            src={squirrelImage}
                            alt="다람쥐"
                            className="w-24 h-24 object-contain drop-shadow-xl"
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                        />
                    </div>

                    {/* Welcome message */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-center mb-6"
                    >
                        <div className="inline-block bg-white/90 backdrop-blur-sm rounded-2xl px-8 py-4 shadow-xl border-2 border-emerald-200">
                            <p className="text-emerald-700 font-bold text-lg">
                                🌲 환영해요! 함께 동화를 만들어볼까요? 🌲
                            </p>
                        </div>
                    </motion.div>

                    {/* Login Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/95 backdrop-blur-md p-8 rounded-3xl shadow-2xl border-4 border-emerald-300/60"
                    >
                        {/* Logo */}
                        <div className="text-center mb-6">
                            <div className="flex justify-center mb-4">
                                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                                    <span className="text-5xl">🌲</span>
                                </div>
                            </div>
                            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-green-700 mb-1">
                                STORYFOREST
                            </h1>
                            <p className="text-emerald-600 font-medium text-lg">동화책방</p>
                        </div>

                        <p className="text-gray-600 text-center mb-8 text-lg">
                            {t('app_tagline')}
                        </p>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-xl mb-4 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <motion.button
                            onClick={handleGuestLogin}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full bg-emerald-500 text-white py-4 px-4 rounded-2xl font-bold hover:bg-emerald-600 flex items-center justify-center gap-3 transition-all shadow-lg text-lg"
                        >
                            <Sparkles size={24} />
                            <span>시작하기 (Guest)</span>
                            <ArrowRight size={20} />
                        </motion.button>

                        <p className="text-center text-gray-400 text-sm mt-6">
                            로그인하면 동화 만들기와 읽기를 시작할 수 있어요 ✨
                        </p>
                    </motion.div>
                </motion.div>

                {/* Squirrel - Right Side (Large) */}
                <motion.div
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 100 }}
                    className="relative hidden md:block"
                >
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-3xl scale-90" />

                    {/* Speech bubble */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.9, type: 'spring' }}
                        className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white rounded-2xl px-5 py-3 shadow-xl border-2 border-emerald-300 whitespace-nowrap z-20"
                    >
                        <p className="text-emerald-800 font-bold text-sm">
                            📖 책을 읽으러 가요!
                        </p>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r-2 border-b-2 border-emerald-300 transform rotate-45" />
                    </motion.div>

                    <motion.img
                        src={squirrelImage}
                        alt="다람쥐"
                        className="w-56 lg:w-72 h-auto object-contain drop-shadow-2xl relative z-10"
                        animate={{
                            y: [0, -15, 0],
                            rotate: [2, -2, 2],
                        }}
                        transition={{
                            y: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                            rotate: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                        }}
                        style={{ filter: 'drop-shadow(0 25px 35px rgba(5, 150, 105, 0.35))' }}
                    />

                    {/* Floating stars around squirrel */}
                    {[...Array(5)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute"
                            style={{
                                left: `${20 + Math.random() * 60}%`,
                                top: `${10 + Math.random() * 60}%`,
                                color: ['#facc15', '#f472b6', '#60a5fa'][i % 3],
                            }}
                            animate={{
                                opacity: [0, 1, 0],
                                scale: [0.5, 1.2, 0.5],
                                y: [0, -20, 0],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                delay: i * 0.4,
                            }}
                        >
                            <Star size={14} fill="currentColor" />
                        </motion.div>
                    ))}
                </motion.div>
            </div>

            {/* Footer */}
            <motion.footer
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="absolute bottom-4 left-0 right-0 z-10 text-center text-emerald-600/60 text-sm"
            >
                <p>🌲 STORYFOREST - 동화책방 🌲</p>
            </motion.footer>
        </div>
    );
};
