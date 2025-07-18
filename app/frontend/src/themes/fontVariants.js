// Font variants for testing different typography while preserving Cutty's special fonts
export const fontVariants = {
  comicSans: {
    name: 'Comic Sans MS',
    fontFamily: '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
    webFont: null, // System font
  },
  
  imFell: {
    name: 'IM Fell Double Pica',
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
  
  pressStart: {
    name: 'Press Start (Retro)',
    fontFamily: '"Press Start 2P", monospace',
    webFont: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
  },
  
  sfPro: {
    name: 'SF Pro (Apple)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
    webFont: null, // System font on Apple devices
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
  if (fontName === 'pressStart') {
    // Press Start is a pixel font, needs adjustment for readability
    root.style.setProperty('--font-scale', '0.75');
    root.style.fontSize = '14px';
    root.style.lineHeight = '2';
    // Adjust specific elements
    document.querySelectorAll('button, .MuiButton-root').forEach(el => {
      el.style.fontSize = '0.75rem';
    });
    document.querySelectorAll('.MuiTypography-body1').forEach(el => {
      el.style.fontSize = '0.8rem';
    });
    document.querySelectorAll('.MuiTypography-body2').forEach(el => {
      el.style.fontSize = '0.7rem';
    });
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
      el.style.fontSize = '1rem';
    });
  } else {
    // Reset to default sizes
    root.style.setProperty('--font-scale', '1');
    root.style.fontSize = '18px';
    root.style.lineHeight = '1.6';
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
  return localStorage.getItem('cutty-font') || 'sfPro';
};

// Initialize font system
export const initializeFonts = () => {
  const currentFont = getCurrentFont();
  applyFont(currentFont);
};