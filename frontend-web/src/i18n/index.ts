import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ko from './locales/ko';
import en from './locales/en';
import koCommon from '@/locales/ko/common.json';
import koAuth from '@/locales/ko/auth.json';
import koDashboard from '@/locales/ko/dashboard.json';
import koDatabase from '@/locales/ko/database.json';
import koWidget from '@/locales/ko/widget.json';
import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enDashboard from '@/locales/en/dashboard.json';
import enDatabase from '@/locales/en/database.json';
import enWidget from '@/locales/en/widget.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: {
        translation: ko,
        common: koCommon,
        auth: koAuth,
        dashboard: koDashboard,
        database: koDatabase,
        widget: koWidget,
      },
      en: {
        translation: en,
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        database: enDatabase,
        widget: enWidget,
      },
    },
    defaultNS: 'translation',
    fallbackLng: 'ko',
    supportedLngs: ['ko', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
