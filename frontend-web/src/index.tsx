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
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
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
  </LayoutProvider>,
);
