import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { generateAllBooksAudio, generateBookAudio } from '../services/bookService';
import { deleteVoice } from '../services/elevenLabsService';
import { getSavedVoiceById, reCloneVoiceFromSample } from '../services/voiceService';
import { useTranslation } from '../hooks/useTranslation';
import { Loader2, CheckCircle2, Mic, Music, Trash2, Download, X } from 'lucide-react';

export const BackgroundAudioGenerator: React.FC = () => {
    const {
        isGenerating,
        generationProgress,
        pendingTasks,
        popBackgroundTask,
        setGenerating,
        setGenerationProgress
    } = useStore();

    const { t } = useTranslation();
    const isProcessingRef = useRef(false);
    const [showDone, setShowDone] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const processQueue = async () => {
            if (isProcessingRef.current || pendingTasks.length === 0) return;

            isProcessingRef.current = true;
            const task = popBackgroundTask();

            if (!task) {
                isProcessingRef.current = false;
                return;
            }

            try {
                setGenerating(true);
                setShowDone(false);
                setDismissed(false);

                if (task.type === 'all') {
                    await generateAllBooksAudio(task.voiceId, (progress) => {
                        setGenerationProgress({
                            bookTitle: progress.bookTitle,
                            currentPage: progress.currentPage,
                            totalPages: progress.totalPages,
                            phase: 'generating',
                            totalBooks: progress.totalBooks,
                            currentBook: progress.currentBook,
                        });
                    });
                } else if (task.type === 'single' && task.bookId) {
                    setGenerationProgress({
                        bookTitle: '',
                        currentPage: 0,
                        totalPages: 0,
                        phase: 'generating',
                    });
                    await generateBookAudio(task.bookId, task.voiceId);
                } else if (task.type === 'single-reclone' && task.bookId && task.savedVoiceId) {
                    // Phase: Cloning
                    setGenerationProgress({
                        bookTitle: '',
                        currentPage: 0,
                        totalPages: 0,
                        phase: 'cloning',
                    });
                    const savedVoice = await getSavedVoiceById(task.savedVoiceId);
                    if (savedVoice?.sampleStoragePath) {
                        const tempVoiceId = await reCloneVoiceFromSample(savedVoice);
                        try {
                            setGenerationProgress({
                                bookTitle: '',
                                currentPage: 0,
                                totalPages: 0,
                                phase: 'generating',
                            });
                            // Use tempVoiceId for generation, savedVoiceId for storage
                            await generateBookAudio(task.bookId, tempVoiceId, task.savedVoiceId);
                        } finally {
                            // Phase: Deleting
                            setGenerationProgress({
                                bookTitle: '',
                                currentPage: 0,
                                totalPages: 0,
                                phase: 'deleting',
                            });
                            await deleteVoice(tempVoiceId).catch(() => { });
                        }
                    }
                } else if (task.type === 'all-reclone' && task.savedVoiceId) {
                    // Phase: Cloning
                    setGenerationProgress({
                        bookTitle: '',
                        currentPage: 0,
                        totalPages: 0,
                        phase: 'cloning',
                    });
                    const savedVoice = await getSavedVoiceById(task.savedVoiceId);
                    if (savedVoice?.sampleStoragePath) {
                        const tempVoiceId = await reCloneVoiceFromSample(savedVoice);
                        try {
                            setGenerationProgress({
                                bookTitle: '',
                                currentPage: 0,
                                totalPages: 0,
                                phase: 'generating',
                            });
                            // Use tempVoiceId for generation, savedVoiceId for storage
                            await generateAllBooksAudio(
                                tempVoiceId,
                                (progress) => {
                                    setGenerationProgress({
                                        bookTitle: progress.bookTitle,
                                        currentPage: progress.currentPage,
                                        totalPages: progress.totalPages,
                                        phase: 'generating',
                                        totalBooks: progress.totalBooks,
                                        currentBook: progress.currentBook,
                                    });
                                },
                                task.savedVoiceId // Pass stored ID for saving
                            );
                        } finally {
                            // Phase: Deleting
                            setGenerationProgress({
                                bookTitle: '',
                                currentPage: 0,
                                totalPages: 0,
                                phase: 'deleting',
                            });
                            await deleteVoice(tempVoiceId).catch(() => { });
                        }
                    }
                }

                // Cleanup voice slot after generation (for 'all' and 'single' types)
                if (task.type !== 'single-reclone') {
                    setGenerationProgress({
                        bookTitle: '',
                        currentPage: 0,
                        totalPages: 0,
                        phase: 'deleting',
                    });
                    await deleteVoice(task.voiceId);
                }

                // Show done state
                setGenerationProgress({
                    bookTitle: '',
                    currentPage: 0,
                    totalPages: 0,
                    phase: 'done',
                });
                setShowDone(true);

                // Auto-dismiss after 5 seconds
                if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
                doneTimerRef.current = setTimeout(() => {
                    setShowDone(false);
                }, 5000);

            } catch (error) {
                console.error('[Background] Error processing task:', error);
            } finally {
                setGenerating(false);
                setGenerationProgress(null);
                isProcessingRef.current = false;

                // Process next task if any
                if (pendingTasks.length > 0) {
                    processQueue();
                }
            }
        };

        if (!isGenerating && pendingTasks.length > 0) {
            processQueue();
        }
    }, [pendingTasks.length, isGenerating, popBackgroundTask, setGenerating, setGenerationProgress]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
        };
    }, []);

    // Nothing to show
    if (!isGenerating && pendingTasks.length === 0 && !showDone) return null;
    if (dismissed) return null;

    // Phase icon & label
    const getPhaseInfo = () => {
        const phase = generationProgress?.phase;
        switch (phase) {
            case 'cloning':
                return { icon: <Mic size={16} className="text-purple-500" />, label: t('bg_phase_cloning') };
            case 'generating':
                return { icon: <Music size={16} className="text-blue-500" />, label: t('bg_phase_generating') };
            case 'saving':
                return { icon: <Download size={16} className="text-green-500" />, label: t('bg_phase_saving') };
            case 'deleting':
                return { icon: <Trash2 size={16} className="text-orange-500" />, label: t('bg_phase_deleting') };
            case 'done':
                return { icon: <CheckCircle2 size={16} className="text-green-500" />, label: t('bg_phase_done') };
            default:
                return { icon: <Loader2 size={16} className="animate-spin text-gray-400" />, label: t('bg_generating') };
        }
    };

    const phaseInfo = getPhaseInfo();
    const progress = generationProgress;
    const percentage = progress && progress.totalPages > 0
        ? Math.round((progress.currentPage / progress.totalPages) * 100)
        : 0;

    // Done state
    if (showDone && !isGenerating) {
        return (
            <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-8 duration-500">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-2xl border border-green-200 p-4 w-72 md:w-80">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2.5 rounded-xl">
                            <CheckCircle2 className="text-green-500" size={22} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-green-800">
                                {t('bg_phase_done')}
                            </h4>
                            <p className="text-[10px] text-green-600 mt-0.5">
                                {t('bg_slot_freed')}
                            </p>
                        </div>
                        <button
                            onClick={() => { setShowDone(false); setDismissed(true); }}
                            className="text-green-400 hover:text-green-600 transition-colors p-1"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-8 duration-500">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-72 md:w-80">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="bg-purple-100 p-2.5 rounded-xl">
                        {isGenerating ? (
                            <Loader2 className="animate-spin text-purple-600" size={20} />
                        ) : (
                            <Loader2 className="animate-spin text-gray-300" size={20} />
                        )}
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-800">
                            {isGenerating ? t('bg_generating') : t('bg_waiting')}
                        </h4>
                        {pendingTasks.length > 0 && (
                            <p className="text-[10px] text-gray-400">{t('bg_remaining').replace('{count}', String(pendingTasks.length))}</p>
                        )}
                    </div>
                </div>

                {/* Phase indicator */}
                {isGenerating && (
                    <div className="space-y-2.5">
                        {/* Current phase pill */}
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                            {phaseInfo.icon}
                            <span className="text-[11px] font-medium text-gray-700">{phaseInfo.label}</span>
                        </div>

                        {/* Book & page progress */}
                        {progress && progress.totalPages > 0 && (
                            <>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-gray-600 font-medium truncate max-w-[140px]">
                                        {progress.bookTitle}
                                    </span>
                                    <span className="text-purple-600 font-bold whitespace-nowrap">
                                        {progress.currentPage} / {progress.totalPages} p
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-500 ease-out rounded-full"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>

                                {/* Percentage & book count */}
                                <div className="flex justify-between text-[10px] text-gray-400">
                                    <span>{percentage}%</span>
                                    {progress.totalBooks && progress.currentBook && (
                                        <span>
                                            📚 {progress.currentBook} / {progress.totalBooks}
                                        </span>
                                    )}
                                </div>
                            </>
                        )}

                        <p className="text-[10px] text-gray-400 text-center">
                            {t('bg_continues')}
                        </p>
                    </div>
                )}

                {!isGenerating && pendingTasks.length > 0 && (
                    <div className="py-2 text-center">
                        <Loader2 className="animate-spin text-gray-300 mx-auto" size={16} />
                    </div>
                )}
            </div>
        </div>
    );
};
