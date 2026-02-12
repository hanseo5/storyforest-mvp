import React, { useState } from 'react';
import { X, User, Mail, Shield, LogOut, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut, deleteUser, reauthenticateWithPopup, GoogleAuthProvider, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import { trackAccountDeleted } from '../services/analyticsService';

interface AccountManagementModalProps {
    onClose: () => void;
}

export const AccountManagementModal: React.FC<AccountManagementModalProps> = ({ onClose }) => {
    const { user, setUser } = useStore();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [passwordForDelete, setPasswordForDelete] = useState('');

    const isEmailProvider = auth.currentUser?.providerData.some(p => p.providerId === 'password');
    const isGoogleProvider = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setUser(null);
            navigate('/');
        } catch (err) {
            console.error('[Account] Sign out error:', err);
        }
    };

    const handleDeleteAccount = async () => {
        if (!auth.currentUser) return;
        setIsDeleting(true);
        setDeleteError(null);

        try {
            // Re-authenticate before deletion
            if (isGoogleProvider) {
                const provider = new GoogleAuthProvider();
                await reauthenticateWithPopup(auth.currentUser, provider);
            } else if (isEmailProvider && passwordForDelete) {
                const credential = EmailAuthProvider.credential(
                    auth.currentUser.email!,
                    passwordForDelete
                );
                await reauthenticateWithCredential(auth.currentUser, credential);
            }

            // Delete the Firebase Auth user
            trackAccountDeleted();
            await deleteUser(auth.currentUser);
            setUser(null);
            navigate('/');
        } catch (err: unknown) {
            console.error('[Account] Delete account error:', err);
            const errorCode = (err as { code?: string })?.code;
            if (errorCode === 'auth/requires-recent-login') {
                setDeleteError(t('reauthenticate_needed'));
            } else if (errorCode === 'auth/wrong-password') {
                setDeleteError('비밀번호가 올바르지 않습니다.');
            } else {
                setDeleteError((err as Error).message || 'Failed to delete account');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const providerLabel = isGoogleProvider ? 'Google' : isEmailProvider ? 'Email' : 'Unknown';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-emerald-100 overflow-hidden"
            >
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 rounded-xl">
                            <User size={20} className="text-emerald-600" />
                        </div>
                        <h2 className="font-bold text-lg text-emerald-900">{t('account_management')}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-emerald-100 rounded-xl transition-colors text-emerald-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Profile Section */}
                <div className="px-6 py-5 space-y-4">
                    {/* User Avatar & Name */}
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                        {user?.photoURL ? (
                            <img
                                src={user.photoURL}
                                alt="Profile"
                                className="w-14 h-14 rounded-full border-2 border-emerald-200 object-cover"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-emerald-200">
                                <User size={24} className="text-emerald-600" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800 truncate text-lg">
                                {user?.displayName || t('untitled_draft')}
                            </p>
                            <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-0.5">
                                <Shield size={12} />
                                {providerLabel}
                            </p>
                        </div>
                    </div>

                    {/* Info Fields */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl">
                            <Mail size={16} className="text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{t('account_email')}</p>
                                <p className="text-sm text-gray-700 truncate">{user?.email || '-'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 space-y-2.5">
                        {/* Sign Out */}
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-gray-700 font-medium"
                        >
                            <LogOut size={18} className="text-gray-400" />
                            {t('sign_out')}
                        </button>

                        {/* Delete Account */}
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 hover:bg-red-100 rounded-xl transition-colors text-red-600 font-medium"
                        >
                            <Trash2 size={18} />
                            {t('delete_account')}
                        </button>
                    </div>
                </div>

                {/* Delete Confirmation */}
                <AnimatePresence>
                    {showDeleteConfirm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="px-6 py-5 bg-red-50 border-t border-red-100">
                                <div className="flex items-start gap-3 mb-4">
                                    <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-red-700 text-sm mb-1">{t('delete_account')}</p>
                                        <p className="text-xs text-red-500 leading-relaxed">{t('delete_account_warning')}</p>
                                    </div>
                                </div>

                                {/* Password input for email users */}
                                {isEmailProvider && (
                                    <div className="mb-4">
                                        <input
                                            type="password"
                                            value={passwordForDelete}
                                            onChange={(e) => setPasswordForDelete(e.target.value)}
                                            placeholder="비밀번호 입력"
                                            className="w-full px-4 py-2.5 border-2 border-red-200 rounded-xl text-sm focus:outline-none focus:border-red-400 bg-white"
                                        />
                                    </div>
                                )}

                                {deleteError && (
                                    <p className="text-xs text-red-600 mb-3 bg-red-100 px-3 py-2 rounded-lg">{deleteError}</p>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setDeleteError(null);
                                            setPasswordForDelete('');
                                        }}
                                        className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                        disabled={isDeleting}
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={isDeleting || (isEmailProvider && !passwordForDelete)}
                                        className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isDeleting ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                {t('deleting_account')}
                                            </>
                                        ) : (
                                            t('delete_account')
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
