/* eslint-disable react-hooks/rules-of-hooks -- Math.random for animation initial positions is acceptable */
import React, { useState } from 'react';
import {
    signInWithPopup,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Star, Mail, ArrowRight, ArrowLeft, Loader2, MailCheck, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../hooks/useTranslation';
import { toast } from '../components/Toast';
import owlImage from '../assets/mascots/owl.png';
import squirrelImage from '../assets/mascots/squirrel.png';

type LoginMode = 'select' | 'login-email' | 'signup-email' | 'signup-verify';

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" width="22" height="22">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [mode, setMode] = useState<LoginMode>('select');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Email state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    const clearError = () => setError('');

    // ── Google Login ──
    const handleGoogleLogin = async () => {
        setLoading(true);
        clearError();
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            // onAuthStateChanged in App.tsx will set user and navigate
            const { trackLogin } = await import('../services/analyticsService');
            trackLogin({ method: 'google' });
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes('popup-closed-by-user')) {
                // User closed popup – ignore
            } else {
                setError(t('login_error_google'));
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Email Sign-up (create + send verification + sign out) ──
    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setLoading(true);
        clearError();

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(cred.user);
            await signOut(auth); // sign out after sending verification email
            const { trackSignup } = await import('../services/analyticsService');
            trackSignup({ method: 'email' });
            toast.success(t('login_verify_sent'));
            setMode('signup-verify');
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes('email-already-in-use')) {
                    setError(t('login_error_email_exists'));
                } else if (err.message.includes('weak-password')) {
                    setError(t('login_error_weak_password'));
                } else if (err.message.includes('invalid-email')) {
                    setError(t('login_error_invalid_email'));
                } else {
                    setError(err.message);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Email Login (with emailVerified check) ──
    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setLoading(true);
        clearError();

        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);

            // Block unverified email users
            if (!cred.user.emailVerified) {
                await sendEmailVerification(cred.user);
                await signOut(auth);
                toast.info(t('login_verify_resent'));
                setMode('signup-verify');
                return;
            }

            // Verified — onAuthStateChanged will handle navigation
            const { trackLogin } = await import('../services/analyticsService');
            trackLogin({ method: 'email' });
        } catch (err: unknown) {
            if (err instanceof Error) {
                if (err.message.includes('user-not-found') || err.message.includes('invalid-credential')) {
                    setError(t('login_error_invalid'));
                } else if (err.message.includes('invalid-email')) {
                    setError(t('login_error_invalid_email'));
                } else {
                    setError(err.message);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Resend verification email ──
    const handleResendVerification = async () => {
        if (!email || !password) return;
        setLoading(true);
        clearError();

        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            if (cred.user.emailVerified) {
                // Already verified — just navigate
                navigate('/');
                return;
            }
            await sendEmailVerification(cred.user);
            await signOut(auth);
            toast.success(t('login_verify_resent'));
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Check verification and login ──
    const handleCheckVerification = async () => {
        if (!email || !password) return;
        setLoading(true);
        clearError();

        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            if (cred.user.emailVerified) {
                toast.success(t('login_signup_success'));
                navigate('/');
            } else {
                await signOut(auth);
                setError(t('login_verify_not_yet'));
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const goBack = () => {
        setMode('select');
        setLoading(false);
        clearError();
    };

    // ── Render: 2-method buttons (Google + Email) ──
    const renderMethodButtons = (forSignUp: boolean) => {
        const prefix = forSignUp ? 'signup' : 'login';

        return (
            <div className="space-y-2.5">
                {/* Google */}
                <motion.button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3 px-4 rounded-2xl font-bold hover:border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-3 transition-all shadow-sm text-sm disabled:opacity-50"
                >
                    <GoogleIcon />
                    <span>{t(`${prefix}_google`)}</span>
                </motion.button>

                {/* Email */}
                <motion.button
                    onClick={() => { setLoading(false); setMode(`${prefix}-email` as LoginMode); setIsSignUp(forSignUp); clearError(); }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg text-sm ${
                        forSignUp
                            ? 'bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500'
                            : 'bg-emerald-500 hover:bg-emerald-600'
                    }`}
                >
                    <Mail size={18} />
                    <span>{t(`${prefix}_email`)}</span>
                </motion.button>
            </div>
        );
    };

    // ── Render: Email form (login or signup) ──
    const renderEmailForm = () => (
        <motion.div
            key="email"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
        >
            <button onClick={goBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3 transition-colors">
                <ArrowLeft size={14} /> {t('login_back')}
            </button>

            <h3 className="text-base font-bold text-gray-800 mb-3 text-center">
                {isSignUp ? `🎉 ${t('login_create_account')}` : `👋 ${t('login_sign_in')}`}
            </h3>

            <form onSubmit={isSignUp ? handleSignUp : handleEmailLogin} className="space-y-3">
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('login_email_label')}</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="hello@example.com"
                        required
                        autoFocus
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('login_password_label')}</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-sm"
                    />
                    {isSignUp && (
                        <p className="text-[10px] text-gray-400 mt-1">{t('login_password_hint')}</p>
                    )}
                </div>

                <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full text-white py-3 rounded-2xl font-bold transition-all shadow-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${
                        isSignUp
                            ? 'bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500'
                            : 'bg-emerald-500 hover:bg-emerald-600'
                    }`}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                    {isSignUp ? t('login_create_account') : t('login_sign_in')}
                </motion.button>
            </form>
        </motion.div>
    );

    // ── Render: Email verification waiting screen ──
    const renderVerifyScreen = () => (
        <motion.div
            key="verify"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="text-center"
        >
            <button onClick={goBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4 transition-colors">
                <ArrowLeft size={14} /> {t('login_back')}
            </button>

            <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                    <MailCheck size={32} className="text-amber-600" />
                </div>
            </div>

            <h3 className="text-base font-bold text-gray-800 mb-2">📧 {t('login_verify_title')}</h3>
            <p className="text-xs text-gray-500 mb-1">{t('login_verify_desc')}</p>
            <p className="text-xs font-semibold text-amber-600 mb-5">{email}</p>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl mb-3 text-xs">
                    {error}
                </div>
            )}

            <div className="space-y-2.5">
                <motion.button
                    onClick={handleCheckVerification}
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-400 text-white py-3 rounded-2xl font-bold hover:from-amber-500 hover:to-orange-500 transition-all shadow-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <MailCheck size={18} />}
                    {t('login_verify_check')}
                </motion.button>

                <motion.button
                    onClick={handleResendVerification}
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-white border-2 border-gray-200 text-gray-600 py-2.5 rounded-2xl font-bold hover:bg-gray-50 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw size={14} />
                    {t('login_verify_resend')}
                </motion.button>
            </div>

            <p className="text-[10px] text-gray-400 mt-4">{t('login_verify_spam_hint')}</p>
        </motion.div>
    );

    // Determine which sub-view to show in each panel
    const leftContent = () => {
        if (mode === 'login-email') return renderEmailForm();
        return renderMethodButtons(false);
    };

    const rightContent = () => {
        if (mode === 'signup-verify') return renderVerifyScreen();
        if (mode === 'signup-email') return renderEmailForm();
        return renderMethodButtons(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-100 via-green-100 to-emerald-200 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Forest Background Decorations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-emerald-700/40 to-transparent" />

                {/* Floating leaves */}
                {[...Array(12)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-6 h-6"
                        style={{ left: `${5 + i * 8}%`, top: '-30px' }}
                        animate={{ y: ['0vh', '110vh'], rotate: [0, 360], opacity: [0, 0.8, 0.8, 0] }}
                        transition={{ duration: 14 + i * 1.5, repeat: Infinity, delay: i * 1.2, ease: 'linear' }}
                    >
                        <div className="w-full h-full bg-green-500/40" style={{ borderRadius: '0 50% 50% 50%', transform: 'rotate(45deg)' }} />
                    </motion.div>
                ))}

                {/* Sparkles */}
                {[...Array(15)].map((_, i) => (
                    <motion.div
                        key={`sparkle-${i}`}
                        className="absolute text-amber-400"
                        style={{ left: `${5 + Math.random() * 90}%`, top: `${5 + Math.random() * 90}%` }}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
                        transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
                    >
                        <Sparkles size={14 + Math.random() * 8} />
                    </motion.div>
                ))}

                {/* Magic stars */}
                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={`star-${i}`}
                        className="absolute"
                        style={{
                            left: `${10 + Math.random() * 80}%`,
                            top: `${15 + Math.random() * 70}%`,
                            color: ['#facc15', '#f472b6', '#60a5fa', '#34d399'][i % 4],
                        }}
                        animate={{ y: [0, -30, 0], opacity: [0.3, 1, 0.3], rotate: [0, 180] }}
                        transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
                    >
                        <Star size={12} fill="currentColor" />
                    </motion.div>
                ))}
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full max-w-5xl flex flex-col items-center justify-center gap-6">

                {/* Mascots row (desktop) */}
                <div className="hidden md:flex items-end justify-center gap-8 mb-2">
                    <motion.div className="relative">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.8, type: 'spring' }}
                            className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white rounded-2xl px-4 py-2 shadow-xl border-2 border-amber-300 whitespace-nowrap z-20"
                        >
                            <p className="text-amber-800 font-bold text-xs">✏️ {t('login_owl_bubble')}</p>
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-amber-300 transform rotate-45" />
                        </motion.div>
                        <motion.img
                            src={owlImage}
                            alt="Owl"
                            className="w-32 lg:w-40 h-auto object-contain drop-shadow-2xl"
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </motion.div>

                    {/* Logo */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-center"
                    >
                        <div className="flex justify-center mb-2">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-4xl">🌲</span>
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-green-700">
                            STORYFOREST
                        </h1>
                        <p className="text-emerald-600 font-medium text-sm">{t('app_tagline')}</p>
                    </motion.div>

                    <motion.div className="relative">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.9, type: 'spring' }}
                            className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white rounded-2xl px-4 py-2 shadow-xl border-2 border-emerald-300 whitespace-nowrap z-20"
                        >
                            <p className="text-emerald-800 font-bold text-xs">📖 {t('login_squirrel_bubble')}</p>
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-emerald-300 transform rotate-45" />
                        </motion.div>
                        <motion.img
                            src={squirrelImage}
                            alt="Squirrel"
                            className="w-32 lg:w-40 h-auto object-contain drop-shadow-2xl"
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                        />
                    </motion.div>
                </div>

                {/* Mobile: mascots + logo */}
                <div className="md:hidden text-center mb-2">
                    <div className="flex justify-center gap-6 mb-4">
                        <motion.img src={owlImage} alt="Owl" className="w-20 h-20 object-contain drop-shadow-xl"
                            animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity }} />
                        <div className="flex flex-col items-center justify-center">
                            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg mb-1">
                                <span className="text-3xl">🌲</span>
                            </div>
                        </div>
                        <motion.img src={squirrelImage} alt="Squirrel" className="w-20 h-20 object-contain drop-shadow-xl"
                            animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }} />
                    </div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-green-700">
                        STORYFOREST
                    </h1>
                </div>

                {/* Two-column card: Login (left) | Sign Up (right) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="w-full max-w-3xl bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border-4 border-emerald-300/60 overflow-hidden"
                >
                    {/* Error banner */}
                    {error && (
                        <div className="bg-red-50 border-b border-red-200 text-red-600 px-4 py-2 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row">
                        {/* Left: Login */}
                        <div className="flex-1 p-6 md:p-8">
                            <div className="text-center mb-4">
                                <div className="inline-flex items-center gap-2 bg-emerald-50 rounded-full px-4 py-1.5">
                                    <span className="text-lg">👋</span>
                                    <h2 className="text-base font-bold text-emerald-700">{t('login_section_signin')}</h2>
                                </div>
                                <p className="text-xs text-gray-400 mt-1.5">{t('login_signin_desc')}</p>
                            </div>

                            <AnimatePresence mode="wait">
                                {(mode === 'select' || mode.startsWith('login')) ? leftContent() : renderMethodButtons(false)}
                            </AnimatePresence>
                        </div>

                        {/* Divider */}
                        <div className="hidden md:flex flex-col items-center py-8">
                            <div className="w-px flex-1 bg-gray-200" />
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider py-3">{t('login_or')}</span>
                            <div className="w-px flex-1 bg-gray-200" />
                        </div>
                        <div className="md:hidden flex items-center gap-3 px-6">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{t('login_or')}</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* Right: Sign Up */}
                        <div className="flex-1 p-6 md:p-8">
                            <div className="text-center mb-4">
                                <div className="inline-flex items-center gap-2 bg-amber-50 rounded-full px-4 py-1.5">
                                    <span className="text-lg">🎉</span>
                                    <h2 className="text-base font-bold text-amber-700">{t('login_section_signup')}</h2>
                                </div>
                                <p className="text-xs text-gray-400 mt-1.5">{t('login_signup_desc')}</p>
                            </div>

                            <AnimatePresence mode="wait">
                                {(mode === 'select' || mode.startsWith('signup')) ? rightContent() : renderMethodButtons(true)}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 px-6 py-3 text-center">
                        <p className="text-gray-400 text-xs">
                            {t('login_footer_hint')} ✨
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Footer */}
            <motion.footer
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="absolute bottom-4 left-0 right-0 z-10 text-center text-emerald-600/60 text-sm"
            >
                <p>🌲 STORYFOREST 🌲</p>
            </motion.footer>
        </div>
    );
};
