
/**
 * Detects if the text contains Korean characters.
 * Useful for overriding default 'English' metadata when the content is actually Korean.
 */
export const detectLanguage = (text: string): 'Korean' | 'English' | null => {
    if (!text) return null;
    // Check for Hangul Syllables, Jamo, Compatibility Jamo
    const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;
    return koreanRegex.test(text) ? 'Korean' : 'English';
};

/**
 * Cleans up translated text by removing common AI prefixes and artifacts.
 * e.g., "**Translation:** Hello" -> "Hello"
 */
export const cleanTranslatedText = (text: string): string => {
    if (!text) return '';
    let cleaned = text;

    // 1. Handle "Original -> Translated" arrow artifacts first
    if (cleaned.includes('-->')) {
        const split = cleaned.split('-->');
        cleaned = split[split.length - 1].trim();
    } else if (cleaned.includes('->')) {
        const parts = cleaned.split('->');
        if (parts.length > 1) {
            const lastPart = parts[parts.length - 1].trim();
            // Heuristic: if the last part is reasonable length, assume it's the result
            if (lastPart.length > 0) cleaned = lastPart;
        }
    }

    // 2. Handle explicit labels like "**Translation:**"
    // These might appear at the start OR in the middle (e.g. "Original\n**Translation:** Translated")
    const splitRegexes = [
        /\*\*Translation:\*\*/i,
        /Translation:/i,
        /\*\*Translated:\*\*/i,
        /Translated:/i,
    ];

    for (const regex of splitRegexes) {
        if (regex.test(cleaned)) {
            const parts = cleaned.split(regex);
            // Always take the last part, assuming the translation follows the label
            if (parts.length > 1) {
                cleaned = parts[parts.length - 1].trim();
            }
        }
    }

    // 3. Remove any lingering bracket tags like [English], [Korean] at the START of the result
    cleaned = cleaned.replace(/^[\s\n]*\[.*?\][\s\n]*/, '');

    return cleaned.trim();
};
