// Font variants for testing different typography while preserving Cutty's special fonts
export const fontVariants = {
  senorSaturno: {
    name: 'Mr. Saturn',
    fontFamily: '"SenorSaturno", monospace',
    webFont: null, // Local font file
    isPixelFont: true,
  },
  
  undertale: {
    name: 'Undertale',
    fontFamily: '"Undertale", monospace',
    webFont: null, // Local font file
    isPixelFont: true,
  },
  
  comicSans: {
    name: 'Comic Sans lmao',
    fontFamily: '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
    webFont: null, // System font
  },
  
  imFell: {
    name: 'Expedition 33',
    fontFamily: '"IM Fell Double Pica", serif',
    webFont: 'https://fonts.googleapis.com/css2?family=IM+Fell+Double+Pica:ital@0;1&display=swap',
  },
  
  monospace: {
    name: 'Monospace',
    fontFamily: 'ui-monospace, "Cascadia Mono", "Segoe UI Mono", "Courier New", monospace',
    webFont: null, // System monospace
  },
  
  papyrus: {
    name: 'Papyrus',
    fontFamily: 'Papyrus, "Bradley Hand", fantasy',
    webFont: null, // System font
  },
  
  silkscreen: {
    name: 'Silkscreen',
    fontFamily: '"Silkscreen", monospace',
    webFont: 'https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap',
  },
  
  inter: {
    name: 'Inter (FOR NORMIES)',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    webFont: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    isPixelFont: false,
  },
  
  wingdings: {
    name: 'Wingdings (⚡🎯✈️)',
    fontFamily: 'Wingdings, "Zapf Dingbats", fantasy',
    webFont: null, // System font
  },
};

// Load web fonts dynamically
const loadWebFont = (fontUrl) => {
  if (!fontUrl) return;
  
  // Check if font is already loaded
  const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
  if (existingLink) return;
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontUrl;
  document.head.appendChild(link);
};

export const applyFont = (fontName) => {
  const font = fontVariants[fontName];
  if (!font) return;

  // Load web font if needed
  if (font.webFont) {
    loadWebFont(font.webFont);
  }

  // Apply font to CSS custom property
  const root = document.documentElement;
  root.style.setProperty('--main-font-family', font.fontFamily);
  
  // Apply font-specific size adjustments
  if (fontName === 'senorSaturno') {
    // Senor Saturno - adjusted to smaller size
    root.style.setProperty('--font-scale', '1.2');
    root.style.fontSize = '16px';
    root.style.lineHeight = '1.4';
    root.style.letterSpacing = '0.3px';
  } else if (fontName === 'undertale') {
    // Undertale (PixelOperator) font adjustments
    root.style.setProperty('--font-scale', '1.8');
    root.style.fontSize = '20px';
    root.style.lineHeight = '1.5';
    root.style.letterSpacing = '0.3px';
  } else if (fontName === 'silkscreen') {
    // Silkscreen needs slight adjustments
    root.style.setProperty('--font-scale', '0.9');
    root.style.fontSize = '16px';
    root.style.lineHeight = '1.8';
  } else {
    // Reset to default sizes
    root.style.setProperty('--font-scale', '1');
    root.style.fontSize = '';  // Use default from CSS
    root.style.lineHeight = '';
    root.style.letterSpacing = '';
    root.style.webkitFontSmoothing = '';
    // Reset specific elements
    document.querySelectorAll('button, .MuiButton-root').forEach(el => {
      el.style.fontSize = '';
    });
    document.querySelectorAll('.MuiTypography-body1').forEach(el => {
      el.style.fontSize = '';
    });
    document.querySelectorAll('.MuiTypography-body2').forEach(el => {
      el.style.fontSize = '';
    });
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
      el.style.fontSize = '';
    });
  }
  
  // Store the current font in localStorage
  localStorage.setItem('cutty-font', fontName);
};

export const getCurrentFont = () => {
  return localStorage.getItem('cutty-font') || 'inter';
};

// Initialize font system
export const initializeFonts = () => {
  const currentFont = getCurrentFont();
  applyFont(currentFont);
};