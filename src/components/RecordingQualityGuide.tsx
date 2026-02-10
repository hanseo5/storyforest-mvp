import React from 'react';
import {
    Mic,
    Volume2,
    Clock,
    Headphones,
    VolumeX,
    Gauge,
    CheckCircle2,
    Info
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface RecordingQualityGuideProps {
    mode: 'quick' | 'quality';
    onModeChange?: (mode: 'quick' | 'quality') => void;
    showModeSelector?: boolean;
}

export const RecordingQualityGuide: React.FC<RecordingQualityGuideProps> = ({
    mode,
    onModeChange,
    showModeSelector = true
}) => {
    const { t } = useTranslation();
    const tips = [
        { icon: VolumeX, text: t('record_quiet_place'), color: 'text-blue-500' },
        { icon: Mic, text: t('keep_20cm'), color: 'text-purple-500' },
        { icon: Volume2, text: t('read_clearly'), color: 'text-green-500' },
        { icon: Headphones, text: t('earphones_better'), color: 'text-orange-500' },
    ];

    return (
        <div className="space-y-4">
            {/* Mode Selector */}
            {showModeSelector && onModeChange && (
                <div className="flex gap-2">
                    <button
                        onClick={() => onModeChange('quick')}
                        className={`flex-1 p-3 rounded-xl border-2 transition-all ${mode === 'quick'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Gauge size={18} className={mode === 'quick' ? 'text-blue-600' : 'text-gray-400'} />
                            <span className={`font-bold text-sm ${mode === 'quick' ? 'text-blue-700' : 'text-gray-600'}`}>
                                Quick Record
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">20s ~ 1m</p>
                    </button>
                    <button
                        onClick={() => onModeChange('quality')}
                        className={`flex-1 p-3 rounded-xl border-2 transition-all ${mode === 'quality'
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <CheckCircle2 size={18} className={mode === 'quality' ? 'text-purple-600' : 'text-gray-400'} />
                            <span className={`font-bold text-sm ${mode === 'quality' ? 'text-purple-700' : 'text-gray-600'}`}>
                                High Quality
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">2~5m rec.</p>
                    </button>
                </div>
            )}

            {/* Quality Info Banner */}
            {mode === 'quality' && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-3 rounded-xl border border-purple-100">
                    <div className="flex items-start gap-2">
                        <Info size={16} className="text-purple-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-purple-800">
                            <strong>High Quality mode</strong> uses longer recordings to help the AI learn your voice more accurately. Including various tones and emotions is even better!
                        </p>
                    </div>
                </div>
            )}

            {/* Tips */}
            <div className="grid grid-cols-2 gap-2">
                {tips.map((tip, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                        <tip.icon size={14} className={tip.color} />
                        <span className="text-xs text-gray-600">{tip.text}</span>
                    </div>
                ))}
            </div>

            {/* Recording Time Guide */}
            <div className="flex items-center justify-center gap-4 py-2">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12} />
                    <span>Recommended Time:</span>
                </div>
                {mode === 'quick' ? (
                    <span className="text-sm font-bold text-blue-600">20s ~ 1m</span>
                ) : (
                    <span className="text-sm font-bold text-purple-600">2m ~ 5m</span>
                )}
            </div>
        </div>
    );
};
