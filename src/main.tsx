import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'
import './index.css'
import App from './App.tsx'

// Initialize Capacitor Google Auth plugin on native platforms
if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize({
    clientId: '580984401842-anh7p8iiiv1fd8bms0q6t1tmptbaq7kd.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: true,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
