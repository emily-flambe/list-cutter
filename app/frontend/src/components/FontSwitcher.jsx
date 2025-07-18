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
import { TextFields as TextFieldsIcon } from '@mui/icons-material';
import { fontVariants, applyFont, getCurrentFont } from '../themes/fontVariants';

const FontSwitcher = ({ compact = false }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentFont, setCurrentFont] = useState(getCurrentFont());
  const open = Boolean(anchorEl);

  useEffect(() => {
    // Apply the saved font on component mount
    applyFont(currentFont);
  }, []);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleFontChange = (fontName) => {
    applyFont(fontName);
    setCurrentFont(fontName);
    handleClose();
  };

  if (compact) {
    return (
      <>
        <Tooltip title="Switch Font">
          <IconButton
            onClick={handleClick}
            sx={{ color: 'var(--primary-text)' }}
          >
            <TextFieldsIcon />
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
              maxHeight: '400px',
            },
          }}
        >
          {Object.entries(fontVariants).map(([key, font]) => (
            <MenuItem
              key={key}
              onClick={() => handleFontChange(key)}
              selected={currentFont === key}
              sx={{
                fontFamily: font.fontFamily,
                '&.Mui-selected': {
                  backgroundColor: 'var(--accent)',
                  '&:hover': {
                    backgroundColor: 'var(--dark-accent)',
                  },
                },
              }}
            >
              {font.name}
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
          fontFamily: fontVariants[currentFont]?.fontFamily,
          '&:hover': {
            borderColor: 'var(--accent)',
            backgroundColor: 'rgba(255,255,255,0.05)',
          },
        }}
      >
        {fontVariants[currentFont]?.name || 'Unknown'}
        <TextFieldsIcon fontSize="small" sx={{ ml: 1, opacity: 0.7 }} />
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: 'var(--secondary-bg)',
            color: 'var(--primary-text)',
            maxHeight: '400px',
          },
        }}
      >
        {Object.entries(fontVariants).map(([key, font]) => (
          <MenuItem
            key={key}
            onClick={() => handleFontChange(key)}
            selected={currentFont === key}
            sx={{
              fontFamily: font.fontFamily,
              '&.Mui-selected': {
                backgroundColor: 'var(--accent)',
                '&:hover': {
                  backgroundColor: 'var(--dark-accent)',
                },
              },
            }}
          >
            <Box>
              <Typography variant="body1" sx={{ fontFamily: font.fontFamily }}>
                {font.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, fontFamily: 'Inter, sans-serif' }}>
                {key === 'wingdings' ? 'Sample: ✈ ☎ ♠ ♥' : 'Sample: The quick brown fox'}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default FontSwitcher;