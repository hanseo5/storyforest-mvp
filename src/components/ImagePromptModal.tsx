import React, { useState, useRef } from 'react';
import { X, ImagePlus, Sparkles, Trash2, Loader } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { compressBase64Image } from '../services/imageService';

interface ImagePromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (customPrompt: string, referencePhotos: Array<{ data: string; mimeType: string }>) => void;
    pageText: string;
    isGenerating: boolean;
}

export const ImagePromptModal: React.FC<ImagePromptModalProps> = ({
    isOpen,
    onClose,
    onGenerate,
    pageText,
    isGenerating,
}) => {
    const { t } = useTranslation();
    const [customPrompt, setCustomPrompt] = useState('');
    const [referencePhotos, setReferencePhotos] = useState<Array<{ data: string; mimeType: string; preview: string }>>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;
            if (referencePhotos.length >= 4) break;

            const reader = new FileReader();
            reader.onload = async (ev) => {
                let dataUrl = ev.target?.result as string;
                try {
                    dataUrl = await compressBase64Image(dataUrl, 0.7, 1024);
                } catch {
                    // use original
                }
                const mimeType = dataUrl.split(';')[0].split(':')[1];
                const base64Data = dataUrl.split(',')[1];
                setReferencePhotos(prev => [
                    ...prev.slice(0, 3),
                    { data: base64Data, mimeType, preview: dataUrl }
                ]);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleRemovePhoto = (index: number) => {
        setReferencePhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerate = () => {
        onGenerate(
            customPrompt,
            referencePhotos.map(p => ({ data: p.data, mimeType: p.mimeType }))
        );
    };

    const handleClose = () => {
        if (!isGenerating) {
            setCustomPrompt('');
            setReferencePhotos([]);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg mx-4 bg-gradient-to-b from-gray-900 to-gray-950 rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                            <Sparkles size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">{t('img_prompt_title')}</h3>
                            <p className="text-white/40 text-xs">{t('img_prompt_subtitle')}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isGenerating}
                        className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/50 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 pb-6 space-y-4">
                    {/* Current Page Text (read-only context) */}
                    <div>
                        <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5">
                            {t('img_prompt_scene_text')}
                        </label>
                        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/60 text-sm leading-relaxed max-h-20 overflow-y-auto">
                            {pageText || <span className="italic text-white/30">{t('img_prompt_no_text')}</span>}
                        </div>
                    </div>

                    {/* Custom Instructions */}
                    <div>
                        <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5">
                            {t('img_prompt_instructions_label')}
                        </label>
                        <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder={t('img_prompt_instructions_placeholder')}
                            className="w-full bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
                            rows={4}
                            disabled={isGenerating}
                        />
                    </div>

                    {/* Reference Photos */}
                    <div>
                        <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5">
                            {t('img_prompt_reference_label')} <span className="text-white/30 normal-case font-normal">({t('img_prompt_optional')})</span>
                        </label>
                        <p className="text-white/30 text-xs mb-2">{t('img_prompt_reference_hint')}</p>

                        <div className="flex gap-2 flex-wrap">
                            {referencePhotos.map((photo, i) => (
                                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden group border border-white/10">
                                    <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => handleRemovePhoto(i)}
                                        disabled={isGenerating}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                    >
                                        <Trash2 size={16} className="text-red-400" />
                                    </button>
                                </div>
                            ))}

                            {referencePhotos.length < 4 && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isGenerating}
                                    className="w-20 h-20 border-2 border-dashed border-white/15 hover:border-indigo-400/50 rounded-xl flex flex-col items-center justify-center gap-1 text-white/30 hover:text-indigo-400 transition-all"
                                >
                                    <ImagePlus size={20} />
                                    <span className="text-[10px]">{t('img_prompt_add_photo')}</span>
                                </button>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleAddPhoto}
                            className="hidden"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleClose}
                            disabled={isGenerating}
                            className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded-xl font-semibold text-sm transition-all"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader size={16} className="animate-spin" />
                                    {t('img_prompt_generating')}
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    {t('img_prompt_generate')}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
