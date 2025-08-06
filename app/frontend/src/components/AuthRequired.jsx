import React, { useContext } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import cuttyLogo from '../assets/cutty_logo.png';

const AuthRequired = ({ children }) => {
  const { token } = useContext(AuthContext);

  if (!token) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        maxHeight: '100vh',
        overflow: 'hidden',
        p: 2,
        position: 'relative'
      }}>
        {/* Top Row: Text on left, Large Cutty on right */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '100%',
          maxWidth: '900px',
          mb: -6,
          gap: 3,
          pl: 2
        }}>
          {/* Red Glowing Text */}
          <Typography 
            variant="h2" 
            sx={{ 
              color: '#ff0000',
              fontFamily: 'Creepster, cursive',
              fontWeight: 'bold',
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
              lineHeight: 1.2,
              textAlign: 'left',
              flex: 1,
              '@keyframes textGlow': {
                '0%': {
                  textShadow: '0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000'
                },
                '100%': {
                  textShadow: '0 0 20px #ff0000, 0 0 30px #ff0000, 0 0 40px #ff0000'
                }
              },
              animation: 'textGlow 2s ease-in-out infinite alternate',
              textShadow: '0 0 10px #ff0000, 0 0 20px #ff0000, 0 0 30px #ff0000'
            }}
          >
            YOU ARE NOT LOGGED IN.
          </Typography>
          
          {/* REALLY BIG Cutty - on the right */}
          <Box
            component="img"
            src={cuttyLogo}
            alt="Angry Cutty"
            sx={{
              width: { xs: '380px', sm: '450px', md: '500px', lg: '520px' },
              height: 'auto',
              flexShrink: 0,
              transform: 'scaleX(-1)',
              filter: 'hue-rotate(0deg) saturate(2) brightness(1.2) drop-shadow(0 0 30px #ff0000) drop-shadow(0 0 60px #ff0000)',
              '@keyframes redGlow': {
                '0%': {
                  filter: 'hue-rotate(0deg) saturate(2) brightness(1.2) drop-shadow(0 0 30px #ff0000) drop-shadow(0 0 60px #ff0000)'
                },
                '100%': {
                  filter: 'hue-rotate(0deg) saturate(2) brightness(1.5) drop-shadow(0 0 50px #ff0000) drop-shadow(0 0 100px #ff0000)'
                }
              },
              animation: 'redGlow 2s ease-in-out infinite alternate'
            }}
          />
        </Box>

        {/* Bottom Row: Smaller Cutty and Login Options */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 2,
          justifyContent: 'flex-start',
          width: '100%',
          maxWidth: '900px',
          pl: 2
        }}>
          {/* Smaller Cutty */}
          <Box
            component="img"
            src={cuttyLogo}
            alt="Cutty"
            sx={{
              width: '60px',
              height: 'auto'
            }}
          />
          
          {/* Login message and buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="body1" sx={{ color: 'var(--primary-text)', mb: 2, fontSize: '1.1rem' }}>
              log in or sign up here!
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                component={Link} 
                to="/login"
                sx={{ minWidth: '120px' }}
              >
                Login
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                component={Link} 
                to="/register"
                sx={{ minWidth: '120px' }}
              >
                Sign Up
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return children;
};

export default AuthRequired;