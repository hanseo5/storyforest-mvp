import type { Book, Page } from '../types';

export const MOCK_BOOKS: (Book & { pages: Page[] })[] = [
    {
        id: 'mock-1',
        title: 'The Brave Little Toaster',
        authorId: 'mock-author',
        coverUrl: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800',
        createdAt: Date.now(),
        description: 'A toaster brave enough to go to Mars.',
        style: 'Cartoon',
        pages: [
            { pageNumber: 1, text: "Once upon a time, there was a little toaster.", imageUrl: "https://images.unsplash.com/photo-1621253460670-202283a00508?auto=format&fit=crop&q=80&w=1920" },
            { pageNumber: 2, text: "He wanted to see the red planet.", imageUrl: "https://images.unsplash.com/photo-1614728853911-ec75394da875?auto=format&fit=crop&q=80&w=1920" },
            { pageNumber: 3, text: "So he built a rocket out of breadcrumbs.", imageUrl: "https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&q=80&w=1920" },
            { pageNumber: 4, text: "And blasted off into the starry night!", imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1920" }
        ]
    },
    {
        id: 'mock-2',
        title: 'The Whispering Forest',
        authorId: 'mock-author',
        coverUrl: 'https://images.unsplash.com/photo-1448375240586-dfd8d395ea6c?auto=format&fit=crop&q=80&w=800',
        createdAt: Date.now() - 100000,
        description: 'Trees that talk when no one is listening.',
        style: 'Watercolor',
        pages: [
            { pageNumber: 1, text: "The forest was silent, or so it seemed.", imageUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=1920" },
            { pageNumber: 2, text: "But if you listened closely...", imageUrl: "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=1920" },
            { pageNumber: 3, text: "You could hear the leaves gossiping.", imageUrl: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=1920" }
        ]
    },
    {
        id: 'mock-3',
        title: 'Captain Cat',
        authorId: 'mock-author',
        coverUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=800',
        createdAt: Date.now() - 200000,
        description: 'He rules the seven seas... of milk.',
        style: 'Anime',
        pages: [
            { pageNumber: 1, text: "Ahoy matey! Pour me some milk.", imageUrl: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&q=80&w=1920" }
        ]
    }
];

export const getMockBooks = async (): Promise<Book[]> => {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_BOOKS;
};

export const getMockBookById = async (id: string): Promise<(Book & { pages: Page[] }) | undefined> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return MOCK_BOOKS.find(b => b.id === id);
}
