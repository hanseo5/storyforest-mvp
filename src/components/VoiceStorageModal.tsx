import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Loader, Headphones, Mic, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSavedVoices, getSelectedVoice, setSelectedVoice, deleteUserVoice } from '../services/voiceService';
import { useStore } from '../store';
import type { SavedVoice } from '../types';

interface VoiceStorageModalProps {
    onClose: () => void;
    onVoiceChange?: () => void;
}

export const VoiceStorageModal: React.FC<VoiceStorageModalProps> = ({ onClose, onVoiceChange }) => {
    const user = useStore((state) => state.user);
    const [voices, setVoices] = useState<SavedVoice[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [confirmDeleteName, setConfirmDeleteName] = useState<string>('');

    useEffect(() => {
        const loadVoices = async () => {
            if (!user) {
                setLoading(false);
                return;
            }
            try {
                const [savedVoices, selected] = await Promise.all([
                    getSavedVoices(user.uid),
                    getSelectedVoice(user.uid)
                ]);
                setVoices(savedVoices);
                setSelectedId(selected);
            } catch (error) {
                console.error('[VoiceStorage] Error loading voices:', error);
            } finally {
                setLoading(false);
            }
        };
        loadVoices();
    }, [user]);

    const handleSelect = async (voiceId: string | null) => {
        if (!user) return;
        setSelectedId(voiceId);
        await setSelectedVoice(user.uid, voiceId);
        onVoiceChange?.();
    };

    const handleDeleteClick = (e: React.MouseEvent, voiceId: string, voiceName: string) => {
        e.stopPropagation();
        setConfirmDeleteId(voiceId);
        setConfirmDeleteName(voiceName);
    };

    const handleConfirmDelete = async () => {
        if (!confirmDeleteId) return;

        const voiceIdToDelete = confirmDeleteId;
        setConfirmDeleteId(null);
        setConfirmDeleteName('');
        setDeleting(voiceIdToDelete);

        try {
            await deleteUserVoice(voiceIdToDelete);
            setVoices(voices.filter(v => v.id !== voiceIdToDelete));
            if (selectedId === voiceIdToDelete) {
                setSelectedId(null);
                if (user) await setSelectedVoice(user.uid, null);
            }
            console.log('[VoiceStorage] Voice deleted successfully:', voiceIdToDelete);
        } catch (e) {
            console.error('[VoiceStorage] Delete failed:', e);
        } finally {
            setDeleting(null);
        }
    };

    const handleCancelDelete = () => {
        setConfirmDeleteId(null);
        setConfirmDeleteName('');
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 flex justify-between items-center text-white">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Headphones className="w-6 h-6" />
                        Voice Library
                    </h2>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader className="animate-spin text-indigo-600" size={32} />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Default Voice */}
                            <button
                                onClick={() => handleSelect(null)}
                                className={`w-full flex items-center p-4 rounded-xl border-2 transition-all ${selectedId === null
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`p-2 rounded-full mr-3 ${selectedId === null ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                                    <Headphones size={20} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-bold text-gray-800">Default Voice</p>
                                    <p className="text-xs text-gray-500">Brian (Deep & Comforting)</p>
                                </div>
                                {selectedId === null && (
                                    <Check className="text-indigo-600" size={24} />
                                )}
                            </button>

                            {/* Saved Voices */}
                            {voices.map((voice) => (
                                <div
                                    key={voice.id}
                                    className={`flex items-center p-4 rounded-xl border-2 transition-all ${selectedId === voice.id
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-100 hover:border-gray-200'
                                        }`}
                                >
                                    <button
                                        onClick={() => handleSelect(voice.id)}
                                        className="flex-1 flex items-center"
                                    >
                                        <div className={`p-2 rounded-full mr-3 ${selectedId === voice.id ? 'bg-purple-200 text-purple-700' : 'bg-orange-100 text-orange-600'}`}>
                                            <Mic size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-gray-800">{voice.name}</p>
                                            <p className="text-xs text-gray-500">
                                                Created {new Date(voice.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </button>
                                    {selectedId === voice.id && (
                                        <Check className="text-purple-600 mr-2" size={24} />
                                    )}
                                    <button
                                        onClick={(e) => handleDeleteClick(e, voice.id, voice.name)}
                                        disabled={deleting === voice.id}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50"
                                    >
                                        {deleting === voice.id ? <Loader size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                    </button>
                                </div>
                            ))}

                            {voices.length === 0 && (
                                <div className="text-center py-6 text-gray-400">
                                    <Mic size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No cloned voices yet.</p>
                                    <p className="text-xs">Use the Mic button to record one!</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-400 text-center">
                        Selected voice will be used for all audiobooks.
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
                                <h3 className="text-xl font-bold">삭제 확인</h3>
                            </div>

                            {/* Content */}
                            <div className="p-6 text-center">
                                <p className="text-gray-700 mb-2">
                                    <strong className="text-gray-900">"{confirmDeleteName}"</strong>
                                </p>
                                <p className="text-gray-600">
                                    이 목소리를 삭제하시겠습니까?
                                </p>
                                <p className="text-sm text-red-500 mt-2">
                                    이 작업은 되돌릴 수 없습니다.
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 p-4 bg-gray-50">
                                <button
                                    onClick={handleCancelDelete}
                                    className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold hover:from-red-600 hover:to-orange-600 transition-all shadow-lg"
                                >
                                    삭제
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
