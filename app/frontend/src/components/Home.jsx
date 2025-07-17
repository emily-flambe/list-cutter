// Optimized direct imports for better tree-shaking and build performance
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Container from '@mui/material/Container';
import importantImage from '../assets/important.jpg';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import { GoogleOAuthCallback } from './GoogleSignInButton';

const Home = () => {
  const { token, user, setUser } = useContext(AuthContext);
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.has('oauth_success') || urlParams.has('token');

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
      textAlign: 'left'
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
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <img 
            src={importantImage}
            alt="Important" 
            style={{ width: '80%', maxWidth: '400px', borderRadius: '8px' }} 
          />
        </Box>
      )}
    </Box>
  );
};

export default Home; 