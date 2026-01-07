import './assets/main.css'
import { BrowserRouter } from 'react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './config/i18n/i18n';
createRoot(document.getElementById('root')).render(
  <StrictMode>
   <BrowserRouter>
   <App/>
   </BrowserRouter>
  </StrictMode>
)
