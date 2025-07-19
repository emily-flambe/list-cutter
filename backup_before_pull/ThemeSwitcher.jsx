import { useState } from 'react';
import { 
  Box, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  Card,
  CardContent,
  Typography,
  Button
} from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';

const ThemeSwitcher = ({ currentTheme, onThemeChange }) => {
  const [open, setOpen] = useState(false);

  const themes = [
    { 
      id: 'original', 
      name: 'Original Dark', 
      description: 'The classic dark blue theme',
      colors: ['#262c43', '#1c2031', '#7795ee', '#00ccf0']
    },
    { 
      id: 'modernLight', 
      name: 'Modern Light', 
      description: 'Clean and professional light theme',
      colors: ['#f8fafc', '#ffffff', '#2563eb', '#7c3aed']
    },
    { 
      id: 'cyberpunk', 
      name: 'Cyberpunk', 
      description: 'Futuristic neon green and pink',
      colors: ['#0a0a0a', '#1a1a1a', '#00ff9f', '#ff0080']
    },
    { 
      id: 'ocean', 
      name: 'Ocean', 
      description: 'Calming blues and teals',
      colors: ['#0f172a', '#1e293b', '#0891b2', '#06b6d4']
    },
    { 
      id: 'sunset', 
      name: 'Sunset', 
      description: 'Warm oranges and pinks',
      colors: ['#1f1b24', '#2d1b3d', '#f97316', '#ec4899']
    }
  ];

  const handleThemeSelect = (themeId) => {
    onThemeChange(themeId);
    setOpen(false);
  };

  return (
    <>
      <Fab
        color="primary"
        aria-label="change theme"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
      >
        <PaletteIcon />
      </Fab>

      <Dialog 
        open={open} 
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Choose Your Theme</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {themes.map((theme) => (
              <Grid item xs={12} sm={6} md={4} key={theme.id}>
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    border: currentTheme === theme.id ? '2px solid' : '1px solid transparent',
                    borderColor: currentTheme === theme.id ? 'primary.main' : 'transparent',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    },
                    transition: 'all 0.3s ease',
                  }}
                  onClick={() => handleThemeSelect(theme.id)}
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {theme.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {theme.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      {theme.colors.map((color, index) => (
                        <Box
                          key={index}
                          sx={{
                            width: 24,
                            height: 24,
                            backgroundColor: color,
                            borderRadius: '50%',
                            border: '1px solid rgba(0,0,0,0.1)',
                          }}
                        />
                      ))}
                    </Box>
                    <Button 
                      variant={currentTheme === theme.id ? "contained" : "outlined"}
                      size="small"
                      fullWidth
                    >
                      {currentTheme === theme.id ? 'Current' : 'Select'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ThemeSwitcher;