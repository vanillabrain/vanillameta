import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 번역 파일 import
import koCommon from '../locales/ko/common.json';
import enCommon from '../locales/en/common.json';
import koAuth from '../locales/ko/auth.json';
import enAuth from '../locales/en/auth.json';
import koDashboard from '../locales/ko/dashboard.json';
import enDashboard from '../locales/en/dashboard.json';
import koDatabase from '../locales/ko/database.json';
import enDatabase from '../locales/en/database.json';
import koWidget from '../locales/ko/widget.json';
import enWidget from '../locales/en/widget.json';

const resources = {
  ko: {
    common: koCommon,
    auth: koAuth,
    dashboard: koDashboard,
    database: koDatabase,
    widget: koWidget,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    database: enDatabase,
    widget: enWidget,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ko',
    defaultNS: 'common',
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['localStorage', 'cookie', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
    },
  });

export default i18n;
