import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, Square, Check, ChevronRight, Play, Pause, RotateCcw } from 'lucide-react';
import { addVoice } from '../services/elevenLabsService';
import { saveVoice } from '../services/voiceService';
import { useStore } from '../store';
import { RecordingQualityGuide } from './RecordingQualityGuide';
import { SAMPLE_TEXTS, getRecommendedTime } from '../constants/recordingGuide';
import { useTranslation } from '../hooks/useTranslation';
import { translateContent } from '../services/geminiService';

interface VoiceRecordModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const VoiceRecordModal: React.FC<VoiceRecordModalProps> = ({ onClose, onSuccess }) => {
    const { t, targetLanguage } = useTranslation();
    const user = useStore((state) => state.user);
    const [step, setStep] = useState<'guide' | 'record' | 'name' | 'processing' | 'done'>('guide');
    const [voiceName, setVoiceName] = useState('');
    const [processStatus, setProcessStatus] = useState('');
    const [recordingMode, setRecordingMode] = useState<'quick' | 'quality'>('quick');
    const [dynamicSampleText, setDynamicSampleText] = useState('');
    const [isTranslatingSample, setIsTranslatingSample] = useState(false);

    // Recording
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | undefined>(undefined);

    // Audio preview
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const recommendedTime = getRecommendedTime(recordingMode);

    useEffect(() => {
        const translateSample = async () => {
            if (targetLanguage === 'Original') {
                setDynamicSampleText(recordingMode === 'quality' ? SAMPLE_TEXTS.quality : SAMPLE_TEXTS.quick);
                return;
            }

            setIsTranslatingSample(true);
            try {
                const baseText = recordingMode === 'quality' ? SAMPLE_TEXTS.quality : SAMPLE_TEXTS.quick;
                const translated = await translateContent(baseText, targetLanguage);
                setDynamicSampleText(translated);
            } catch {
                setDynamicSampleText(recordingMode === 'quality' ? SAMPLE_TEXTS.quality : SAMPLE_TEXTS.quick);
            } finally {
                setIsTranslatingSample(false);
            }
        };
        translateSample();
    }, [targetLanguage, recordingMode]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                URL.revokeObjectURL(audioRef.current.src);
            }
        };
    }, []);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setRecordedBlob(blob);
                stream.getTracks().forEach(track => track.stop());
                if (timerRef.current) clearInterval(timerRef.current);
            };

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000) as unknown as number;

        } catch (err) {
            console.error(err);
            alert('Microphone access is required.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handlePlayPreview = () => {
        if (!recordedBlob) return;

        if (isPlaying && audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
            return;
        }

        const audioUrl = URL.createObjectURL(recordedBlob);
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.play();
        setIsPlaying(true);
    };

    const handleRerecord = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setRecordedBlob(null);
        setIsPlaying(false);
        setRecordingTime(0);
    };

    const handleProceedToName = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
        if (recordedBlob) {
            setStep('name');
        }
    };

    const handleSaveVoice = async () => {
        if (!recordedBlob || !user || !voiceName.trim()) return;

        setStep('processing');
        try {
            // Step 1: Clone voice in ElevenLabs
            setProcessStatus(t('processing'));
            const voiceId = await addVoice(voiceName.trim(), recordedBlob);

            // Step 2: Save voice info to Firestore
            await saveVoice(user.uid, voiceId, voiceName.trim());

            // Step 3: Add to background task queue for generation
            useStore.getState().addBackgroundTask({
                voiceId,
                type: 'all'
            });

            setStep('done');
            // No deep wait, just success message

        } catch (error) {
            console.error(error);
            alert('Failed to clone voice. Please try again.');
            setStep('record');
        }
    };

    const getRecordingQualityIndicator = () => {
        const { min, recommended, max } = recommendedTime;

        if (recordingTime < min) {
            return { color: 'text-yellow-500', message: t('min_recording_required', { time: formatTime(min) }) };
        } else if (recordingTime >= min && recordingTime < recommended) {
            return { color: 'text-blue-500', message: 'Good! Just a bit more' };
        } else if (recordingTime >= recommended && recordingTime <= max) {
            return { color: 'text-green-500', message: "Perfect! You can stop anytime" };
        } else {
            return { color: 'text-green-500', message: "That's enough! Please stop recording" };
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 flex justify-between items-center text-white shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Mic className="w-6 h-6" />
                        {t('clone_voice')}
                    </h2>
                    {step !== 'processing' && (
                        <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* Step: Guide */}
                    {step === 'guide' && (
                        <div className="space-y-5">
                            <div className="text-center mb-4">
                                <h3 className="text-lg font-bold text-gray-800 mb-1">{t('before_recording')}</h3>
                                <p className="text-sm text-gray-500">{t('tips_for_cloning')}</p>
                            </div>

                            <RecordingQualityGuide
                                mode={recordingMode}
                                onModeChange={setRecordingMode}
                                showModeSelector={true}
                            />

                            <button
                                onClick={() => setStep('record')}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-[1.02]"
                            >
                                {t('start_recording')} <ChevronRight size={20} />
                            </button>
                        </div>
                    )}

                    {/* Step: Record */}
                    {step === 'record' && (
                        <div className="space-y-5">
                            {/* Sample Text */}
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 max-h-48 overflow-y-auto">
                                <p className="text-purple-900 font-medium mb-2 text-xs uppercase tracking-widest">
                                    {t('please_read_below')}
                                </p>
                                <p className={`text-gray-700 leading-relaxed text-sm whitespace-pre-line ${isTranslatingSample ? 'opacity-50 animate-pulse' : ''}`}>
                                    {isTranslatingSample ? t('translating') : dynamicSampleText}
                                </p>
                            </div>

                            {/* Recording Controls */}
                            <div className="flex flex-col items-center gap-4">
                                {/* Timer */}
                                <div className="text-center">
                                    <div className="text-4xl font-mono font-bold text-gray-700">
                                        {formatTime(recordingTime)}
                                    </div>
                                    {isRecording && (
                                        <p className={`text-xs mt-1 ${getRecordingQualityIndicator().color}`}>
                                            {getRecordingQualityIndicator().message}
                                        </p>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                {isRecording && (
                                    <div className="w-full max-w-xs">
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${recordingTime < recommendedTime.min
                                                    ? 'bg-yellow-400'
                                                    : recordingTime < recommendedTime.recommended
                                                        ? 'bg-blue-500'
                                                        : 'bg-green-500'
                                                    }`}
                                                style={{
                                                    width: `${Math.min((recordingTime / recommendedTime.max) * 100, 100)}%`
                                                }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                                            <span>Min</span>
                                            <span>Rec.</span>
                                            <span>Max</span>
                                        </div>
                                    </div>
                                )}

                                {/* Record Button */}
                                {!isRecording && !recordedBlob && (
                                    <button
                                        onClick={startRecording}
                                        className="bg-red-500 hover:bg-red-600 text-white w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                                    >
                                        <Mic size={36} />
                                    </button>
                                )}

                                {/* Stop Button */}
                                {isRecording && (
                                    <button
                                        onClick={stopRecording}
                                        className="bg-gray-800 hover:bg-black text-white w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                                    >
                                        <div className="relative">
                                            <Square size={32} fill="currentColor" />
                                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs bg-red-500 text-white px-2 py-0.5 rounded animate-pulse">
                                                {t('recording')}
                                            </span>
                                        </div>
                                    </button>
                                )}

                                {/* Preview Controls */}
                                {recordedBlob && !isRecording && (
                                    <div className="space-y-4 w-full max-w-xs">
                                        {/* Audio Preview */}
                                        <div className="flex items-center justify-center gap-3">
                                            <button
                                                onClick={handlePlayPreview}
                                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                            >
                                                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                                                <span className="text-sm">{isPlaying ? t('pause') : t('preview')}</span>
                                            </button>
                                            <button
                                                onClick={handleRerecord}
                                                className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <RotateCcw size={18} />
                                                <span className="text-sm">{t('re_record')}</span>
                                            </button>
                                        </div>

                                        {/* Recording Info */}
                                        <div className="text-center text-sm text-gray-500">
                                            Rec Time: {formatTime(recordingTime)}
                                            {recordingTime >= recommendedTime.min && (
                                                <span className="ml-2 text-green-500">✓ {t('confirm')}</span>
                                            )}
                                        </div>

                                        {/* Next Button */}
                                        <button
                                            onClick={handleProceedToName}
                                            disabled={recordingTime < recommendedTime.min}
                                            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-[1.02]"
                                        >
                                            {t('confirm')} <ChevronRight size={20} />
                                        </button>

                                        {recordingTime < recommendedTime.min && (
                                            <p className="text-xs text-center text-yellow-600">
                                                {t('min_recording_required', { time: formatTime(recommendedTime.min) })}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step: Name */}
                    {step === 'name' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Name your voice</h3>
                                <p className="text-gray-500 text-sm">Give it a name so you can find it later</p>
                            </div>

                            <input
                                type="text"
                                value={voiceName}
                                onChange={(e) => setVoiceName(e.target.value)}
                                placeholder="e.g., Mom's Voice, Dad's Storytime"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-lg"
                                autoFocus
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('record')}
                                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                                >
                                    {t('ill_do_it_later')}
                                </button>
                                <button
                                    onClick={handleSaveVoice}
                                    disabled={!voiceName.trim()}
                                    className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t('confirm')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Processing */}
                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-6 text-center">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Mic className="text-purple-600" size={24} />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">{t('processing')}</h3>
                                <p className="text-gray-600 animate-pulse">{processStatus}</p>
                            </div>
                        </div>
                    )}

                    {/* Step: Done */}
                    {step === 'done' && (
                        <div className="text-center py-8 space-y-4">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800">{t('ready')}</h3>
                            <p className="text-gray-600 text-sm">
                                {t('voice_analysis_complete')}<br />
                                <strong>{t('background_generation')}</strong><br />
                                You'll be able to read with your voice shortly!
                            </p>
                            <button
                                onClick={onSuccess}
                                className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold mt-4 shadow-lg hover:bg-purple-700 transition-colors"
                            >
                                {t('confirm')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
