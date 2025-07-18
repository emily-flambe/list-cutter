import React from 'react';
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWithLayouts from './AppWithLayouts.jsx'
import { applyTheme, getCurrentTheme } from './themes/themeVariants';
import { initializeFonts } from './themes/fontVariants';

// Initialize theme and fonts before rendering
applyTheme(getCurrentTheme());
initializeFonts();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWithLayouts />
  </React.StrictMode>,
)
