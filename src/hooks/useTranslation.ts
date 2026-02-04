import { useStore } from '../store';
import { UI_TRANSLATIONS } from '../constants/translations';

export const useTranslation = () => {
    const { targetLanguage } = useStore();

    const t = (key: string, variables?: Record<string, string>) => {
        const lang = targetLanguage || 'English';
        const translations = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS['English'];
        let text = translations[key] || UI_TRANSLATIONS['English'][key] || key;

        if (variables) {
            Object.entries(variables).forEach(([k, v]) => {
                text = text.replace(`{${k}}`, v);
            });
        }

        return text;
    };

    return { t, targetLanguage };
};
