import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import hi from './locales/hi.json'
i18n
  .use(initReactI18next)
  .init({
    lng: 'en',
    debug: true,
    fallbackLng: 'en',
    returnObjects: true,
    resources: {
      en: {
        translation: en
      },
      hi: {
        translation: hi
      }
    }
  })

  export default  i18n;