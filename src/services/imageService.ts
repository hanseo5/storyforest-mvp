import type { Character } from '../types/draft';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

interface ReferenceImages {
    characters?: Character[];   // New: support for multiple characters
    protagonistImage?: string;  // Maintain for compatibility
    previousPageImage?: string; // For scene continuity (rolling)
    styleImage?: string;        // Specific artistic style reference image
    userPhotos?: Array<{ data: string; mimeType: string }>; // User-uploaded reference photos
}

interface StoryContext {
    title: string;              // Story title for overall context
    characterName: string;      // Main character NAME (fallback)
    previousTexts: string[];    // Previous 2-3 pages of text for narrative flow
    pageNumber: number;         // Current page number
    totalPages: number;         // Total pages in the story
}

export const generateImage = async (
    prompt: string,
    style: string,
    references?: ReferenceImages,
    context?: StoryContext,
    aspectRatio?: '16:9' | '3:4' | '1:1'
): Promise<string> => {
    const characterCount = references?.characters?.length || (references?.protagonistImage ? 1 : 0);
    const hasPreviousPage = !!references?.previousPageImage;
    const hasStyleImage = !!references?.styleImage;
    const hasContext = !!context;

    try {
        // Build reference images array for the Cloud Function
        const refImages: Array<{ mimeType: string; data: string; label?: string }> = [];

        // Add character images
        if (references?.characters && references.characters.length > 0) {
            references.characters.forEach((char) => {
                if (char.imageUrl?.startsWith('data:image')) {
                    const base64Data = char.imageUrl.split(',')[1];
                    const mimeType = char.imageUrl.split(';')[0].split(':')[1];
                    refImages.push({ mimeType, data: base64Data, label: `character:${char.name}` });
                }
            });
        } else if (references?.protagonistImage?.startsWith('data:image')) {
            const base64Data = references.protagonistImage.split(',')[1];
            const mimeType = references.protagonistImage.split(';')[0].split(':')[1];
            refImages.push({ mimeType, data: base64Data, label: 'protagonist' });
        }

        // Add previous page image for scene continuity
        if (references?.previousPageImage?.startsWith('data:image')) {
            const base64Data = references.previousPageImage.split(',')[1];
            const mimeType = references.previousPageImage.split(';')[0].split(':')[1];
            refImages.push({ mimeType, data: base64Data, label: 'previousPage' });
        }

        // Add style reference image
        if (references?.styleImage?.startsWith('data:image')) {
            const base64Data = references.styleImage.split(',')[1];
            const mimeType = references.styleImage.split(';')[0].split(':')[1];
            refImages.push({ mimeType, data: base64Data, label: 'style' });
        }

        // Add user-uploaded reference photos
        if (references?.userPhotos && references.userPhotos.length > 0) {
            references.userPhotos.forEach((photo, i) => {
                refImages.push({ mimeType: photo.mimeType, data: photo.data, label: `userRef:${i + 1}` });
            });
        }

        const generateImageFn = httpsCallable<{
            prompt: string;
            style: string;
            referenceImages?: Array<{ mimeType: string; data: string; label?: string }>;
            context?: StoryContext;
            aspectRatio?: '16:9' | '3:4' | '1:1';
        }, string>(functions, 'generateImageCF', { timeout: 180000 });

        const result = await generateImageFn({
            prompt,
            style,
            referenceImages: refImages.length > 0 ? refImages : undefined,
            context: context || undefined,
            aspectRatio: aspectRatio || undefined,
        });

        return result.data;

    } catch (error) {
        console.error('[ImageService] Error generating image:', error);
        return `https://source.unsplash.com/1920x1080/?${encodeURIComponent(prompt)},${style},illustration`;
    }
};

export const uploadImage = async (file: File): Promise<string> => {
    return URL.createObjectURL(file);
};

export const ensureImageUrl = async (
    imageData: string | null | undefined,
    path: string
): Promise<string | null> => {
    if (!imageData) return null;
    if (!imageData.startsWith('data:image')) return imageData; // Already a URL (probably)

    return await uploadBase64ToStorage(imageData, path);
};

export const uploadBase64ToStorage = async (
    base64Data: string,
    path: string
): Promise<string> => {
    try {
        const { storage } = await import('../lib/firebase');
        const { ref, uploadString, getDownloadURL } = await import('firebase/storage');

        // Ensure path doesn't start with / for Firebase Storage
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        const storageRef = ref(storage, cleanPath);

        await uploadString(storageRef, base64Data, 'data_url');
        const url = await getDownloadURL(storageRef);
        return url;
    } catch (error) {
        console.error('[ImageService] Error uploading to Storage:', error);
        // Fallback to compressed base64 if upload fails, but this might still hit Firestore limits
        return await compressBase64Image(base64Data, 0.5, 800);
    }
};

export const compressBase64Image = (
    base64Data: string,
    quality: number = 0.6,
    maxWidth: number = 800
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = base64Data;
    });
};
