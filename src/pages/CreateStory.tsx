import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, Check, Edit3, Home, BookOpen, Camera, X, Image as ImageIcon, Palette, User as UserIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import { BookManagementModal } from '../components/BookManagementModal';
import { AccountManagementModal } from '../components/AccountManagementModal';
import { trackStoryCreated, trackPhotoUploaded } from '../services/analyticsService';
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

// 그림체 프리셋
const ART_STYLES = [
    { id: 'watercolor', emoji: '🎨', color: 'from-blue-300 to-purple-300' },
    { id: 'cartoon', emoji: '✏️', color: 'from-yellow-300 to-orange-300' },
    { id: 'crayon', emoji: '🖍️', color: 'from-red-300 to-pink-300' },
    { id: 'digital', emoji: '💻', color: 'from-cyan-300 to-blue-300' },
    { id: 'pencil', emoji: '✎', color: 'from-gray-300 to-amber-300' },
    { id: 'papercut', emoji: '✂️', color: 'from-green-300 to-emerald-300' },
];

// 나이 옵션
const AGES = [3, 4, 5, 6, 7, 8, 9, 10];

interface StoryVariables {
    childName: string;
    childAge: number;
    interests: string[];
    artStyle: string;
    message: string;
    customMessage: string;
    photoFile?: File;
    photoPreview?: string;
    photoDescription: string;
}

export const CreateStory: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useStore();
    const { t } = useTranslation();

    const [step, setStep] = useState(1);
    const [showBookManagement, setShowBookManagement] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);

    const [variables, setVariables] = useState<StoryVariables>({
        childName: '',
        childAge: 5,
        interests: [],
        artStyle: 'watercolor',
        message: '',
        customMessage: '',
        photoFile: undefined,
        photoPreview: undefined,
        photoDescription: '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert(t('photo_too_large'));
            return;
        }

        const previewUrl = URL.createObjectURL(file);
        setVariables(prev => ({
            ...prev,
            photoFile: file,
            photoPreview: previewUrl,
        }));
        trackPhotoUploaded();
    };

    const handlePhotoRemove = () => {
        if (variables.photoPreview) {
            URL.revokeObjectURL(variables.photoPreview);
        }
        setVariables(prev => ({
            ...prev,
            photoFile: undefined,
            photoPreview: undefined,
            photoDescription: '',
        }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Step validation
    const isStep1Valid = variables.childName.trim().length > 0;
    const isStep2Valid = variables.interests.length > 0;
    const isStep3Valid = variables.artStyle !== '';
    const isStep4Valid = variables.message !== '' &&
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

    const handleGenerate = async () => {
        if (!user) return;

        // Track story creation event
        trackStoryCreated({
            childAge: variables.childAge,
            artStyle: variables.artStyle,
            interests: variables.interests.join(','),
            hasPhoto: !!variables.photoFile,
        });

        // If photo is attached, convert to base64 for transport
        let photoBase64: string | undefined;
        let photoMimeType: string | undefined;

        if (variables.photoFile) {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1]);
                };
                reader.readAsDataURL(variables.photoFile!);
            });
            photoBase64 = base64;
            photoMimeType = variables.photoFile.type || 'image/jpeg';
        }

        // Navigate to generating page with variables
        navigate('/generating', {
            state: {
                variables: {
                    ...variables,
                    // Don't pass File object through navigation state
                    photoFile: undefined,
                    photoPreview: undefined,
                },
                photoBase64,
                photoMimeType,
                photoDescription: variables.photoDescription,
                isPhotoBased: !!variables.photoFile,
            }
        });
    };

    const nextStep = () => {
        if (step < 4) setStep(step + 1);
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
                        {[1, 2, 3, 4].map(s => (
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
                                {s < 4 && (
                                    <div className={`w-6 h-1 ${s < step ? 'bg-amber-400' : 'bg-amber-100'} rounded-full mx-0.5`} />
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

                        {/* Profile / Account Button */}
                        <button
                            onClick={() => setShowAccountModal(true)}
                            className="p-2 text-amber-600 hover:bg-amber-100 rounded-full transition-colors border border-amber-200"
                            title={t('account_management')}
                        >
                            <UserIcon size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-6 py-6 relative z-10">
                {/* Owl Guide Section */}
                <div className="flex items-start gap-4 mb-6">
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
                            className="bg-white rounded-3xl shadow-xl p-6 border-2 border-amber-100"
                        >
                            <div className="text-center mb-4">
                                    <span className="inline-block px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full text-sm font-bold mb-2 shadow-md">
                                    {t('step')} 1
                                </span>
                                <h2 className="text-xl font-bold text-amber-800">
                                    {t('whose_story')}
                                </h2>
                            </div>

                            {/* Landscape side-by-side layout */}
                            <div className="flex flex-row gap-6 items-start">
                                {/* Left: Form fields */}
                                <div className="flex-[1.2] min-w-0">
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
                                </div>

                                {/* Right: Photo Upload Section */}
                                <div className="flex-1 min-w-0">
                                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border-2 border-amber-200 border-dashed h-full">
                                        <label className="block text-sm font-bold text-amber-700 mb-2">
                                            📸 {t('photo_section_title')}
                                        </label>
                                        <p className="text-xs text-amber-600 mb-4">
                                            {t('photo_upload_hint')}
                                        </p>

                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoSelect}
                                            className="hidden"
                                        />

                                        {!variables.photoPreview ? (
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full flex flex-col items-center justify-center gap-3 py-8 border-2 border-amber-300 border-dashed rounded-2xl bg-white/60 hover:bg-white hover:border-amber-400 transition-all cursor-pointer group"
                                            >
                                                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                                                    <Camera className="w-7 h-7 text-amber-500" />
                                                </div>
                                                <span className="text-sm font-medium text-amber-600">
                                                    {t('photo_tap_to_add')}
                                                </span>
                                                <span className="text-xs text-amber-400">
                                                    {t('photo_formats')}
                                                </span>
                                            </button>
                                        ) : (
                                            <div className="relative">
                                                <img
                                                    src={variables.photoPreview}
                                                    alt="Uploaded photo"
                                                    className="w-full h-44 object-cover rounded-2xl shadow-md"
                                                />
                                                <button
                                                    onClick={handlePhotoRemove}
                                                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                                                    <ImageIcon size={12} />
                                                    {t('photo_attached')}
                                                </div>
                                            </div>
                                        )}

                                        {/* Photo Description */}
                                        {variables.photoPreview && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="mt-4"
                                            >
                                                <label className="block text-sm font-bold text-amber-700 mb-2">
                                                    ✏️ {t('photo_desc_label')}
                                                </label>
                                                <textarea
                                                    value={variables.photoDescription}
                                                    onChange={(e) => setVariables(prev => ({ ...prev, photoDescription: e.target.value }))}
                                                    placeholder={t('photo_desc_placeholder')}
                                                    rows={3}
                                                    className="w-full px-4 py-3 bg-white border-2 border-amber-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 focus:outline-none text-sm text-gray-800 placeholder-amber-300 transition-all resize-none"
                                                />
                                            </motion.div>
                                        )}
                                    </div>
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
                            className="bg-white rounded-3xl shadow-xl p-6 border-2 border-amber-100"
                        >
                            <div className="text-center mb-6">
                                <span className="inline-block px-4 py-1 bg-gradient-to-r from-orange-400 to-red-400 text-white rounded-full text-sm font-bold mb-2 shadow-md">
                                    {t('step')} 2
                                </span>
                                <h2 className="text-xl font-bold text-amber-800">
                                    {t('what_likes', { name: variables.childName })}
                                </h2>
                                <p className="text-sm text-amber-600 mt-2">{t('select_up_to_3')}</p>
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
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
                            className="bg-white rounded-3xl shadow-xl p-6 border-2 border-amber-100"
                        >
                            <div className="text-center mb-6">
                                <span className="inline-block px-4 py-1 bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-full text-sm font-bold mb-2 shadow-md">
                                    {t('step')} 3
                                </span>
                                <h2 className="text-xl font-bold text-amber-800">
                                    <Palette className="inline w-6 h-6 mr-2" />
                                    {t('choose_art_style')}
                                </h2>
                                <p className="text-sm text-amber-600 mt-2">{t('art_style_hint')}</p>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                {ART_STYLES.map(style => {
                                    const isSelected = variables.artStyle === style.id;
                                    return (
                                        <button
                                            key={style.id}
                                            onClick={() => setVariables(prev => ({ ...prev, artStyle: style.id }))}
                                            className={`relative p-5 rounded-2xl transition-all ${isSelected
                                                ? `bg-gradient-to-br ${style.color} text-white shadow-lg scale-105 ring-2 ring-amber-400`
                                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 hover:scale-105 border-2 border-amber-200'
                                            }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 bg-white text-amber-500 rounded-full p-0.5 shadow">
                                                    <Check size={12} />
                                                </div>
                                            )}
                                            <div className="text-3xl mb-2">{style.emoji}</div>
                                            <div className="text-sm font-bold">{t(`style_${style.id}`)}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white rounded-3xl shadow-xl p-6 border-2 border-amber-100"
                        >
                            <div className="text-center mb-6">
                                <span className="inline-block px-4 py-1 bg-gradient-to-r from-yellow-400 to-amber-400 text-white rounded-full text-sm font-bold mb-2 shadow-md">
                                    {t('step')} 4
                                </span>
                                <h2 className="text-xl font-bold text-amber-800">
                                    {t('what_to_say', { name: variables.childName })}
                                </h2>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

                    {step < 4 ? (
                        <button
                            onClick={nextStep}
                            disabled={
                                (step === 1 && !isStep1Valid) ||
                                (step === 2 && !isStep2Valid) ||
                                (step === 3 && !isStep3Valid)
                            }
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all ${(
                                (step === 1 && isStep1Valid) ||
                                (step === 2 && isStep2Valid) ||
                                (step === 3 && isStep3Valid)
                            )
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
                            disabled={!isStep4Valid}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all ${isStep4Valid
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
                {step === 4 && isStep1Valid && isStep2Valid && isStep3Valid && (
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
                            🎨 {t(`style_${variables.artStyle}`)}
                            {' '}{t('story_with')}
                        </p>
                    </motion.div>
                )}
            </div>

            {/* Book Management Modal */}
            {showBookManagement && (
                <BookManagementModal onClose={() => setShowBookManagement(false)} />
            )}

            {/* Account Management Modal */}
            {showAccountModal && (
                <AccountManagementModal onClose={() => setShowAccountModal(false)} />
            )}
        </div>
    );
};
