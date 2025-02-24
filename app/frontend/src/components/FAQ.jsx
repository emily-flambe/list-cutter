import { Typography, Box } from '@mui/material';

const FAQ = () => {
  return (
    <Box sx={{ 
      bgcolor: 'var(--secondary-bg)',
      padding: 4,
      borderRadius: 2,
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
      textAlign: 'left'
    }}>
      <img 
        src="src/assets/isthisacrm.jpg"
        alt="Is this a CRM?" 
        style={{ width: '100%', borderRadius: '8px' }}
      />
    </Box>
  );
};

export default FAQ; 