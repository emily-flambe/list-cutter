// Theme variants for testing different designs while preserving Cutty's personality
export const themeVariants = {
  // Current dark theme
  oceanic: {
    name: 'Oceanic Deep',
    colors: {
      '--primary-bg': '#262c43',
      '--navbar-bg': '#1c2031', 
      '--secondary-bg': '#576587',
      '--primary-text': '#e3f0f7',
      '--accent': '#7795ee',
      '--action': '#00ccf0',
      '--secondary': '#5894ff',
      '--dark-accent': '#1058a4',
      '--secondary-text': '#333333',
    }
  },

  // Warmer, more playful theme
  cuttleInk: {
    name: 'Cuttle Ink',
    colors: {
      '--primary-bg': '#2d1b3d',
      '--navbar-bg': '#1a0f26',
      '--secondary-bg': '#4a2c5a',
      '--primary-text': '#f0e6ff',
      '--accent': '#ff6b9d',
      '--action': '#c44569',
      '--secondary': '#f8b500',
      '--dark-accent': '#6c5ce7',
      '--secondary-text': '#2d3436',
    }
  },

  // High contrast, terminal-like
  terminalGreen: {
    name: 'Terminal Depths',
    colors: {
      '--primary-bg': '#0d1117',
      '--navbar-bg': '#010409',
      '--secondary-bg': '#21262d',
      '--primary-text': '#00ff41',
      '--accent': '#39ff14',
      '--action': '#00ccff',
      '--secondary': '#ffff00',
      '--dark-accent': '#008f11',
      '--secondary-text': '#c9d1d9',
    }
  },

  // Retro synthwave
  synthwave: {
    name: 'Neon Tentacles',
    colors: {
      '--primary-bg': '#0f0f23',
      '--navbar-bg': '#050510',
      '--secondary-bg': '#1a1a3a',
      '--primary-text': '#ff00ff',
      '--accent': '#00ffff',
      '--action': '#ff0080',
      '--secondary': '#8000ff',
      '--dark-accent': '#4000ff',
      '--secondary-text': '#ffffff',
    }
  },

  // Minimalist light theme (for contrast testing)
  lightMinimal: {
    name: 'Surface Light',
    colors: {
      '--primary-bg': '#fafafa',
      '--navbar-bg': '#ffffff',
      '--secondary-bg': '#f5f5f5',
      '--primary-text': '#2c3e50',
      '--accent': '#3498db',
      '--action': '#e74c3c',
      '--secondary': '#9b59b6',
      '--dark-accent': '#2980b9',
      '--secondary-text': '#7f8c8d',
    }
  }
};

export const applyTheme = (themeName) => {
  const theme = themeVariants[themeName];
  if (!theme) return;

  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  
  // Store the current theme in localStorage
  localStorage.setItem('cutty-theme', themeName);
};

export const getCurrentTheme = () => {
  return localStorage.getItem('cutty-theme') || 'oceanic';
};