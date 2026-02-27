/**
 * BGM presets for storybooks.
 * Each entry maps to an MP3 file in /bgm/{id}.mp3 (or a Web Audio synth fallback).
 */
export interface BgmPreset {
    id: string;
    emoji: string;
    color: string;        // Tailwind gradient classes
    hasFile: boolean;      // true = uses /bgm/{id}.mp3, false = Web Audio synth
}

export const BGM_PRESETS: BgmPreset[] = [
    { id: 'forest',     emoji: '🌿', color: 'from-green-300 to-emerald-300', hasFile: true  },   // 숲속
    { id: 'magic',      emoji: '🏰', color: 'from-violet-300 to-pink-300',   hasFile: true  },   // 마법
    { id: 'fun',        emoji: '😄', color: 'from-yellow-300 to-orange-300', hasFile: true  },   // 신나는
    { id: 'lullaby',    emoji: '🌙', color: 'from-indigo-300 to-blue-300',   hasFile: true  },   // 자장가
    { id: 'none',       emoji: '🔇', color: 'from-gray-200 to-gray-300',     hasFile: false },   // 없음
];

export const DEFAULT_BGM_ID = 'forest';

/**
 * Get the MP3 file path for a BGM preset.
 * Returns null if the preset uses synthesized audio or is 'none'.
 */
export const getBgmFilePath = (bgmId: string): string | null => {
    const preset = BGM_PRESETS.find(p => p.id === bgmId);
    if (!preset || !preset.hasFile || bgmId === 'none') return null;
    return `/bgm/${bgmId}.mp3`;
};
