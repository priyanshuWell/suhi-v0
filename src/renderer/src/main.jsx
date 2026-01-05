import './assets/main.css'
import { BrowserRouter } from 'react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
   <BrowserRouter>
   <App/>
   </BrowserRouter>
  </StrictMode>
)
