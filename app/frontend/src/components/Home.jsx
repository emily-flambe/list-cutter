// Optimized direct imports for better tree-shaking and build performance
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import importantImage from '../assets/important.jpg';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

const Home = () => {
  const { token, user, setUser } = useContext(AuthContext);

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