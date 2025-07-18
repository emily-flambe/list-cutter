import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Typography,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Palette as PaletteIcon } from '@mui/icons-material';
import { themeVariants, applyTheme, getCurrentTheme } from '../themes/themeVariants';

const ThemeSwitcher = ({ compact = false }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());
  const open = Boolean(anchorEl);

  useEffect(() => {
    // Apply the saved theme on component mount
    applyTheme(currentTheme);
  }, [currentTheme]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleThemeChange = (themeName) => {
    applyTheme(themeName);
    setCurrentTheme(themeName);
    handleClose();
  };

  if (compact) {
    return (
      <>
        <Tooltip title="Switch Theme">
          <IconButton
            onClick={handleClick}
            sx={{ color: 'var(--primary-text)' }}
          >
            <PaletteIcon />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          sx={{
            '& .MuiPaper-root': {
              backgroundColor: 'var(--secondary-bg)',
              color: 'var(--primary-text)',
            },
          }}
        >
          {Object.entries(themeVariants).map(([key, theme]) => (
            <MenuItem
              key={key}
              onClick={() => handleThemeChange(key)}
              selected={currentTheme === key}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'var(--accent)',
                  '&:hover': {
                    backgroundColor: 'var(--dark-accent)',
                  },
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: key === 'pride' 
                      ? 'linear-gradient(135deg, #ff0000, #ff8c00, #ffff00, #00ff00, #0080ff, #8b00ff)'
                      : key === 'dark'
                      ? '#1a2332'  // Dark theme's primary bg
                      : key === 'light'
                      ? '#d6dce4'  // Light theme's primary bg
                      : theme.colors['--accent'],
                    border: '1px solid',
                    borderColor: theme.colors['--primary-text'],
                  }}
                />
                {theme.name}
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Button
        fullWidth
        variant="outlined"
        onClick={handleClick}
        sx={{
          justifyContent: 'space-between',
          textTransform: 'none',
          borderColor: 'rgba(255,255,255,0.2)',
          color: 'var(--primary-text)',
          py: 0.75,
          px: 1.5,
          fontSize: '0.875rem',
          '&:hover': {
            borderColor: 'var(--accent)',
            backgroundColor: 'rgba(255,255,255,0.05)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: currentTheme === 'pride' 
                ? 'linear-gradient(135deg, #ff0000, #ff8c00, #ffff00, #00ff00, #0080ff, #8b00ff)'
                : currentTheme === 'dark'
                ? '#1a2332'  // Dark theme's primary bg
                : currentTheme === 'light'
                ? '#d6dce4'  // Light theme's primary bg
                : themeVariants[currentTheme]?.colors['--accent'],
              border: '1px solid',
              borderColor: 'var(--primary-text)',
              flexShrink: 0,
            }}
          />
          <span style={{ flexGrow: 1, textAlign: 'left' }}>
            {themeVariants[currentTheme]?.name || 'Unknown'}
          </span>
          <PaletteIcon fontSize="small" sx={{ opacity: 0.7 }} />
        </Box>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: 'var(--secondary-bg)',
            color: 'var(--primary-text)',
          },
        }}
      >
        {Object.entries(themeVariants).map(([key, theme]) => (
          <MenuItem
            key={key}
            onClick={() => handleThemeChange(key)}
            selected={currentTheme === key}
            sx={{
              '&.Mui-selected': {
                backgroundColor: 'var(--accent)',
                '&:hover': {
                  backgroundColor: 'var(--dark-accent)',
                },
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: key === 'pride' 
                    ? 'linear-gradient(135deg, #ff0000, #ff8c00, #ffff00, #00ff00, #0080ff, #8b00ff)'
                    : key === 'dark'
                    ? '#1a2332'  // Dark theme's primary bg
                    : key === 'light'
                    ? '#d6dce4'  // Light theme's primary bg
                    : theme.colors['--accent'],
                  border: '2px solid',
                  borderColor: theme.colors['--primary-text'],
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
              <Typography variant="body1">{theme.name}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default ThemeSwitcher;