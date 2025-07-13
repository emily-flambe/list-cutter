// frontend/src/pages/LogoutConfirmation.jsx
import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
// Optimized direct imports for better tree-shaking and build performance
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { AuthContext } from '../context/AuthContext';

const LogoutConfirmation = () => {
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleConfirmLogout = () => {
    // Perform the logout action
    logout();
    // Redirect to Home with a query parameter to indicate logout message
    navigate('/?logout=1');
  };

  const handleCancelLogout = () => {
    // Redirect to Home with no query parameters
    navigate('/');
  };

  return (
    <Box sx={{ p: 4, maxWidth: 500, mx: 'auto', textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>
        Are you SURE you want to log out?
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 4 }}>
        <Button variant="contained" color="error" onClick={handleConfirmLogout}>
          LOG OUT
        </Button>
        <Button variant="outlined" onClick={handleCancelLogout}>
          DO NOT
        </Button>
      </Box>
    </Box>
  );
};

export default LogoutConfirmation;
