import { Typography, Box, Link } from '@mui/material';

const Home = () => {
  return (
    <Box>
      <Typography variant="h3" component="h1" gutterBottom>
        List Cutter App
      </Typography>
      
      <Typography 
        variant="body2" 
        sx={{ 
          fontSize: '0.8em', 
          color: 'text.secondary',
          mb: 4 
        }}
      >
        ALL FEATURES IN THIS APP—EVEN THOSE BASED ON REAL USE CASES—ARE ENTIRELY FICTIONAL. ALL FUNCTIONALITY IS BASIC AND IMPLEMENTED... POORLY. THE FOLLOWING APP MAY CONTAIN COARSE LANGUAGE AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE. ▌
      </Typography>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Link
          href="https://github.com/emily-flambe/list-cutter"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            color: '#0366d6',
            textDecoration: 'none',
            fontSize: '0.9em',
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          view on GitHub (don't @ me)
        </Link>
      </Box>
    </Box>
  );
};

export default Home; 