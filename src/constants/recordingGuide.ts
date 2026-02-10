export const SAMPLE_TEXTS = {
    quick: `Once upon a time, in a deep forest, lived a curious squirrel. One day, the squirrel found a sparkling acorn and decided to go on an adventure to find the dream that shines like the stars in the sky.`,

    quality: `[Paragraph 1 - Calmly]
Once upon a time, in a deep forest, lived a curious squirrel. The squirrel's name was 'Acorn'. Every morning when the sunlight shone, Acorn would wake up on a big oak tree and look around.

[Paragraph 2 - Like a conversation]
"Mom, can I go on an adventure today?" Acorn asked.
"Sure, have a safe trip. But make sure to come back before the sun sets!" The mother squirrel replied warmly.

[Paragraph 3 - Excitedly]
Acorn skipped around excitedly! The sunlight sparkled between the leaves, and the birds sang happily. "Wow! The world is so big and beautiful!"

[Paragraph 4 - Warmly]
After a long adventure, Acorn returned home. The mother squirrel hugged him warmly. "Our dear Acorn, you did such a great job today." That night, Acorn had sweet dreams under the starlight. The end.`
};

export const getRecommendedTime = (mode: 'quick' | 'quality'): { min: number; max: number; recommended: number } => {
    if (mode === 'quick') {
        return { min: 20, max: 60, recommended: 30 };
    }
    return { min: 120, max: 300, recommended: 180 };
};
