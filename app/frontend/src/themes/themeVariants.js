// Theme variants based on Cutty's logo colors - Light and Dark modes
export const themeVariants = {
  // Dark mode - inspired by Cutty's deep ocean colors
  dark: {
    name: 'Dark',
    colors: {
      '--primary-bg': '#1a2332',        // Deep ocean blue
      '--navbar-bg': '#0f1419',        // Darker blue-black
      '--secondary-bg': '#2d3748',     // Medium blue-gray
      '--primary-text': '#e2e8f0',     // Light blue-white
      '--accent': '#4299e1',           // Cutty blue (from logo)
      '--action': '#38b2ac',           // Teal accent
      '--secondary': '#63b3ed',        // Lighter blue
      '--dark-accent': '#2b6cb0',      // Darker blue
      '--secondary-text': '#4a5568',   // Muted text
    }
  },

  // Light mode - comfortable and easy on the eyes
  light: {
    name: 'Light',
    colors: {
      '--primary-bg': '#d6dce4',       // Muted gray-blue background (much less bright)
      '--navbar-bg': '#c4cdd9',        // Darker gray-blue sidebar
      '--secondary-bg': '#a8b4c5',     // Even darker blue-gray for cards/sections
      '--primary-text': '#0a0c0f',     // Near-black text for maximum contrast
      '--accent': '#1e40af',           // Deep blue accent (less bright)
      '--action': '#1e3a8a',           // Darker blue for actions
      '--secondary': '#2563eb',        // Medium blue (toned down)
      '--dark-accent': '#172e5c',      // Very dark blue for hover states
      '--secondary-text': '#1f2937',   // Very dark gray for secondary text
    }
  },

  // Pink mode - vibrant and fun
  pink: {
    name: 'Pink',
    colors: {
      '--primary-bg': '#fce4ec',       // Soft pink background
      '--navbar-bg': '#f8bbd0',        // Light pink sidebar
      '--secondary-bg': '#f48fb1',     // Medium pink for cards/sections
      '--primary-text': '#880e4f',     // Deep burgundy text for readability
      '--accent': '#e91e63',           // Hot pink accent
      '--action': '#c2185b',           // Deep pink for actions
      '--secondary': '#f06292',        // Medium pink
      '--dark-accent': '#ad1457',      // Dark pink for hover states
      '--secondary-text': '#6a1b47',   // Dark pink-purple for secondary text
    }
  }
};

export const applyTheme = (themeName) => {
  const theme = themeVariants[themeName];
  if (!theme) return;

  const root = document.documentElement;
  
  // Remove any existing theme classes
  Object.keys(themeVariants).forEach(key => {
    root.classList.remove(`${key}-mode`);
  });
  
  // Add the new theme class
  root.classList.add(`${themeName}-mode`);
  
  // Apply CSS variables
  Object.entries(theme.colors).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
  
  
  // Store the current theme in localStorage
  localStorage.setItem('cutty-theme', themeName);
};

export const getCurrentTheme = () => {
  return localStorage.getItem('cutty-theme') || 'dark';
};