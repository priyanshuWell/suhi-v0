import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import hi from './locales/hi.json'
import gu from './locales/gu.json'
import mr from './locales/mr.json'
import bn from './locales/bn.json'
import ar from './locales/ar.json'
import { clearAudioCache } from '../../utils/audioUtils'

i18n
  .use(initReactI18next)
  .init({
    lng: 'en',
    debug: true,
    fallbackLng: 'en',
    returnObjects: true,
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      gu: { translation: gu },
      mr: { translation: mr },
      bn: { translation: bn },
      ar: { translation: ar }
    }
  })

// Clear the audio URL cache whenever the user switches language,
// so the new language's files are resolved fresh.
i18n.on('languageChanged', () => {
  clearAudioCache()
})

  export default  i18n;