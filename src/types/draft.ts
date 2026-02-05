export interface Character {
    id: string;
    name: string;
    description: string;
    imageUrl?: string | null;
}

export interface StoryVariables {
    childName: string;
    childAge: number;
    interests: string[];
    message: string;
    customMessage?: string;
    targetLanguage?: string;
}

export interface DraftPage {
    pageNumber: number;
    text: string;
    imageUrl?: string;
    imageStatus: 'pending' | 'generating' | 'complete';
}

export interface DraftBook {
    id?: string;
    title: string;
    authorId: string;
    protagonist: string; // Maintain for backward compatibility
    protagonistImage?: string | null; // Maintain for backward compatibility
    characters: Character[]; // New: support for multiple characters
    style: string;
    styleImage?: string | null;
    pageCount: number;
    prompt: string;
    status: 'editing' | 'generating' | 'ready';
    createdAt: number;
    updatedAt?: number;
    pages: DraftPage[];
    originalLanguage?: string; // Language the book was written in
}
