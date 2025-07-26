import React from 'react';
import underConstructionImage from '../assets/under_construction.png';
import Typography from '@mui/material/Typography';

const UnderConstruction = () => {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <Typography variant="h1">Coming Soon!</Typography>
      <Typography variant="body1" style={{ fontSize: '16px', color: '#555' }}>probably</Typography>
      <img 
        src={underConstructionImage}
        alt="Under Construction" 
        style={{ width: '800px', height: 'auto' }} // Adjust size as needed
      />
    </div>
  );
};

export default UnderConstruction; 