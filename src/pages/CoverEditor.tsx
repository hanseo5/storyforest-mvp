import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Loader, Image as ImageIcon, Upload } from 'lucide-react';
import { generateImage } from '../services/imageService';
import { useStore } from '../store';
import { useTranslation } from '../hooks/useTranslation';
import { toast } from '../components/Toast';
import { doc, getDoc, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { publishDraft } from '../services/bookService';
import { queueAudioForNewBook } from '../services/voiceService';
import type { DraftBook, DraftPage } from '../types/draft';

interface LocationState {
    draftId: string;
}

export const CoverEditor: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useStore();
    const { t } = useTranslation();
    const state = location.state as LocationState;

    const [draft, setDraft] = useState<DraftBook | null>(null);
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [isGeneratingCover, setIsGeneratingCover] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [authorName, setAuthorName] = useState(user?.displayName || 'Anonymous');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load draft on mount
    React.useEffect(() => {
        if (!state?.draftId) return;

        const loadDraft = async () => {
            try {
                const draftRef = doc(db, 'drafts', state.draftId);
                const draftSnap = await getDoc(draftRef);

                if (!draftSnap.exists()) {
                    toast.error(t('cover_draft_not_found'));
                    navigate('/create');
                    return;
                }

                const draftData = { id: draftSnap.id, ...draftSnap.data() } as DraftBook;

                // Load pages
                const pagesRef = collection(db, 'drafts', state.draftId, 'pages');
                const pagesQuery = query(pagesRef, orderBy('pageNumber', 'asc'));
                const pagesSnapshot = await getDocs(pagesQuery);
                const pages = pagesSnapshot.docs.map(doc => doc.data());

                draftData.pages = pages as unknown as DraftPage[];
                setDraft(draftData);

                // Use first page image as initial cover
                if (pages.length > 0 && pages[0].imageUrl) {
                    setCoverImage(pages[0].imageUrl as string);
                }
            } catch (error) {
                console.error('[CoverEditor] Failed to load draft:', error);
                toast.error(t('cover_load_failed'));
                navigate('/create');
            }
        };

        loadDraft();
    }, [state, navigate]);

    const handleGenerateCover = async () => {
        if (!draft) return;

        setIsGeneratingCover(true);
        try {
            const coverPrompt = `Book cover illustration for children's book titled "${draft.title}". ${draft.protagonist}. DO NOT include any text in the image, just the visual illustration.`;
            const imageUrl = await generateImage(coverPrompt, draft.style);
            setCoverImage(imageUrl);
        } catch (error) {
            console.error('[CoverEditor] Failed to generate cover:', error);
            toast.error(t('cover_gen_failed'));
        } finally {
            setIsGeneratingCover(false);
        }
    };

    const handleUploadCover = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setCoverImage(base64Image);
        };
        reader.readAsDataURL(file);
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleUploadCover(file);
        }
        e.target.value = '';
    };

    const handlePublish = async () => {
        if (!draft || !coverImage) {
            toast.warning(t('cover_need_image'));
            return;
        }

        setIsPublishing(true);
        try {

            // Update draft with cover image
            const updatedDraft = {
                ...draft,
                protagonistImage: coverImage,
                authorName: authorName
            };

            // Should save draft update first? Maybe not needed if publishDraft handles it.
            // But let's make sure draft has the cover image.

            const bookId = await publishDraft(updatedDraft);

            // Auto-generate audio with user's selected cloned voice
            await queueAudioForNewBook(draft.authorId, bookId);

            toast.success(t('cover_publish_success', { title: draft.title }));
            navigate('/library');
        } catch (error) {
            console.error('[CoverEditor] Failed to publish:', error);
            toast.error(t('cover_publish_failed'));
        } finally {
            setIsPublishing(false);
        }
    };

    if (!draft) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader className="w-12 h-12 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-6">
            {/* Hidden file input for cover upload */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />
            {/* Top Bar */}
            <div className="max-w-4xl mx-auto mb-8">
                <button
                    onClick={() => navigate('/editor/story', { state: { ...location.state } })}
                    className="flex items-center text-gray-600 hover:text-gray-900"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    {t('cover_back_to_editor')}
                </button>
            </div>

            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">{t('cover_create_title')}</h1>
                    <p className="text-gray-600">{t('cover_final_step')}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
                    {/* Title Display */}
                    <div>
                        <h2 className="text-3xl font-bold text-gray-800 mb-2">{draft.title}</h2>
                        <p className="text-gray-600">{draft.pages.length} pages</p>
                    </div>

                    {/* Author Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('cover_author_name')}
                        </label>
                        <input
                            type="text"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('cover_author_placeholder')}
                        />
                    </div>

                    {/* Cover Image */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('cover_image_label')}
                        </label>

                        {coverImage ? (
                            <div className="relative">
                                <img
                                    src={coverImage}
                                    alt="Book Cover"
                                    className="w-full h-96 object-cover rounded-xl shadow-lg"
                                />
                                <button
                                    onClick={handleGenerateCover}
                                    disabled={isGeneratingCover}
                                    className="mt-4 w-full px-4 py-3 border-2 border-indigo-600 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 flex items-center justify-center gap-2"
                                >
                                    <ImageIcon className="w-5 h-5" />
                                    {isGeneratingCover ? t('cover_regenerating') : t('cover_regenerate_ai')}
                                </button>
                                <button
                                    onClick={triggerFileUpload}
                                    className="mt-2 w-full px-4 py-3 border-2 border-green-600 text-green-600 rounded-xl font-semibold hover:bg-green-50 flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-5 h-5" />
                                    {t('cover_replace_upload')}
                                </button>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                                {isGeneratingCover ? (
                                    <div>
                                        <Loader className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                                        <p className="text-gray-600">{t('cover_creating')}</p>
                                    </div>
                                ) : (
                                    <div>
                                        <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600 mb-4">{t('cover_choose_method')}</p>
                                        <div className="flex gap-3 justify-center flex-wrap">
                                            <button
                                                onClick={handleGenerateCover}
                                                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 flex items-center gap-2"
                                            >
                                                <ImageIcon className="w-5 h-5" />
                                                {t('cover_generate_ai')}
                                            </button>
                                            <button
                                                onClick={triggerFileUpload}
                                                className="px-8 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 flex items-center gap-2"
                                            >
                                                <Upload className="w-5 h-5" />
                                                {t('cover_upload_image')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Publish Button */}
                    <div className="pt-6 border-t border-gray-200">
                        <button
                            onClick={handlePublish}
                            disabled={isPublishing || !coverImage}
                            className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                        >
                            {isPublishing ? (
                                <>
                                    <Loader className="w-6 h-6 animate-spin" />
                                    {t('cover_publishing')}
                                </>
                            ) : (
                                <>
                                    <Check className="w-6 h-6" />
                                    {t('cover_publish_book')}
                                </>
                            )}
                        </button>
                        <p className="text-sm text-gray-500 text-center mt-3">
                            {t('cover_publish_hint')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
