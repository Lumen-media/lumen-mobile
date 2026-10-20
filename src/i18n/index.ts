import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en";
import es from "./locales/es";
import pt from "./locales/pt";

/**
 * i18n for the remote app. Starts with the three locales shipped by the
 * desktop (en/pt/es); resource bundles can later be swapped for
 * `lumen-locales` OTA downloads without touching call sites.
 */

function pickLanguage(): string {
  const tag = getLocales()[0]?.languageCode ?? "en";
  if (tag === "pt" || tag === "es") return tag;
  return "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
    es: { translation: es },
  },
  lng: pickLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
