import React, { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { generateAllBooksAudio, generateBookAudio } from '../services/bookService';
import { deleteVoice } from '../services/elevenLabsService';
import { Loader2, CheckCircle2 } from 'lucide-react';

export const BackgroundAudioGenerator: React.FC = () => {
    const {
        isGenerating,
        generationProgress,
        pendingTasks,
        popBackgroundTask,
        setGenerating,
        setGenerationProgress
    } = useStore();

    const isProcessingRef = useRef(false);

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
                console.log('[Background] Starting task:', task);

                if (task.type === 'all') {
                    await generateAllBooksAudio(task.voiceId, (progress) => {
                        setGenerationProgress({
                            bookTitle: progress.bookTitle,
                            currentPage: progress.currentPage,
                            totalPages: progress.totalPages
                        });
                    });
                } else if (task.type === 'single' && task.bookId) {
                    // For single book, we can still report progress if we modify generateBookAudio
                    // But for now, just run it
                    await generateBookAudio(task.bookId, task.voiceId);
                }

                // Cleanup voice slot after generation
                console.log('[Background] Task complete, deleting voice slot:', task.voiceId);
                await deleteVoice(task.voiceId);

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

    // UI for background progress
    if (!isGenerating && pendingTasks.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-8 duration-500">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-72 md:w-80">
                <div className="flex items-center gap-3 mb-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                        {isGenerating ? (
                            <Loader2 className="animate-spin text-purple-600" size={20} />
                        ) : (
                            <CheckCircle2 className="text-green-500" size={20} />
                        )}
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-gray-800">
                            {isGenerating ? '오디오 생성 중...' : '대기 중...'}
                        </h4>
                        {pendingTasks.length > 0 && (
                            <p className="text-[10px] text-gray-400">남은 작업: {pendingTasks.length}개</p>
                        )}
                    </div>
                </div>

                {isGenerating && generationProgress && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-gray-600 font-medium truncate max-w-[150px]">
                                {generationProgress.bookTitle}
                            </span>
                            <span className="text-purple-600 font-bold">
                                {generationProgress.currentPage} / {generationProgress.totalPages}
                            </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-purple-500 transition-all duration-300"
                                style={{ width: `${(generationProgress.currentPage / generationProgress.totalPages) * 100}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 text-center">
                            창을 닫아도 백그라운드에서 계속 생성됩니다.
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
