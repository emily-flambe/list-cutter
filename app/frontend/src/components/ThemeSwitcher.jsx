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
              {theme.name}
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
        {themeVariants[currentTheme]?.name || 'Unknown'}
        <PaletteIcon fontSize="small" sx={{ ml: 1, opacity: 0.7 }} />
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
            <Box>
              <Typography variant="body1">{theme.name}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {key}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default ThemeSwitcher;