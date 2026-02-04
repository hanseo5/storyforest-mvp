import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Loader, Image as ImageIcon, Upload } from 'lucide-react';
import { generateImage } from '../services/imageService';
import { useStore } from '../store';
import { doc, getDoc, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { publishDraft } from '../services/bookService';
import type { DraftBook } from '../types/draft';

interface LocationState {
    draftId: string;
}

export const CoverEditor: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useStore();
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
                    alert('Draft not found');
                    navigate('/create');
                    return;
                }

                const draftData = { id: draftSnap.id, ...draftSnap.data() } as DraftBook;

                // Load pages
                const pagesRef = collection(db, 'drafts', state.draftId, 'pages');
                const pagesQuery = query(pagesRef, orderBy('pageNumber', 'asc'));
                const pagesSnapshot = await getDocs(pagesQuery);
                const pages = pagesSnapshot.docs.map(doc => doc.data());

                draftData.pages = pages as any[];
                setDraft(draftData);

                // Use first page image as initial cover
                if (pages.length > 0 && pages[0].imageUrl) {
                    setCoverImage(pages[0].imageUrl as string);
                }
            } catch (error) {
                console.error('[CoverEditor] Failed to load draft:', error);
                alert('Failed to load draft');
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
            alert('Failed to generate cover. Please try again.');
        } finally {
            setIsGeneratingCover(false);
        }
    };

    const handleUploadCover = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setCoverImage(base64Image);
            console.log('[CoverEditor] Cover image uploaded successfully');
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
            alert('Please generate a cover image first');
            return;
        }

        setIsPublishing(true);
        try {
            console.log('[CoverEditor] Publishing book...');

            // Update draft with cover image
            const updatedDraft = {
                ...draft,
                protagonistImage: coverImage,
                authorName: authorName
            };

            // Should save draft update first? Maybe not needed if publishDraft handles it.
            // But let's make sure draft has the cover image.

            await publishDraft(updatedDraft);

            console.log('[CoverEditor] Book published successfully');
            alert(`"${draft.title}" published successfully! 🎉`);
            navigate('/library');
        } catch (error) {
            console.error('[CoverEditor] Failed to publish:', error);
            alert('Failed to publish book. Please try again.');
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
                    Back to Editor
                </button>
            </div>

            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Create Your Book Cover</h1>
                    <p className="text-gray-600">Final step before publishing your masterpiece!</p>
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
                            Author Name
                        </label>
                        <input
                            type="text"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter author name..."
                        />
                    </div>

                    {/* Cover Image */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Cover Image
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
                                    {isGeneratingCover ? 'Regenerating...' : 'Regenerate with AI'}
                                </button>
                                <button
                                    onClick={triggerFileUpload}
                                    className="mt-2 w-full px-4 py-3 border-2 border-green-600 text-green-600 rounded-xl font-semibold hover:bg-green-50 flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-5 h-5" />
                                    Replace with Upload
                                </button>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                                {isGeneratingCover ? (
                                    <div>
                                        <Loader className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                                        <p className="text-gray-600">Creating your book cover...</p>
                                    </div>
                                ) : (
                                    <div>
                                        <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600 mb-4">Choose how to add your cover</p>
                                        <div className="flex gap-3 justify-center flex-wrap">
                                            <button
                                                onClick={handleGenerateCover}
                                                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 flex items-center gap-2"
                                            >
                                                <ImageIcon className="w-5 h-5" />
                                                Generate with AI
                                            </button>
                                            <button
                                                onClick={triggerFileUpload}
                                                className="px-8 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 flex items-center gap-2"
                                            >
                                                <Upload className="w-5 h-5" />
                                                Upload Image
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
                                    Publishing...
                                </>
                            ) : (
                                <>
                                    <Check className="w-6 h-6" />
                                    Publish Book
                                </>
                            )}
                        </button>
                        <p className="text-sm text-gray-500 text-center mt-3">
                            Your book will be published to the library
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
