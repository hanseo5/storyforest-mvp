import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Trash2, Upload, Image as ImageIcon, Save, BookOpen, Sparkles, Wand2, Loader, ChevronDown, ChevronUp, Palette } from 'lucide-react';
import { useStore } from '../store';
import { saveDraft } from '../services/draftService';
import { publishDraft } from '../services/bookService';
import { compressBase64Image, generateImage, ensureImageUrl } from '../services/imageService';
import { generateStoryPages, refineStoryText } from '../services/geminiService';
import type { DraftBook, DraftPage, Character } from '../types/draft';

const SoftWatercolorImg = '/styles/soft_watercolor.png';
const DigitalAnimationImg = '/styles/digital_animation.png';
const PencilSketchImg = '/styles/pencil_sketch.png';
const OilPaintingImg = '/styles/oil_painting.png';
const PastelDrawingImg = '/styles/pastel_drawing.png';
const InkIllustrationImg = '/styles/ink_illustration.png';
const ThreeDRenderImg = '/styles/3d_render.png';
const VintageStorybookImg = '/styles/vintage_storybook.png';

const STORY_STYLES = [
    { name: 'Soft Watercolor', image: SoftWatercolorImg },
    { name: 'Digital Animation', image: DigitalAnimationImg },
    { name: 'Pencil Sketch', image: PencilSketchImg },
    { name: 'Oil Painting', image: OilPaintingImg },
    { name: 'Pastel Drawing', image: PastelDrawingImg },
    { name: 'Ink Illustration', image: InkIllustrationImg },
    { name: '3D Render', image: ThreeDRenderImg },
    { name: 'Vintage Storybook', image: VintageStorybookImg }
];

export const StoryEditor: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useStore();
    const state = location.state as {
        metadata?: { title: string; prompt?: string; characters: Character[]; style: string; pages: number };
        prompt?: string;
        existingDraft?: DraftBook;
        protagonistImage?: string | null;
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const styleInputRef = useRef<HTMLInputElement>(null);

    const [title, setTitle] = useState(state?.metadata?.title || state?.existingDraft?.title || '');
    const [style, setStyle] = useState(state?.metadata?.style || state?.existingDraft?.style || 'Soft Watercolor');
    const [characters, setCharacters] = useState<Character[]>(state?.metadata?.characters || state?.existingDraft?.characters || []);
    const [coverImage, setCoverImage] = useState<string | null>(state?.protagonistImage || state?.existingDraft?.protagonistImage || null);
    const [pages, setPages] = useState<DraftPage[]>(state?.existingDraft?.pages || [
        { pageNumber: 1, text: '', imageStatus: 'pending' }
    ]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
    const [generatingCharacters, setGeneratingCharacters] = useState<Record<string, boolean>>({});
    const [customStyleImage, setCustomStyleImage] = useState<string | null>(state?.existingDraft?.styleImage || null);

    // Slash command state
    const [slashCommandActive, setSlashCommandActive] = useState(false);
    const [slashCommandText, setSlashCommandText] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [expandedSections, setExpandedSections] = useState({
        title: true,
        cover: true,
        style: true,
        characters: true,
        pages: true
    });

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const currentPage = pages[currentPageIndex];

    // Effect to handle AI character generation if coming from metadata but pages are empty
    useEffect(() => {
        if (state?.metadata && (!state.existingDraft) && pages.length === 1 && pages[0].text === '') {
            const generateAIContent = async () => {
                try {
                    const aiPages = await generateStoryPages(
                        state.metadata.title,
                        state.metadata.characters,
                        state.metadata.style,
                        state.metadata.pages
                    );
                    setPages(aiPages.map((p: { pageNumber: number; text: string }) => ({
                        pageNumber: p.pageNumber,
                        text: p.text,
                        imageUrl: null
                    })));
                } catch (error) {
                    console.error('[StoryEditor] Initial AI generation failed:', error);
                }
            };
            generateAIContent();
        }
    }, []);

    const handleAddPage = () => {
        const newPage: DraftPage = {
            pageNumber: pages.length + 1,
            text: '',
            imageStatus: 'pending'
        };
        setPages([...pages, newPage]);
        setCurrentPageIndex(pages.length);
    };

    const handleDeletePage = (index: number) => {
        if (pages.length <= 1) return;

        const newPages = pages.filter((_, i) => i !== index);
        const renumberedPages = newPages.map((p, i) => ({ ...p, pageNumber: i + 1 }));
        setPages(renumberedPages);

        if (currentPageIndex >= renumberedPages.length) {
            setCurrentPageIndex(renumberedPages.length - 1);
        }
    };

    const handleTextChange = (text: string) => {
        if (text.endsWith('/')) {
            setSlashCommandActive(true);
            setSlashCommandText('');
            const updatedPages = pages.map((p, i) =>
                i === currentPageIndex ? { ...p, text: text.slice(0, -1) } : p
            );
            setPages(updatedPages);
        } else {
            const updatedPages = pages.map((p, i) =>
                i === currentPageIndex ? { ...p, text } : p
            );
            setPages(updatedPages);
        }
    };

    const handleRefineText = async () => {
        if (!slashCommandText || !currentPage) return;

        setIsRefining(true);
        try {
            const refined = await refineStoryText(
                title || "The Story",
                currentPage.text,
                slashCommandText,
                style
            );
            handleTextChange(refined);
            setSlashCommandActive(false);
            setSlashCommandText('');
        } catch (error) {
            console.error('[StoryEditor] Refinement failed:', error);
        } finally {
            setIsRefining(false);
        }
    };

    const handleGenerateImage = async (pageNumber: number, customPrompt?: string) => {
        const page = pages.find(p => p.pageNumber === pageNumber);
        if (!page) return;

        setGeneratingImages(prev => ({ ...prev, [pageNumber]: true }));
        try {
            const imageUrl = await generateImage(
                customPrompt || page.text,
                style,
                {
                    characters,
                    styleImage: customStyleImage || undefined
                },
                {
                    title,
                    pageNumber,
                    totalPages: pages.length,
                    characterName: characters[0]?.name || 'the main character',
                    previousTexts: pages.slice(Math.max(0, pageNumber - 4), pageNumber - 1).map(p => p.text)
                }
            );

            const updatedPages = pages.map(p =>
                p.pageNumber === pageNumber ? { ...p, imageUrl, imageStatus: 'complete' as const } : p
            );
            setPages(updatedPages);
        } catch (error) {
            console.error('[StoryEditor] Image generation failed:', error);
            alert('Failed to generate image.');
        } finally {
            setGeneratingImages(prev => ({ ...prev, [pageNumber]: false }));
        }
    };

    const handleGenerateCharacterImage = async (id: string) => {
        const char = characters.find(c => c.id === id);
        if (!char) return;

        setGeneratingCharacters(prev => ({ ...prev, [id]: true }));
        try {
            const imageUrl = await generateImage(
                `A portrait of a character for a storybook. ${char.name}: ${char.description}`,
                style,
                {
                    characters,
                    styleImage: customStyleImage || undefined
                },
                {
                    title,
                    pageNumber: 0,
                    totalPages: pages.length,
                    characterName: char.name,
                    previousTexts: []
                }
            );
            handleUpdateCharacter(id, { imageUrl });
        } catch (error) {
            console.error('[StoryEditor] Character image generation failed:', error);
            alert('Failed to generate character image.');
        } finally {
            setGeneratingCharacters(prev => ({ ...prev, [id]: false }));
        }
    };

    const handleCharacterImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, id: string) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            let imageData = e.target?.result as string;
            try {
                imageData = await compressBase64Image(imageData, 0.6, 600);
            } catch (error) {
                console.warn('[StoryEditor] Character image compression failed:', error);
            }
            handleUpdateCharacter(id, { imageUrl: imageData });
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleAddCharacter = () => {
        const newChar: Character = {
            id: Date.now().toString(),
            name: 'New Character',
            description: '',
            imageUrl: null
        };
        setCharacters([...characters, newChar]);
    };

    const handleUpdateCharacter = (id: string, updates: Partial<Character>) => {
        setCharacters(characters.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleDeleteCharacter = (id: string) => {
        setCharacters(characters.filter(c => c.id !== id));
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, pageIndex: number) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            let imageData = e.target?.result as string;

            try {
                imageData = await compressBase64Image(imageData, 0.6, 800);
            } catch (error) {
                console.warn('[StoryEditor] Compression failed:', error);
            }

            const updatedPages = pages.map((p, i) =>
                i === pageIndex ? { ...p, imageUrl: imageData, imageStatus: 'complete' as const } : p
            );
            setPages(updatedPages);
        };
        reader.readAsDataURL(file);
    };

    const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            let imageData = e.target?.result as string;
            try {
                imageData = await compressBase64Image(imageData, 0.6, 800);
            } catch (error) {
                console.warn('[StoryEditor] Cover compression failed:', error);
            }
            setCoverImage(imageData);
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleStyleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            let imageData = e.target?.result as string;
            try {
                imageData = await compressBase64Image(imageData, 0.6, 600);
            } catch (error) {
                console.warn('[StoryEditor] Style reference compression failed:', error);
            }
            setCustomStyleImage(imageData);
            setStyle('Custom Style');
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleSave = async () => {
        if (!user || !title) {
            alert('Please enter a title');
            return;
        }

        setIsSaving(true);
        try {
            console.log('[StoryEditor] Starting deep save with image uploads...');

            // 1. Process Book-level images
            const uploadedCoverImage = await ensureImageUrl(coverImage, `drafts/${user.uid}/covers/${Date.now()}.jpg`);
            const uploadedStyleImage = await ensureImageUrl(customStyleImage, `drafts/${user.uid}/styles/${Date.now()}.jpg`);

            // 2. Process Character images
            const uploadedCharacters = await Promise.all(characters.map(async (char) => ({
                ...char,
                imageUrl: await ensureImageUrl(char.imageUrl, `drafts/${user.uid}/characters/${char.id}_${Date.now()}.jpg`)
            })));

            // 3. Process Page images
            const uploadedPages = await Promise.all(pages.map(async (p) => ({
                ...p,
                imageUrl: await ensureImageUrl(p.imageUrl, `drafts/${user.uid}/pages/page_${p.pageNumber}_${Date.now()}.jpg`),
                imageStatus: (p.imageUrl || p.imageStatus === 'complete') ? 'complete' as const : 'pending' as const
            })));

            // Update local state with URLs to prevent re-upload if save happens again immediately
            setCoverImage(uploadedCoverImage);
            setCustomStyleImage(uploadedStyleImage);
            setCharacters(uploadedCharacters);
            // Map to ensure imageUrl is undefined instead of null for state
            setPages(uploadedPages.map(p => ({ ...p, imageUrl: p.imageUrl || undefined })));

            const draft: DraftBook = {
                title,
                authorId: user.uid,
                protagonist: uploadedCharacters[0]?.name || 'the main character',
                characters: uploadedCharacters.map(c => ({ ...c, imageUrl: c.imageUrl || undefined })),
                protagonistImage: uploadedCoverImage || undefined,
                style,
                styleImage: uploadedStyleImage || undefined,
                pageCount: pages.length,
                prompt: state?.prompt || 'Story creation',
                status: 'editing',
                createdAt: Date.now(),
                pages: uploadedPages.map(p => ({ ...p, imageUrl: p.imageUrl || undefined }))
            };

            await saveDraft(draft);
            alert('Story saved as draft!');
            navigate('/');
        } catch (error) {
            console.error('[StoryEditor] Save failed:', error);
            alert('Failed to save. One or more images might be too large or Firebase Storage failed.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!user || !title) {
            alert('Please enter a title');
            return;
        }

        const hasAllText = pages.every(p => p.text && p.text.trim().length > 0);
        if (!hasAllText) {
            alert('All pages must have text before publishing');
            return;
        }

        if (!confirm('Are you sure you want to publish this story? It will be available in the Library.')) {
            return;
        }

        setIsPublishing(true);
        try {
            console.log('[StoryEditor] Starting deep publish with image uploads...');

            // 1. Process Book-level images (same as save)
            const uploadedCoverImage = await ensureImageUrl(coverImage, `drafts/${user.uid}/covers/${Date.now()}.jpg`);
            const uploadedStyleImage = await ensureImageUrl(customStyleImage, `drafts/${user.uid}/styles/${Date.now()}.jpg`);

            // 2. Process Character images
            const uploadedCharacters = await Promise.all(characters.map(async (char) => ({
                ...char,
                imageUrl: await ensureImageUrl(char.imageUrl, `drafts/${user.uid}/characters/${char.id}_${Date.now()}.jpg`)
            })));

            // 3. Process Page images
            const uploadedPages = await Promise.all(pages.map(async (p) => ({
                ...p,
                imageUrl: await ensureImageUrl(p.imageUrl, `drafts/${user.uid}/pages/page_${p.pageNumber}_${Date.now()}.jpg`),
                imageStatus: (p.imageUrl || p.imageStatus === 'complete') ? 'complete' as const : 'pending' as const
            })));

            const draft: DraftBook = {
                title,
                authorId: user.uid,
                protagonist: uploadedCharacters[0]?.name || 'the main character',
                characters: uploadedCharacters.map(c => ({ ...c, imageUrl: c.imageUrl || undefined })),
                protagonistImage: uploadedCoverImage || undefined,
                style,
                styleImage: uploadedStyleImage || undefined,
                pageCount: pages.length,
                prompt: state?.prompt || 'Story creation',
                status: 'editing',
                createdAt: Date.now(),
                pages: uploadedPages.map(p => ({ ...p, imageUrl: p.imageUrl || undefined }))
            };

            const draftId = await saveDraft(draft);
            draft.id = draftId;

            await publishDraft(draft);
            alert('Story published successfully! It is now available in the Library.');
            navigate('/library');
        } catch (error) {
            console.error('[StoryEditor] Publish failed:', error);
            alert('Failed to publish. Please check your connection.');
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="h-screen bg-gradient-to-b from-green-50 to-white flex flex-col overflow-hidden">
            {/* Top Bar */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-50 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">✨ Story Studio</h1>
                        <p className="text-sm text-gray-500">Unleash your imagination</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isPublishing || !title}
                        className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2 border border-gray-200"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={isSaving || isPublishing || !title}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        <BookOpen className="w-4 h-4" />
                        {isPublishing ? 'Publishing...' : 'Publish'}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Story Info & Characters */}
                <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto custom-scrollbar z-40">
                    {/* Title Section */}
                    <div className="mb-4">
                        <button
                            onClick={() => toggleSection('title')}
                            className="w-full flex items-center justify-between mb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                        >
                            Title
                            {expandedSections.title ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {expandedSections.title && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter story title..."
                                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                                />
                            </div>
                        )}
                    </div>

                    {/* Story Cover Section */}
                    <div className="mb-4 border-t border-gray-50 pt-4">
                        <button
                            onClick={() => toggleSection('cover')}
                            className="w-full flex items-center justify-between mb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                        >
                            Story Cover
                            {expandedSections.cover ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {expandedSections.cover && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                                <div
                                    onClick={() => coverInputRef.current?.click()}
                                    className="relative aspect-[3/4] bg-gray-50 rounded-2xl overflow-hidden border-2 border-dashed border-gray-100 cursor-pointer group hover:border-indigo-200 transition-all"
                                >
                                    {coverImage ? (
                                        <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                            <ImageIcon className="w-8 h-8 text-gray-200 mb-2" />
                                            <span className="text-[10px] font-bold text-gray-400">Click to upload cover</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <input
                                    type="file"
                                    ref={coverInputRef}
                                    onChange={handleCoverUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                        )}
                    </div>

                    {/* Visual Style Section */}
                    <div className="mb-4 border-t border-gray-50 pt-4">
                        <button
                            onClick={() => toggleSection('style')}
                            className="w-full flex items-center justify-between mb-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                        >
                            Visual Style
                            {expandedSections.style ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {expandedSections.style && (
                            <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                                {STORY_STYLES.map((artStyle) => (
                                    <button
                                        key={artStyle.name}
                                        type="button"
                                        onClick={() => setStyle(artStyle.name)}
                                        className={`group relative rounded-xl overflow-hidden transition-all duration-300 border-2 ${style === artStyle.name
                                            ? 'border-indigo-600 scale-105 shadow-md z-10'
                                            : 'border-transparent grayscale hover:grayscale-0 hover:scale-105'
                                            }`}
                                    >
                                        <div className="aspect-square relative">
                                            <img
                                                src={artStyle.image}
                                                alt={artStyle.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className={`absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-2 transition-opacity ${style === artStyle.name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                <span className="text-[7px] font-black uppercase tracking-wider text-white truncate">{artStyle.name}</span>
                                            </div>
                                        </div>
                                        {style === artStyle.name && (
                                            <div className="absolute top-1 right-1 bg-indigo-600 text-white p-0.5 rounded-full shadow-lg">
                                                <Palette size={8} />
                                            </div>
                                        )}
                                    </button>
                                ))}

                                {/* Custom Style Button */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        if (customStyleImage) {
                                            setStyle('Custom Style');
                                        } else {
                                            styleInputRef.current?.click();
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            if (customStyleImage) {
                                                setStyle('Custom Style');
                                            } else {
                                                styleInputRef.current?.click();
                                            }
                                        }
                                    }}
                                    className={`group relative rounded-xl overflow-hidden transition-all duration-300 border-2 cursor-pointer ${style === 'Custom Style'
                                        ? 'border-indigo-600 scale-105 shadow-md z-10'
                                        : 'border-transparent hover:scale-105'
                                        }`}
                                >
                                    <div className="aspect-square relative bg-gray-50 flex flex-col items-center justify-center p-2 text-center">
                                        {customStyleImage ? (
                                            <img src={customStyleImage} alt="Custom Style" className="w-full h-full object-cover" />
                                        ) : (
                                            <>
                                                <Plus size={16} className="text-gray-300 mb-1" />
                                                <span className="text-[7px] font-black uppercase tracking-wider text-gray-400">Custom Style</span>
                                            </>
                                        )}

                                        {customStyleImage && (
                                            <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center`}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        styleInputRef.current?.click();
                                                    }}
                                                    className="p-1.5 bg-white text-indigo-600 rounded-lg shadow-lg hover:scale-110 active:scale-95 transition-all"
                                                >
                                                    <Upload size={10} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {style === 'Custom Style' && (
                                        <div className="absolute top-1 right-1 bg-indigo-600 text-white p-0.5 rounded-full shadow-lg">
                                            <Palette size={8} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <input
                        id="style-upload"
                        type="file"
                        ref={styleInputRef}
                        onChange={handleStyleUpload}
                        accept="image/*"
                        className="hidden"
                    />

                    {/* Characters List */}
                    <div className="mb-4 border-t border-gray-50 pt-4">
                        <div
                            className="w-full flex items-center justify-between mb-4"
                        >
                            <button
                                onClick={() => toggleSection('characters')}
                                className="flex-1 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center justify-between"
                            >
                                Characters
                                <div className="flex items-center gap-2">
                                    {expandedSections.characters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddCharacter();
                                }}
                                className="ml-2 p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {expandedSections.characters && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {characters.map((char) => (
                                    <div key={char.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 group relative">
                                        <button
                                            onClick={() => handleDeleteCharacter(char.id)}
                                            className="absolute top-2 right-2 z-10 p-1 bg-white/80 backdrop-blur-sm shadow-sm rounded-lg text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={12} />
                                        </button>

                                        <div className="flex gap-4">
                                            {/* Character Image Area */}
                                            <div className="flex flex-col gap-2">
                                                <div
                                                    onClick={() => {
                                                        const input = document.getElementById(`char-upload-${char.id}`);
                                                        input?.click();
                                                    }}
                                                    className="w-16 h-20 bg-gray-200 rounded-xl overflow-hidden relative cursor-pointer group/img border border-gray-100"
                                                >
                                                    {char.imageUrl ? (
                                                        <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="flex items-center justify-center w-full h-full">
                                                            <ImageIcon className="w-6 h-6 text-gray-400 opacity-30" />
                                                        </div>
                                                    )}

                                                    {/* Overlays */}
                                                    {generatingCharacters[char.id] ? (
                                                        <div className="absolute inset-0 bg-indigo-600/40 backdrop-blur-sm flex items-center justify-center">
                                                            <Loader className="w-4 h-4 text-white animate-spin" />
                                                        </div>
                                                    ) : (
                                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                            <Upload size={12} />
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => handleGenerateCharacterImage(char.id)}
                                                    disabled={generatingCharacters[char.id]}
                                                    className="p-1 px-2 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50"
                                                >
                                                    {generatingCharacters[char.id] ? 'GEN...' : 'AI GEN'}
                                                </button>

                                                <input
                                                    id={`char-upload-${char.id}`}
                                                    type="file"
                                                    onChange={(e) => handleCharacterImageUpload(e, char.id)}
                                                    accept="image/*"
                                                    className="hidden"
                                                />
                                            </div>

                                            {/* Character Description Area */}
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={char.name}
                                                    onChange={(e) => handleUpdateCharacter(char.id, { name: e.target.value })}
                                                    className="w-full bg-transparent font-bold text-xs mb-1 focus:outline-none border-b border-transparent focus:border-indigo-100"
                                                    placeholder="Character Name"
                                                />
                                                <textarea
                                                    value={char.description}
                                                    onChange={(e) => handleUpdateCharacter(char.id, { description: e.target.value })}
                                                    className="w-full bg-transparent text-[10px] text-gray-500 resize-none focus:outline-none scrollbar-hide"
                                                    rows={3}
                                                    placeholder="Who is this character? Describe their appearance..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Editor Area - Cinematic View */}
                <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
                    {/* Background Image / Placeholder */}
                    <div className="absolute inset-0 z-0">
                        {currentPage.imageUrl ? (
                            <img
                                src={currentPage.imageUrl}
                                alt={`Page ${currentPage.pageNumber}`}
                                className="w-full h-full object-cover opacity-80 animate-in fade-in duration-700"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-indigo-900 flex flex-col items-center justify-center text-gray-500">
                                <ImageIcon className="w-20 h-20 opacity-20 mb-4" />
                                <p className="text-sm font-bold opacity-30">No illustration yet</p>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90" />
                    </div>

                    {/* Floating Page Navigation (Reader style) */}
                    {currentPageIndex > 0 && (
                        <button
                            onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                            className="absolute left-6 top-1/2 -translate-y-1/2 z-40 p-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white/50 hover:text-white transition-all shadow-2xl border border-white/10"
                            title="Previous Page"
                        >
                            <ArrowLeft size={32} />
                        </button>
                    )}

                    <button
                        onClick={() => {
                            if (currentPageIndex === pages.length - 1) {
                                handleAddPage();
                            } else {
                                setCurrentPageIndex(currentPageIndex + 1);
                            }
                        }}
                        className="absolute right-6 top-1/2 -translate-y-1/2 z-40 p-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white/50 hover:text-white transition-all shadow-2xl border border-white/10"
                        title={currentPageIndex === pages.length - 1 ? "Add Next Page" : "Next Page"}
                    >
                        {currentPageIndex === pages.length - 1 ? <Plus size={32} /> : <ArrowRight size={32} />}
                    </button>

                    {/* AI & Upload Controls (Floating) */}
                    <div className="absolute top-8 right-8 z-50 flex flex-col gap-3">
                        <button
                            onClick={() => handleGenerateImage(currentPage.pageNumber)}
                            disabled={generatingImages[currentPage.pageNumber]}
                            className="p-4 bg-indigo-600 text-white rounded-2xl shadow-2xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group border border-indigo-400"
                        >
                            {generatingImages[currentPage.pageNumber] ? (
                                <Loader size={24} className="animate-spin" />
                            ) : (
                                <Wand2 size={24} />
                            )}
                            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold ml-1">AI {currentPage.imageUrl ? 'Regenerate' : 'Generate'}</span>
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-4 bg-white text-gray-800 rounded-2xl shadow-2xl hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group border border-white"
                        >
                            <Upload size={24} />
                            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold ml-1">Upload Illustration</span>
                        </button>
                    </div>

                    {/* Narrative Overlay (The Stage) */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-40">
                        <div className="bg-black/40 backdrop-blur-2xl p-8 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden group">
                            {/* AI Processing Overlay */}
                            {isRefining && (
                                <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-md z-[100] flex items-center justify-center animate-in fade-in duration-300">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader className="w-8 h-8 text-white animate-spin" />
                                        <p className="text-[10px] font-black tracking-widest text-white uppercase">AI is polishing...</p>
                                    </div>
                                </div>
                            )}

                            <div className="relative">
                                <label className="block text-[10px] font-black text-indigo-300/60 uppercase tracking-[0.2em] mb-4 text-center">
                                    Page {currentPage.pageNumber} / {pages.length}
                                </label>

                                <textarea
                                    value={currentPage.text}
                                    onChange={(e) => handleTextChange(e.target.value)}
                                    className="w-full bg-transparent border-none text-white text-2xl md:text-3xl font-medium leading-relaxed text-center placeholder-white/20 focus:ring-0 min-h-[120px] resize-none transition-all scrollbar-hide"
                                    placeholder="Type '/' for AI magic, or express your imagination..."
                                />

                                {/* Slash Command Overlay - Immersive Style */}
                                {slashCommandActive && (
                                    <div className="absolute inset-x-0 -top-4 -translate-y-full mb-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500">
                                        <div className="bg-indigo-600/90 backdrop-blur-xl rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 border border-white/20">
                                            <div className="flex items-center gap-2 mb-4 text-white/80 text-[10px] font-black uppercase tracking-[0.2em]">
                                                <Sparkles size={16} className="text-white" />
                                                Narrative Polish
                                            </div>
                                            <div className="relative">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={slashCommandText}
                                                    onChange={(e) => setSlashCommandText(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRefineText();
                                                        if (e.key === 'Escape') setSlashCommandActive(false);
                                                    }}
                                                    placeholder="e.g., 'Make it more poetic and mysterious'"
                                                    className="w-full bg-white/10 border-none rounded-2xl px-6 py-4 text-lg text-white placeholder-white/40 focus:ring-2 focus:ring-white/30 transition-all font-medium"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                                    <span className="text-[10px] text-white/40 font-black tracking-widest bg-white/5 px-2 py-1 rounded-lg">↵ ENTER</span>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex justify-between items-center text-[10px] text-indigo-100/60 font-bold uppercase tracking-widest">
                                                <span>ESC TO CANCEL</span>
                                                <span className="flex items-center gap-2 italic">Gemini Pro <Sparkles size={10} /></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar - Page Management */}
                <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto custom-scrollbar z-40">
                    <div
                        className="w-full flex items-center justify-between mb-4"
                    >
                        <button
                            onClick={() => toggleSection('pages')}
                            className="flex-1 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center justify-between"
                        >
                            Pages ({pages.length})
                            <div className="flex items-center gap-2">
                                {expandedSections.pages ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAddPage();
                            }}
                            className="ml-2 p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {expandedSections.pages && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            {pages.map((page, index) => (
                                <div
                                    key={page.pageNumber}
                                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${index === currentPageIndex
                                        ? 'bg-indigo-600 shadow-lg shadow-indigo-100 text-white'
                                        : 'bg-white border border-gray-50 hover:bg-gray-50 text-gray-700'
                                        }`}
                                    onClick={() => setCurrentPageIndex(index)}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${index === currentPageIndex ? 'bg-white/20' : 'bg-gray-100'
                                        }`}>
                                        {page.pageNumber}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-bold truncate">
                                            {page.text || 'Empty page...'}
                                        </div>
                                    </div>
                                    {pages.length > 1 && index === currentPageIndex && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeletePage(index);
                                            }}
                                            className="p-1 text-white/60 hover:text-white"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleImageUpload(e, currentPageIndex)}
                accept="image/*"
                className="hidden"
            />
        </div>
    );
};
