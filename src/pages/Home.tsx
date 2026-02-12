import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Sparkles, BookOpen, Feather, Star, Music } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useStore } from '../store';
import { getPendingGeneration } from '../services/cloudFunctionsService';


import { useTranslation } from '../hooks/useTranslation';
import owlImage from '../assets/mascots/owl.png';
import squirrelImage from '../assets/mascots/squirrel.png';

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useStore();
    const { t } = useTranslation();
    const [hoveredSection, setHoveredSection] = useState<'owl' | 'squirrel' | null>(null);

    // Check for pending story generation (from background)
    useEffect(() => {
        const pending = getPendingGeneration();
        if (pending) {
            console.log('[Home] Found pending generation, redirecting to /generating');
            navigate('/generating');
        }
    }, [navigate]);

    const handleNavigate = (path: string) => {
        localStorage.setItem('storyforest_visited', 'true');
        navigate(path);
    };





    const owlMessages = [
        t('owl_home_1'),
        t('owl_home_2'),
        t('owl_home_3'),
    ];

    const squirrelMessages = [
        t('squirrel_home_1'),
        t('squirrel_home_2'),
        t('squirrel_home_3'),
    ];

    const [owlMsgIndex, setOwlMsgIndex] = useState(0);
    const [squirrelMsgIndex, setSquirrelMsgIndex] = useState(0);

    useEffect(() => {
        setOwlMsgIndex(Math.floor(Math.random() * 3));
        setSquirrelMsgIndex(Math.floor(Math.random() * 3));
    }, []);

    return (
        <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-b from-amber-50 via-green-50 to-emerald-100">
            {/* Forest Background Decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Trees silhouette at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-emerald-800/20 to-transparent" />

                {/* Floating leaves */}
                {[...Array(10)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-6 h-6"
                        style={{
                            left: `${5 + i * 10}%`,
                            top: '-30px',
                        }}
                        animate={{
                            y: ['0vh', '110vh'],
                            rotate: [0, 360],
                            opacity: [0, 1, 1, 0],
                        }}
                        transition={{
                            duration: 12 + i * 1.5,
                            repeat: Infinity,
                            delay: i * 1,
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
                {useMemo(() => {
                    return [...Array(12)].map((_, i) => {
                        const left = 5 + Math.random() * 90;
                        const top = 5 + Math.random() * 90;
                        const size = 16 + Math.random() * 10;
                        return (
                            <motion.div
                                key={`sparkle-${i}`}
                                className="absolute text-amber-400"
                                style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                }}
                                animate={{
                                    opacity: [0, 1, 0],
                                    scale: [0.5, 1.3, 0.5],
                                }}
                                transition={{
                                    duration: 2.5,
                                    repeat: Infinity,
                                    delay: i * 0.3,
                                }}
                            >
                                <Sparkles size={size} />
                            </motion.div>
                        );
                    });
                }, [])}
            </div>

            {/* Header */}
            <header className="relative z-50 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    {/* Logo */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="text-3xl">🌲</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-emerald-800">STORYFOREST</h1>
                            <p className="text-sm text-emerald-600">{t('app_subtitle')}</p>
                        </div>
                    </motion.div>

                    {/* User Profile */}
                    <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-4 py-2 rounded-full shadow-md border border-white/50">
                        {user?.photoURL && (
                            <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full border-2 border-emerald-200" />
                        )}
                        <span className="text-sm font-medium text-emerald-700 hidden sm:block">
                            {user?.displayName || t('default_user')}
                        </span>
                        <button
                            onClick={() => auth.signOut()}
                            className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-full transition-colors"
                            title={t('logout')}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 relative z-10">
                {/* MAKE Mode - Owl Section */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onHoverStart={() => setHoveredSection('owl')}
                    onHoverEnd={() => setHoveredSection(null)}
                    className="flex-1 bg-gradient-to-br from-amber-100 via-orange-50 to-yellow-100 rounded-3xl cursor-pointer relative overflow-hidden border-4 border-amber-300/60 shadow-xl hover:shadow-2xl hover:border-amber-400 transition-all duration-300 group min-h-[400px] md:min-h-[500px]"
                    onClick={() => handleNavigate('/create')}
                >
                    {/* Background effects */}
                    <div className="absolute inset-0">
                        {/* Magic particles when hovered */}
                        <AnimatePresence>
                            {hoveredSection === 'owl' && [...Array(8)].map((_, i) => {
                                const yOffset = -50 - Math.random() * 100;
                                const xOffset = Math.random() * 100 - 50;
                                const leftPos = 40 + Math.random() * 20;
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{
                                            opacity: [0, 1, 0],
                                            scale: [0, 1, 0],
                                            y: [0, yOffset],
                                            x: xOffset,
                                        }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 1.5, delay: i * 0.15 }}
                                        className="absolute text-amber-400"
                                        style={{ bottom: '30%', left: `${leftPos}%` }}
                                    >
                                        <Star size={16} fill="currentColor" />
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col p-6 md:p-8">
                        {/* Title area */}
                        <div className="flex-shrink-0">
                            <span className="inline-block px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-full mb-3 shadow-lg">
                                ✏️ CREATE
                            </span>
                            <h2 className="text-2xl md:text-4xl font-bold text-amber-800 mb-2">
                                {t('make_story')}
                            </h2>
                            <p className="text-amber-700/80 text-base md:text-lg">
                                {t('make_story_desc')}
                            </p>
                        </div>

                        {/* Owl mascot - LARGE and centered */}
                        <div className="flex-1 flex items-center justify-center relative mt-4">
                            {/* Large speech bubble */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.6, type: 'spring' }}
                                className="absolute -top-2 md:top-0 left-1/2 -translate-x-1/2 bg-white rounded-2xl px-6 py-4 shadow-xl border-3 border-amber-300 z-20"
                            >
                                <motion.p
                                    className="text-amber-800 font-bold text-base md:text-lg text-center"
                                    animate={hoveredSection === 'owl' ? { scale: [1, 1.05, 1] } : {}}
                                    transition={{ duration: 0.5 }}
                                >
                                    {owlMessages[owlMsgIndex]}
                                </motion.p>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-3 border-b-3 border-amber-300 transform rotate-45" />
                            </motion.div>

                            {/* OWL - Very Large and Animated */}
                            <motion.div
                                className="relative mt-16"
                                animate={hoveredSection === 'owl' ? {
                                    scale: 1.1,
                                    rotate: [-2, 2, -2],
                                } : {
                                    y: [0, -12, 0],
                                }}
                                transition={hoveredSection === 'owl' ? {
                                    rotate: { duration: 0.5, repeat: Infinity },
                                    scale: { duration: 0.3 },
                                } : {
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                }}
                            >
                                {/* Glow effect */}
                                <div className="absolute inset-0 bg-amber-400/30 rounded-full blur-3xl scale-75" />

                                <motion.img
                                    src={owlImage}
                                    alt="부엉이"
                                    className="w-48 md:w-72 lg:w-80 h-auto drop-shadow-2xl relative z-10"
                                    style={{ filter: 'drop-shadow(0 20px 30px rgba(180, 83, 9, 0.3))' }}
                                />

                                {/* Feather icon floating */}
                                <motion.div
                                    className="absolute -right-4 top-0 text-amber-500"
                                    animate={{
                                        rotate: [0, 15, 0],
                                        y: [0, -10, 0],
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    <Feather size={32} />
                                </motion.div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Action button at bottom */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <motion.div
                            className="bg-amber-500 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg flex items-center gap-2"
                            animate={hoveredSection === 'owl' ? { scale: 1.05 } : { scale: 1 }}
                        >
                            <BookOpen size={22} />
                            {t('create_btn')}
                        </motion.div>
                    </div>
                </motion.div>

                {/* READ Mode - Squirrel Section */}
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onHoverStart={() => setHoveredSection('squirrel')}
                    onHoverEnd={() => setHoveredSection(null)}
                    className="flex-1 bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100 rounded-3xl cursor-pointer relative overflow-hidden border-4 border-emerald-300/60 shadow-xl hover:shadow-2xl hover:border-emerald-400 transition-all duration-300 group min-h-[400px] md:min-h-[500px]"
                    onClick={() => handleNavigate('/library')}
                >
                    {/* Background effects */}
                    <div className="absolute inset-0">
                        {/* Magic stars when hovered */}
                        <AnimatePresence>
                            {hoveredSection === 'squirrel' && [...Array(10)].map((_, i) => {
                                const yOffset = -80 - Math.random() * 60;
                                const xOffset = Math.random() * 120 - 60;
                                const leftPos = 35 + Math.random() * 30;
                                const color = ['#facc15', '#f472b6', '#60a5fa', '#34d399'][i % 4];
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{
                                            opacity: [0, 1, 0],
                                            scale: [0, 1.2, 0],
                                            y: [0, yOffset],
                                            x: xOffset,
                                        }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 1.2, delay: i * 0.1 }}
                                        className="absolute"
                                        style={{
                                            bottom: '35%',
                                            left: `${leftPos}%`,
                                            color
                                        }}
                                    >
                                        <Star size={14} fill="currentColor" />
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col p-6 md:p-8">
                        {/* Title area */}
                        <div className="flex-shrink-0">
                            <span className="inline-block px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-full mb-3 shadow-lg">
                                📖 READ
                            </span>
                            <h2 className="text-2xl md:text-4xl font-bold text-emerald-800 mb-2">
                                {t('read_story')}
                            </h2>
                            <p className="text-emerald-700/80 text-base md:text-lg">
                                {t('read_story_desc')}
                            </p>
                        </div>

                        {/* Squirrel mascot - LARGE and centered */}
                        <div className="flex-1 flex items-center justify-center relative mt-4">
                            {/* Large speech bubble */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.7, type: 'spring' }}
                                className="absolute -top-2 md:top-0 left-1/2 -translate-x-1/2 bg-white rounded-2xl px-6 py-4 shadow-xl border-3 border-emerald-300 z-20"
                            >
                                <motion.p
                                    className="text-emerald-800 font-bold text-base md:text-lg text-center"
                                    animate={hoveredSection === 'squirrel' ? { scale: [1, 1.05, 1] } : {}}
                                    transition={{ duration: 0.5 }}
                                >
                                    {squirrelMessages[squirrelMsgIndex]}
                                </motion.p>
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-3 border-b-3 border-emerald-300 transform rotate-45" />
                            </motion.div>

                            {/* SQUIRREL - Very Large and Animated */}
                            <motion.div
                                className="relative mt-16"
                                animate={hoveredSection === 'squirrel' ? {
                                    scale: 1.1,
                                    rotate: [-2, 2, -2],
                                } : {
                                    y: [0, -12, 0],
                                }}
                                transition={hoveredSection === 'squirrel' ? {
                                    rotate: { duration: 0.4, repeat: Infinity },
                                    scale: { duration: 0.3 },
                                } : {
                                    duration: 3,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                    delay: 0.5,
                                }}
                            >
                                {/* Glow effect */}
                                <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-3xl scale-75" />

                                <motion.img
                                    src={squirrelImage}
                                    alt="다람쥐"
                                    className="w-48 md:w-72 lg:w-80 h-auto drop-shadow-2xl relative z-10"
                                    style={{ filter: 'drop-shadow(0 20px 30px rgba(5, 150, 105, 0.3))' }}
                                />

                                {/* Music notes floating */}
                                <motion.div
                                    className="absolute -left-4 top-8 text-emerald-500"
                                    animate={{
                                        rotate: [0, -15, 0],
                                        y: [0, -8, 0],
                                    }}
                                    transition={{ duration: 1.8, repeat: Infinity }}
                                >
                                    <Music size={28} />
                                </motion.div>
                            </motion.div>
                        </div>
                    </div>

                    {/* Action button at bottom */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                        <motion.div
                            className="bg-emerald-500 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg flex items-center gap-2"
                            animate={hoveredSection === 'squirrel' ? { scale: 1.05 } : { scale: 1 }}
                        >
                            <BookOpen size={22} />
                            {t('read_btn')}
                        </motion.div>
                    </div>
                </motion.div>
            </div>

            {/* Footer */}
            <footer className="relative z-10 text-center py-4 text-emerald-600/60 text-sm">
                <p>{t('footer_tagline')}</p>
            </footer>
        </div>
    );
};
