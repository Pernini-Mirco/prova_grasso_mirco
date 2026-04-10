import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx';
import './styles.css';

function hasGoogleClientId(value) {
  return Boolean(value);
}

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

async function bootstrap() {
  let googleClientId = hasGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID)
    ? import.meta.env.VITE_GOOGLE_CLIENT_ID
    : '';

  if (!googleClientId) {
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiBase}/api/config`);
      if (response.ok) {
        const config = await response.json();
        if (hasGoogleClientId(config.googleClientId)) {
          googleClientId = config.googleClientId;
        }
      }
    } catch {
      googleClientId = '';
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        {app}
      </GoogleOAuthProvider>
    ) : (
      app
    )
  );
}

bootstrap();
