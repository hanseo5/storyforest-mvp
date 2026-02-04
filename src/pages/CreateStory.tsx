import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Check, Edit3, Home, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import { BookManagementModal } from '../components/BookManagementModal';
import owlImage from '../assets/mascots/owl.png';

// 관심사 프리셋
const INTERESTS = [
    { id: 'dinosaur', emoji: '🦕', label: '공룡', labelEn: 'Dinosaur' },
    { id: 'car', emoji: '🚗', label: '자동차', labelEn: 'Car' },
    { id: 'space', emoji: '🚀', label: '우주', labelEn: 'Space' },
    { id: 'animal', emoji: '🐰', label: '동물', labelEn: 'Animal' },
    { id: 'princess', emoji: '👸', label: '공주', labelEn: 'Princess' },
    { id: 'superhero', emoji: '🦸', label: '슈퍼히어로', labelEn: 'Superhero' },
    { id: 'robot', emoji: '🤖', label: '로봇', labelEn: 'Robot' },
    { id: 'ocean', emoji: '🐠', label: '바다', labelEn: 'Ocean' },
    { id: 'fairy', emoji: '🧚', label: '요정', labelEn: 'Fairy' },
    { id: 'dragon', emoji: '🐉', label: '용', labelEn: 'Dragon' },
    { id: 'train', emoji: '🚂', label: '기차', labelEn: 'Train' },
    { id: 'food', emoji: '🍕', label: '음식', labelEn: 'Food' },
];

// 메시지 프리셋
const MESSAGES = [
    { id: 'sleep', emoji: '🌙', label: '오늘은 일찍 자자', labelEn: 'Time to sleep early' },
    { id: 'eat', emoji: '🥕', label: '편식하지 말자', labelEn: "Don't be picky" },
    { id: 'brave', emoji: '💪', label: '용기를 내자', labelEn: 'Be brave' },
    { id: 'love', emoji: '❤️', label: '사랑해', labelEn: 'I love you' },
    { id: 'friend', emoji: '🤝', label: '친구와 사이좋게', labelEn: 'Be kind to friends' },
    { id: 'clean', emoji: '🧹', label: '정리정돈 잘하자', labelEn: 'Keep things tidy' },
    { id: 'share', emoji: '🎁', label: '나눠 쓰자', labelEn: 'Learn to share' },
    { id: 'custom', emoji: '✨', label: '직접 입력', labelEn: 'Custom message' },
];

// 나이 옵션
const AGES = [3, 4, 5, 6, 7, 8, 9, 10];

interface StoryVariables {
    childName: string;
    childAge: number;
    interests: string[];
    message: string;
    customMessage: string;
}

export const CreateStory: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useStore();
    const { t } = useTranslation();

    const [step, setStep] = useState(1);
    const [showBookManagement, setShowBookManagement] = useState(false);

    const [variables, setVariables] = useState<StoryVariables>({
        childName: '',
        childAge: 5,
        interests: [],
        message: '',
        customMessage: '',
    });

    // Step validation
    const isStep1Valid = variables.childName.trim().length > 0;
    const isStep2Valid = variables.interests.length > 0;
    const isStep3Valid = variables.message !== '' &&
        (variables.message !== 'custom' || variables.customMessage.trim().length > 0);

    const handleInterestToggle = (id: string) => {
        setVariables(prev => {
            const isSelected = prev.interests.includes(id);
            if (isSelected) {
                return { ...prev, interests: prev.interests.filter(i => i !== id) };
            } else if (prev.interests.length < 3) {
                return { ...prev, interests: [...prev.interests, id] };
            }
            return prev;
        });
    };

    const handleGenerate = () => {
        if (!user) return;

        // Navigate to generating page with variables
        navigate('/generating', {
            state: { variables }
        });
    };

    const nextStep = () => {
        if (step < 3) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-yellow-50 relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Tree branch decoration */}
                <div className="absolute top-0 left-0 w-64 h-64 bg-amber-200/30 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-200/30 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

                {/* Floating sparkles */}
                {[...Array(5)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute text-amber-400"
                        style={{
                            left: `${20 + i * 15}%`,
                            top: `${20 + (i % 3) * 25}%`,
                        }}
                        animate={{
                            opacity: [0.3, 1, 0.3],
                            scale: [0.8, 1.2, 0.8],
                            rotate: [0, 180, 360],
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            delay: i * 0.8,
                        }}
                    >
                        <Sparkles size={14} />
                    </motion.div>
                ))}
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-white/80 backdrop-blur-lg border-b border-amber-100 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center text-amber-700 hover:text-amber-900 font-medium transition-colors gap-2"
                    >
                        <Home className="w-5 h-5" />
                        <span className="hidden sm:inline">{t('go_home')}</span>
                    </button>

                    {/* Progress Indicator */}
                    <div className="flex items-center gap-3">
                        {[1, 2, 3].map(s => (
                            <div key={s} className="flex items-center">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${s === step
                                        ? 'bg-amber-500 text-white scale-110 shadow-lg'
                                        : s < step
                                            ? 'bg-amber-400 text-white'
                                            : 'bg-amber-100 text-amber-400'
                                        }`}
                                >
                                    {s < step ? <Check size={16} /> : s}
                                </div>
                                {s < 3 && (
                                    <div className={`w-8 h-1 ${s < step ? 'bg-amber-400' : 'bg-amber-100'} rounded-full mx-1`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Right side buttons */}
                    <div className="flex items-center gap-2">
                        {/* Book Management Button */}
                        <button
                            onClick={() => setShowBookManagement(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg transition-all border border-amber-200"
                            title="내 동화책 관리"
                        >
                            <BookOpen size={14} />
                            <span className="hidden sm:inline">{t('my_books')}</span>
                        </button>

                        {/* Write Without AI - Small Button */}
                        <button
                            onClick={() => navigate('/editor/story')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg transition-all border border-amber-200"
                        >
                            <Edit3 size={14} />
                            <span className="hidden sm:inline">{t('write_directly')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-2xl mx-auto px-4 py-6 relative z-10">
                {/* Owl Guide Section */}
                <div className="flex items-start gap-4 mb-8">
                    <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="flex-shrink-0"
                    >
                        <img
                            src={owlImage}
                            alt="부엉이 가이드"
                            className="w-24 h-24 object-contain drop-shadow-lg"
                        />
                    </motion.div>
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex-1 bg-white rounded-2xl rounded-tl-none px-5 py-4 shadow-lg border-2 border-amber-200 relative"
                    >
                        <p className="text-amber-800 font-medium text-lg">
                            {t(`owl_msg_${step}`)}
                        </p>
                        {/* Bubble tail */}
                        <div className="absolute top-4 -left-3 w-0 h-0 border-t-8 border-r-8 border-b-8 border-transparent border-r-white" style={{ filter: 'drop-shadow(-2px 0 0 #fcd34d)' }} />
                    </motion.div>
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white rounded-3xl shadow-xl p-8 border-2 border-amber-100"
                        >
                            <div className="text-center mb-8">
                                <span className="inline-block px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full text-sm font-bold mb-4 shadow-md">
                                    {t('step')} 1
                                </span>
                                <h2 className="text-2xl font-bold text-amber-800">
                                    {t('whose_story')}
                                </h2>
                            </div>

                            {/* Child Name Input */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-amber-700 mb-3">
                                    🧒 {t('child_name')}
                                </label>
                                <input
                                    type="text"
                                    value={variables.childName}
                                    onChange={(e) => setVariables(prev => ({ ...prev, childName: e.target.value }))}
                                    placeholder={t('name_placeholder')}
                                    className="w-full px-5 py-4 bg-amber-50 border-2 border-amber-200 rounded-2xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 focus:outline-none text-lg font-medium text-gray-800 placeholder-amber-300 transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Age Selection */}
                            <div>
                                <label className="block text-sm font-bold text-amber-700 mb-3">
                                    🎂 {t('age')}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {AGES.map(age => (
                                        <button
                                            key={age}
                                            onClick={() => setVariables(prev => ({ ...prev, childAge: age }))}
                                            className={`px-5 py-3 rounded-xl font-bold transition-all ${variables.childAge === age
                                                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-lg scale-105'
                                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-2 border-amber-200'
                                                }`}
                                        >
                                            {age} {t('years_old')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white rounded-3xl shadow-xl p-8 border-2 border-amber-100"
                        >
                            <div className="text-center mb-8">
                                <span className="inline-block px-4 py-1 bg-gradient-to-r from-orange-400 to-red-400 text-white rounded-full text-sm font-bold mb-4 shadow-md">
                                    {t('step')} 2
                                </span>
                                <h2 className="text-2xl font-bold text-amber-800">
                                    {t('what_likes', { name: variables.childName })}
                                </h2>
                                <p className="text-sm text-amber-600 mt-2">{t('select_up_to_3')}</p>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {INTERESTS.map(interest => {
                                    const isSelected = variables.interests.includes(interest.id);
                                    const isDisabled = !isSelected && variables.interests.length >= 3;

                                    return (
                                        <button
                                            key={interest.id}
                                            onClick={() => handleInterestToggle(interest.id)}
                                            disabled={isDisabled}
                                            className={`relative p-4 rounded-2xl transition-all ${isSelected
                                                ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-lg scale-105'
                                                : isDisabled
                                                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 hover:scale-105 border-2 border-amber-200'
                                                }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-1 right-1 bg-white text-amber-500 rounded-full p-0.5 shadow">
                                                    <Check size={12} />
                                                </div>
                                            )}
                                            <div className="text-2xl mb-1">{interest.emoji}</div>
                                            <div className="text-xs font-bold">{t(`interest_${interest.id}`)}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white rounded-3xl shadow-xl p-8 border-2 border-amber-100"
                        >
                            <div className="text-center mb-8">
                                <span className="inline-block px-4 py-1 bg-gradient-to-r from-yellow-400 to-amber-400 text-white rounded-full text-sm font-bold mb-4 shadow-md">
                                    {t('step')} 3
                                </span>
                                <h2 className="text-2xl font-bold text-amber-800">
                                    {t('what_to_say', { name: variables.childName })}
                                </h2>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {MESSAGES.map(message => {
                                    const isSelected = variables.message === message.id;

                                    return (
                                        <button
                                            key={message.id}
                                            onClick={() => setVariables(prev => ({
                                                ...prev,
                                                message: message.id,
                                                customMessage: message.id === 'custom' ? prev.customMessage : ''
                                            }))}
                                            className={`relative p-4 rounded-2xl transition-all text-left ${isSelected
                                                ? 'bg-gradient-to-br from-yellow-400 to-amber-400 text-white shadow-lg scale-105'
                                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 hover:scale-105 border-2 border-amber-200'
                                                }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 bg-white text-amber-500 rounded-full p-0.5 shadow">
                                                    <Check size={12} />
                                                </div>
                                            )}
                                            <div className="text-2xl mb-1">{message.emoji}</div>
                                            <div className="text-sm font-bold">{t(`msg_${message.id}`)}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Custom Message Input */}
                            {variables.message === 'custom' && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-4"
                                >
                                    <input
                                        type="text"
                                        value={variables.customMessage}
                                        onChange={(e) => setVariables(prev => ({ ...prev, customMessage: e.target.value }))}
                                        placeholder={t('custom_placeholder')}
                                        className="w-full px-5 py-4 bg-amber-50 border-2 border-amber-300 rounded-2xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 focus:outline-none text-lg font-medium text-gray-800 placeholder-amber-300 transition-all"
                                        autoFocus
                                    />
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="flex gap-4 mt-8">
                    {step > 1 && (
                        <button
                            onClick={prevStep}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-amber-200 text-amber-700 rounded-2xl font-bold hover:bg-amber-50 transition-all shadow-md"
                        >
                            <ArrowLeft size={20} />
                            {t('previous')}
                        </button>
                    )}

                    {step < 3 ? (
                        <button
                            onClick={nextStep}
                            disabled={
                                (step === 1 && !isStep1Valid) ||
                                (step === 2 && !isStep2Valid)
                            }
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all ${((step === 1 && isStep1Valid) || (step === 2 && isStep2Valid))
                                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-white hover:from-amber-500 hover:to-orange-500 shadow-lg'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {t('next_step')}
                            <ArrowRight size={20} />
                        </button>
                    ) : (
                        <button
                            onClick={handleGenerate}
                            disabled={!isStep3Valid}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all ${isStep3Valid
                                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-400 text-white hover:opacity-90 shadow-xl animate-pulse'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            <Sparkles size={20} />
                            {t('create_magic_story')}
                        </button>
                    )}
                </div>

                {/* Summary Preview (for Step 3) */}
                {step === 3 && isStep1Valid && isStep2Valid && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200"
                    >
                        <p className="text-sm text-amber-700 text-center">
                            📖 <span className="font-bold">{variables.childName}</span>
                            ({variables.childAge} {t('years_old')})
                            <span className="font-bold mx-1">
                                {variables.interests.map(id => INTERESTS.find(i => i.id === id)?.emoji).join(' ')}
                            </span>
                            {t('story_with')}
                        </p>
                    </motion.div>
                )}
            </div>

            {/* Book Management Modal */}
            {showBookManagement && (
                <BookManagementModal onClose={() => setShowBookManagement(false)} />
            )}
        </div>
    );
};
