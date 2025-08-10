// Optimized direct imports for better tree-shaking and build performance
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Container from '@mui/material/Container';
import cuttyLogo from '../assets/cutty_logo.png';
import { AuthContext } from '../context/AuthContext';
import { useContext, useEffect, useState } from 'react';
import { GoogleOAuthCallback } from './GoogleSignInButton';

const Home = () => {
  const { token, user, setUser } = useContext(AuthContext);
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.has('oauth_success') || urlParams.has('token');
  
  // State for rotating logos
  const [currentLogoIndex, setCurrentLogoIndex] = useState(0);
  
  // Logo configurations for different positions/styles
  const logoConfigs = [
    { scale: 1, rotate: 0, opacity: 1 },
    { scale: 0.9, rotate: -5, opacity: 0.9 },
    { scale: 1.1, rotate: 3, opacity: 1 },
    { scale: 0.95, rotate: -2, opacity: 0.95 },
    { scale: 1.05, rotate: 7, opacity: 0.9 }
  ];
  
  // Rotate through logos every 2 seconds
  useEffect(() => {
    if (!token) return; // Only rotate when user is logged in
    
    const interval = setInterval(() => {
      setCurrentLogoIndex((prev) => (prev + 1) % logoConfigs.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [token, logoConfigs.length]);

  // Handle OAuth callback if parameters are present
  if (isOAuthCallback) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <GoogleOAuthCallback 
          onSuccess={() => {
            // Clear URL parameters and stay on home page
            window.history.replaceState({}, document.title, '/');
          }}
          onError={(error) => {
            console.error('OAuth error:', error);
            alert(`Sign-in failed: ${error.message}`);
            window.location.href = '/login';
          }}
        />
      </Container>
    );
  }

  return (
    <Box sx={{ 
      bgcolor: 'var(--secondary-bg)',
      padding: 4,
      borderRadius: 2,
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
      textAlign: 'left',
      // Add keyframes for spinning animation
      '@keyframes spin': {
        '0%': { transform: 'rotate(0deg)' },
        '100%': { transform: 'rotate(360deg)' }
      }
    }}>
      <Typography 
        variant="body2" 
        sx={{ 
          fontSize: '1.5em',
          color: 'var(--primary-text)',
          opacity: 0.8,
          mb: 4,
        }}
      >
        ALL FEATURES IN THIS APP—EVEN THOSE BASED ON REAL USE CASES—ARE ENTIRELY FICTIONAL. ALL FUNCTIONALITY IS BASIC AND IMPLEMENTED... POORLY. THE FOLLOWING APP MAY CONTAIN COARSE LANGUAGE AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE. 
        <Box
          component="span"
          sx={{
            '@keyframes blink': {
              '0%, 49%': { opacity: 1 },
              '50%, 100%': { opacity: 0 }
            },
            animation: 'blink 1s infinite'
          }}
        >
          ▌
        </Box>
      </Typography>

      {token && (
        <Box sx={{ mt: 3, textAlign: 'center', position: 'relative', height: '200px' }}>
          {/* Render multiple logo instances in a horizontal line with animation */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: 3,
            height: '100%'
          }}>
            {logoConfigs.map((config, index) => (
              <Box
                key={index}
                sx={{
                  transform: `scale(${config.scale}) rotate(${config.rotate}deg)`,
                  opacity: config.opacity,
                  transition: 'all 0.8s ease-in-out',
                  filter: currentLogoIndex === index ? 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))' : 'none'
                }}
              >
                <img 
                  src={cuttyLogo}
                  alt="Cutty Logo" 
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    objectFit: 'contain',
                    animation: 'spin 4s linear infinite'
                  }} 
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Home; 