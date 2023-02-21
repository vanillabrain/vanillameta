import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import theme from './theme/theme';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { LayoutProvider } from '@/contexts/LayoutContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';

const rootElement = document.getElementById('root');
const app = (
  <HelmetProvider>
    <LayoutProvider>
      <LoadingProvider>
        <BrowserRouter>
          <AuthProvider>
            <ThemeProvider theme={theme}>
              <AlertProvider>
                <App />
              </AlertProvider>
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </LoadingProvider>
    </LayoutProvider>
  </HelmetProvider>
);

if (rootElement.hasChildNodes()) {
  ReactDOM.hydrateRoot(rootElement, app); // react pre-rendering
} else {
  ReactDOM.createRoot(rootElement).render(app);
}
