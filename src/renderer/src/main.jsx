import './assets/main.css'
import { BrowserRouter, HashRouter } from 'react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './config/i18n/i18n';
import { BackgroundCameraProvider } from './services/BackgroundCameraProvider'
import { Provider } from 'react-redux'
import { store } from '../../store/store'
import { initCameraTracker } from './utils/cameraTracker'
import KioskScaler from './components/KioskScaler'

// Initialize global camera tracking
initCameraTracker();

createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <Provider store={store}>
    <HashRouter>
      {/* <KioskScaler> */}
      <App />
      {/* </KioskScaler> */}
    </HashRouter>
  </Provider>
  //  </StrictMode> 
)
