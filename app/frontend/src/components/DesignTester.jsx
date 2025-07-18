import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Divider,
  Alert,
  AlertTitle,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  ViewQuilt as ViewQuiltIcon,
  Psychology as PsychologyIcon,
  Visibility as VisibilityIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import ThemeSwitcher from './ThemeSwitcher';
import FontSwitcher from './FontSwitcher';
import { themeVariants } from '../themes/themeVariants';
import { fontVariants } from '../themes/fontVariants';

const DesignTester = () => {
  const [showCuttyPersonality, setShowCuttyPersonality] = useState(true);

  const designFeatures = [
    {
      title: 'Theme Variants',
      icon: <PaletteIcon />,
      description: 'Test different color schemes while preserving Cutty\'s personality',
      features: Object.entries(themeVariants).map(([key, theme]) => theme.name),
    },
    {
      title: 'Cutty\'s Personality',
      icon: <PsychologyIcon />,
      description: 'Consistent across all designs - friendly, ALL-CAPS, threatening logout',
      features: ['Context-aware messages', 'Blinking cursor', 'Threatening logout warning', 'Friendly cuttlefish character'],
    },
  ];

  const testingTips = [
    'Navigate between different pages to see how Cutty\'s messages change',
    'Try the logout page to see Cutty\'s threatening side',
    'Test on mobile devices to see responsive behavior',
    'Switch themes to see how colors affect readability',
    'Check that the blinking cursor works on the home page',
  ];

  return (
    <Box sx={{ 
      bgcolor: 'var(--secondary-bg)',
      padding: 4,
      borderRadius: 2,
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    }}>
      <Typography variant="h4" sx={{ color: 'var(--primary-text)', mb: 3, textAlign: 'center' }}>
        🎨 CUTTY DESIGN LABORATORY
      </Typography>

      <Alert severity="info" sx={{ mb: 4, bgcolor: 'var(--accent)', color: 'var(--primary-text)' }}>
        <AlertTitle>Welcome to the Design Testing Environment!</AlertTitle>
        This is where you can experiment with different frontend designs while keeping Cutty's personality intact.
        All changes are saved locally and persist across sessions.
      </Alert>

      <Grid container spacing={3}>
        {/* Design Controls */}
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'var(--navbar-bg)', color: 'var(--primary-text)', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon /> Design Controls
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Theme Switcher</Typography>
                <ThemeSwitcher />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Font Switcher</Typography>
                <FontSwitcher />
              </Box>



              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={showCuttyPersonality}
                    onChange={(e) => setShowCuttyPersonality(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: 'var(--accent)',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: 'var(--accent)',
                      },
                    }}
                  />
                }
                label="Show Cutty's Personality Features"
                sx={{ color: 'var(--primary-text)' }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Design Features Overview */}
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'var(--navbar-bg)', color: 'var(--primary-text)', height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <VisibilityIcon /> What You Can Test
              </Typography>
              
              {designFeatures.map((feature, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {feature.icon} {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>
                    {feature.description}
                  </Typography>
                  <List dense>
                    {feature.features.map((item, idx) => (
                      <ListItem key={idx} sx={{ py: 0, pl: 2 }}>
                        <ListItemText 
                          primary={`• ${item}`} 
                          sx={{ 
                            '& .MuiListItemText-primary': { 
                              fontSize: '0.875rem',
                              opacity: 0.9 
                            } 
                          }} 
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Testing Tips */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: 'var(--primary-bg)', color: 'var(--primary-text)' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              🧪 Testing Tips
            </Typography>
            <Grid container spacing={2}>
              {testingTips.map((tip, index) => (
                <Grid item xs={12} sm={6} key={index}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                      {index + 1}.
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      {tip}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Cutty's Personality Demo */}
        {showCuttyPersonality && (
          <Grid item xs={12}>
            <Card sx={{ bgcolor: 'var(--secondary-bg)', color: 'var(--primary-text)' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PsychologyIcon /> Cutty's Personality Preview
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'var(--accent)' }}>
                      Friendly Welcome:
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      p: 2, 
                      bgcolor: 'var(--navbar-bg)', 
                      borderRadius: 1,
                      fontStyle: 'italic'
                    }}>
                      "Hello! I am Cutty, the friendly CUTTLEFISH. (not an octopus)"
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'var(--action)' }}>
                      Threatening Logout:
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      p: 2, 
                      bgcolor: 'var(--navbar-bg)', 
                      borderRadius: 1,
                      fontWeight: 'bold', 
                      fontFamily: 'Creepster, cursive', 
                      color: 'red', 
                      fontSize: '1.1rem'
                    }}>
                      "THIS GOD WON'T FORGIVE YOU."
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              href="/logout"
              sx={{
                bgcolor: 'var(--action)',
                '&:hover': { bgcolor: 'var(--dark-accent)' },
              }}
            >
              Test Threatening Cutty (Logout)
            </Button>
            <Button
              variant="contained"
              href="/csv_cutter"
              sx={{
                bgcolor: 'var(--secondary)',
                '&:hover': { bgcolor: 'var(--dark-accent)' },
              }}
            >
              Test CSV Cutter
            </Button>
            <Button
              variant="contained"
              href="/faq"
              sx={{
                bgcolor: 'var(--accent)',
                '&:hover': { bgcolor: 'var(--dark-accent)' },
              }}
            >
              Test FAQ Page
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DesignTester;