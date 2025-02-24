import { Typography, Box, Link } from '@mui/material';

const FAQ = () => {
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
        ALL FEATURES IN THIS APP—EVEN THOSE BASED ON REAL USE CASES—ARE ENTIRELY FICTIONAL. ALL FUNCTIONALITY IS BASIC AND IMPLEMENTED... POORLY. THE FOLLOWING APP MAY CONTAIN COARSE LANGUAGE AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE. ▌
      </Typography>

      <Box sx={{ mt: 3, textAlign: 'left' }}>
        <Link
          href="https://github.com/emily-flambe/list-cutter"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            color: 'var(--action)',
            textDecoration: 'none',
            fontSize: '0.9em',
            padding: '8px 0px',
            borderRadius: '4px',
            transition: 'all 0.2s ease',
            '&:hover': {
              color: 'var(--secondary)',
              background: 'rgba(88, 148, 255, 0.1)'
            }
          }}
        >
          source code on GitHub
        </Link>
      </Box>
    </Box>
  );
};

export default Home; 