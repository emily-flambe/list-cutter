import { createTheme } from '@mui/material/styles';

// Function to get CSS variable values
const getCssVariable = (variable) => {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
};

// Create a dynamic theme that reads CSS variables
export const createDynamicTheme = () => {
  return createTheme({
    palette: {
      primary: {
        main: getCssVariable('--secondary') || '#5894ff',
      },
      secondary: {
        main: getCssVariable('--accent') || '#7795ee',
      },
      background: {
        default: getCssVariable('--primary-bg') || '#262c43',
        paper: getCssVariable('--secondary-bg') || '#576587',
      },
      text: {
        primary: getCssVariable('--primary-text') || '#e3f0f7',
        secondary: getCssVariable('--secondary') || '#5894ff',
      },
    },
    typography: {
      fontFamily: getCssVariable('--main-font-family') || 'Inter, system-ui, sans-serif',
      fontSize: 16,
      // Apply the font family to all typography variants
      h1: { fontFamily: 'inherit' },
      h2: { fontFamily: 'inherit' },
      h3: { fontFamily: 'inherit' },
      h4: { fontFamily: 'inherit' },
      h5: { fontFamily: 'inherit' },
      h6: { fontFamily: 'inherit' },
      subtitle1: { fontFamily: 'inherit', fontSize: '1.125rem' },
      subtitle2: { fontFamily: 'inherit', fontSize: '1rem' },
      body1: { fontFamily: 'inherit', fontSize: '1.125rem' },
      body2: { fontFamily: 'inherit', fontSize: '1rem' },
      button: { fontFamily: 'inherit', fontSize: '1rem' },
      caption: { fontFamily: 'inherit', fontSize: '0.875rem' },
      overline: { fontFamily: 'inherit', fontSize: '0.875rem' },
    },
    components: {
      // Override MUI components to ensure they use the CSS variable
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFamily: 'var(--main-font-family)',
          },
          '*': {
            fontFamily: 'inherit',
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            fontFamily: 'inherit',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            fontFamily: 'inherit',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: 'inherit',
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: {
            fontFamily: 'inherit',
          },
          secondary: {
            fontFamily: 'inherit',
          },
        },
      },
      // Simple fix for table border inconsistencies
      MuiTable: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-root': {
              borderBottom: 'none',
            }
          }
        }
      },
    },
  });
};