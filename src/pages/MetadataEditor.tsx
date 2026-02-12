import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Sparkles, RefreshCw, Image as ImageIcon, Loader, Upload, Plus, Trash2, User, Palette } from 'lucide-react';
const SoftWatercolorImg = '/styles/soft_watercolor.png';
const DigitalAnimationImg = '/styles/digital_animation.png';
const PencilSketchImg = '/styles/pencil_sketch.png';
const OilPaintingImg = '/styles/oil_painting.png';
const PastelDrawingImg = '/styles/pastel_drawing.png';
const InkIllustrationImg = '/styles/ink_illustration.png';
const ThreeDRenderImg = '/styles/3d_render.png';
const VintageStorybookImg = '/styles/vintage_storybook.png';
import { generateStoryMetadata, refineCharacterDescription } from '../services/geminiService';
import { generateImage, compressBase64Image } from '../services/imageService';
import { useTranslation } from '../hooks/useTranslation';
import { toast } from '../components/Toast';
import type { DraftBook, Character } from '../types/draft';

interface LocationState {
    metadata: {
        title: string;
        description: string;
        style: string;
        pages?: number;
        characters?: Character[];
    };
    prompt: string;
    existingDraft?: DraftBook;
    protagonistImage?: string | null;
}

export const MetadataEditor: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState;
    const { t } = useTranslation();

    const [title, setTitle] = useState(state?.metadata?.title || '');
    const [style, setStyle] = useState(state?.metadata?.style || 'Soft Watercolor');
    const [pageCount, setPageCount] = useState(state?.metadata?.pages || 12);
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Multiple characters state
    const [characters, setCharacters] = useState<Character[]>(() => {
        if (state?.metadata?.characters && state.metadata.characters.length > 0) {
            return state.metadata.characters;
        }
        // Fallback or initialization from single protagonist
        return [{
            id: '1',
            name: 'Protagonist',
            description: state?.metadata?.description || '',
            imageUrl: state?.protagonistImage || null
        }];
    });

    const [generatingMap, setGeneratingMap] = useState<Record<string, boolean>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);

    // Slash command state
    const [slashCommandCharId, setSlashCommandCharId] = useState<string | null>(null);
    const [slashCommandText, setSlashCommandText] = useState('');
    const [isRefining, setIsRefining] = useState(false);

    const handleAddCharacter = () => {
        const newChar: Character = {
            id: Date.now().toString(),
            name: `Character ${characters.length + 1}`,
            description: '',
            imageUrl: null
        };
        setCharacters([...characters, newChar]);
    };

    const handleRemoveCharacter = (id: string) => {
        if (characters.length <= 1) return;
        setCharacters(characters.filter(c => c.id !== id));
    };

    const handleUpdateCharacter = (id: string, updates: Partial<Character>) => {
        setCharacters(characters.map(c =>
            c.id === id ? { ...c, ...updates } : c
        ));
    };

    const handleTextareaChange = (id: string, value: string) => {
        if (value.endsWith('/')) {
            setSlashCommandCharId(id);
            setSlashCommandText('');
            // Optional: remove the / from the text immediately or keep it as a visual cue
            handleUpdateCharacter(id, { description: value.slice(0, -1) });
        } else {
            handleUpdateCharacter(id, { description: value });
        }
    };

    const handleRefineCharacter = async (id: string) => {
        const char = characters.find(c => c.id === id);
        if (!char || !slashCommandText) return;

        setIsRefining(true);
        try {
            const refined = await refineCharacterDescription(
                char.name,
                char.description,
                slashCommandText,
                style
            );
            handleUpdateCharacter(id, { description: refined });
            setSlashCommandCharId(null);
            setSlashCommandText('');
        } catch (error) {
            console.error('[MetadataEditor] Refinement failed:', error);
        } finally {
            setIsRefining(false);
        }
    };

    const handleFileUpload = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            let imageData = e.target?.result as string;

            try {
                imageData = await compressBase64Image(imageData, 0.6, 800);
            } catch (error) {
                console.warn('[MetadataEditor] Compression failed:', error);
            }

            handleUpdateCharacter(id, { imageUrl: imageData });
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleRegenerate = async () => {
        if (!state?.prompt) return;

        setIsRegenerating(true);
        try {
            const newMetadata = await generateStoryMetadata(state.prompt);
            setTitle(newMetadata.title);
            setStyle(newMetadata.style);
            setPageCount(newMetadata.pages || 12);

            if (newMetadata.characters && newMetadata.characters.length > 0) {
                setCharacters(newMetadata.characters.map((c: { name: string; description: string }, i: number) => ({
                    id: (Date.now() + i).toString(),
                    name: c.name,
                    description: c.description,
                    imageUrl: null
                })));
            }
        } catch (error) {
            console.error('[MetadataEditor] Regeneration failed:', error);
            toast.error(t('meta_regen_failed'));
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleGenerateImageForCharacter = async (char: Character) => {
        if (!char.description || !style) {
            toast.warning(t('meta_desc_image_first'));
            return;
        }

        setGeneratingMap(prev => ({ ...prev, [char.id]: true }));
        try {
            const characterPrompt = `Character concept art for ${char.name}: ${char.description}`;
            let imageUrl = await generateImage(characterPrompt, style);

            if (imageUrl.startsWith('data:image')) {
                try {
                    imageUrl = await compressBase64Image(imageUrl, 0.5, 800);
                } catch (compressError) {
                    console.warn('[MetadataEditor] Compression failed:', compressError);
                }
            }

            handleUpdateCharacter(char.id, { imageUrl });
        } catch (error) {
            console.error('[MetadataEditor] Image generation failed:', error);
            toast.error(t('meta_image_gen_failed'));
        } finally {
            setGeneratingMap(prev => ({ ...prev, [char.id]: false }));
        }
    };

    const handleConfirm = () => {
        if (characters.some(c => !c.imageUrl)) {
            toast.warning(t('meta_need_all_images'));
            return;
        }

        const detailedStyle = `${style}. Specific character appearances based on character reference images provided must be used consistently.`;

        navigate('/editor/story', {
            state: {
                metadata: {
                    title,
                    characters,
                    style: detailedStyle,
                    pages: pageCount
                },
                prompt: state.prompt,
                existingDraft: state?.existingDraft
            }
        });
    };

    if (!state?.metadata) {
        return (
            <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-6">
                <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
                    <p className="text-gray-600 mb-6">{t('meta_no_metadata')}</p>
                    <button
                        onClick={() => navigate('/create')}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold"
                    >
                        {t('meta_go_create')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6 pb-24">
            <button
                onClick={() => navigate('/create')}
                className="flex items-center text-gray-500 hover:text-indigo-600 font-bold transition-all mb-8 group"
            >
                <div className="bg-white p-2 rounded-lg shadow-sm mr-3 group-hover:bg-indigo-50">
                    <ArrowLeft className="w-5 h-5" />
                </div>
                {t('meta_back_to_story')}
            </button>

            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <div className="bg-gradient-to-br from-purple-500 to-indigo-600 w-16 h-16 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl rotate-3">
                        <Sparkles className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">{t('meta_universe_setup')}</h1>
                    <p className="text-gray-500 text-lg">{t('meta_universe_desc')}</p>
                </div>

                <div className="space-y-8">
                    {/* Title Section */}
                    <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 p-8 border border-white">
                        <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                            {t('meta_story_title')}
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-2xl font-black text-gray-800 placeholder-gray-300"
                            placeholder={t('meta_title_placeholder')}
                        />
                    </div>

                    {/* Art Style Section */}
                    <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 p-8 border border-white">
                        <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">
                            {t('meta_visual_style')}
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                            {[
                                { name: 'Soft Watercolor', image: SoftWatercolorImg },
                                { name: 'Digital Animation', image: DigitalAnimationImg },
                                { name: 'Pencil Sketch', image: PencilSketchImg },
                                { name: 'Oil Painting', image: OilPaintingImg },
                                { name: 'Pastel Drawing', image: PastelDrawingImg },
                                { name: 'Ink Illustration', image: InkIllustrationImg },
                                { name: '3D Render', image: ThreeDRenderImg },
                                { name: 'Vintage Storybook', image: VintageStorybookImg }
                            ].map((artStyle) => (
                                <button
                                    key={artStyle.name}
                                    type="button"
                                    onClick={() => setStyle(artStyle.name)}
                                    className={`group relative rounded-2xl overflow-hidden transition-all duration-300 ${style === artStyle.name
                                        ? 'ring-4 ring-indigo-600 ring-offset-4 scale-105 z-10'
                                        : 'hover:scale-105 grayscale hover:grayscale-0'
                                        }`}
                                >
                                    <div className="aspect-square relative">
                                        <img
                                            src={artStyle.image}
                                            alt={artStyle.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3 transition-opacity ${style === artStyle.name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-white truncate">{artStyle.name}</span>
                                        </div>
                                    </div>
                                    {style === artStyle.name && (
                                        <div className="absolute top-2 right-2 bg-indigo-600 text-white p-1 rounded-full shadow-lg">
                                            <Palette size={12} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Character Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <label className="text-xl font-black text-gray-800 flex items-center gap-3">
                                <User className="text-indigo-600" />
                                {t('meta_character_refs')}
                            </label>
                            <button
                                onClick={handleAddCharacter}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
                            >
                                <Plus size={18} />
                                {t('meta_add_character')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {characters.map((char) => (
                                <div key={char.id} className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 p-6 border border-white group relative">
                                    {characters.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveCharacter(char.id)}
                                            className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors bg-gray-50 p-2 rounded-xl opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}

                                    <div className="flex flex-col gap-6">
                                        <div className="relative">
                                            {char.imageUrl ? (
                                                <div className="relative group/img overflow-hidden rounded-2xl">
                                                    <img
                                                        src={char.imageUrl}
                                                        alt={char.name}
                                                        className="w-full h-48 object-cover transition-transform duration-500 group-hover/img:scale-110"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity gap-3">
                                                        <button
                                                            onClick={() => handleGenerateImageForCharacter(char)}
                                                            className="p-3 bg-white text-indigo-600 rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all"
                                                        >
                                                            <RefreshCw size={20} className={generatingMap[char.id] ? 'animate-spin' : ''} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setActiveCharacterId(char.id);
                                                                fileInputRef.current?.click();
                                                            }}
                                                            className="p-3 bg-white text-green-600 rounded-2xl shadow-lg hover:scale-110 active:scale-95 transition-all"
                                                        >
                                                            <Upload size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                                                    {generatingMap[char.id] ? (
                                                        <div className="space-y-3">
                                                            <Loader className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                                                            <p className="text-xs font-bold text-gray-400">{t('meta_drawing_magic')}</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            <div className="bg-white p-3 rounded-2xl shadow-sm inline-block">
                                                                <ImageIcon className="text-slate-300" size={24} />
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    onClick={() => handleGenerateImageForCharacter(char)}
                                                                    disabled={!char.description || !style || generatingMap[char.id]}
                                                                    className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 disabled:opacity-30 transition-all"
                                                                >
                                                                    {t('meta_gen_ai_char')}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveCharacterId(char.id);
                                                                        fileInputRef.current?.click();
                                                                    }}
                                                                    className="text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-all"
                                                                >
                                                                    {t('meta_upload_image')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <input
                                                type="text"
                                                value={char.name}
                                                onChange={(e) => handleUpdateCharacter(char.id, { name: e.target.value })}
                                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 font-bold text-gray-800 placeholder-gray-300 focus:ring-2 focus:ring-indigo-500"
                                                placeholder={t('meta_char_name_placeholder')}
                                            />
                                            <textarea
                                                value={char.description}
                                                onChange={(e) => handleTextareaChange(char.id, e.target.value)}
                                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none"
                                                placeholder={t('meta_char_desc_placeholder')}
                                            />

                                            {/* Slash Command Overlay */}
                                            {slashCommandCharId === char.id && (
                                                <div className="absolute inset-x-6 top-[220px] z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="bg-indigo-600 rounded-2xl shadow-2xl p-4 border border-indigo-400">
                                                        <div className="flex items-center gap-2 mb-2 text-white/80 text-[10px] font-bold uppercase tracking-widest">
                                                            <Sparkles size={12} className="text-white" />
                                                            {t('meta_ai_brainstorm')}
                                                        </div>
                                                        <div className="relative">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={slashCommandText}
                                                                onChange={(e) => setSlashCommandText(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleRefineCharacter(char.id);
                                                                    if (e.key === 'Escape') setSlashCommandCharId(null);
                                                                }}
                                                                placeholder={t('meta_brainstorm_placeholder')}
                                                                className="w-full bg-indigo-700/50 border-none rounded-xl px-4 py-2 text-sm text-white placeholder-indigo-300 focus:ring-1 focus:ring-white"
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                {isRefining ? (
                                                                    <Loader size={14} className="text-white animate-spin" />
                                                                ) : (
                                                                    <span className="text-[10px] text-indigo-300 font-bold">↵ ENTER</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex justify-between items-center text-[9px] text-indigo-200">
                                                            <span>ESC to cancel</span>
                                                            <span>{t('meta_brainstorm_hint')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleRegenerate}
                            disabled={isRegenerating || !state.prompt}
                            className="flex-1 flex items-center justify-center gap-3 bg-white border-2 border-slate-100 text-slate-500 py-5 rounded-3xl font-black text-lg hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={isRegenerating ? 'animate-spin' : ''} size={24} />
                            {isRegenerating ? t('meta_regenerating') : t('meta_regenerate_ai')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={characters.some(c => !c.imageUrl) || !title}
                            className="flex-1 flex items-center justify-center gap-3 bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {t('meta_confirm_start')}
                            <Sparkles size={24} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Hidden inputs */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => activeCharacterId && handleFileUpload(activeCharacterId, e)}
                accept="image/*"
                className="hidden"
            />
        </div>
    );
};

