import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';

/**
 * English is the only locale bundled in the app. Translations live in the
 * centralized lumen-locales repo and are expected to be pulled in at build
 * time (CI). Language detection stays wired so injected locales light up
 * automatically.
 */

function pickLanguage(): string {
  const tag = getLocales()[0]?.languageCode ?? 'en';
  if (tag === 'pt' || tag === 'es') return tag;
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: pickLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
