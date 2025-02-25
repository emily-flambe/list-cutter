import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { Home, Upload, PersonAdd, Login, Logout, Help } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import cuttlefishLogo from '../assets/cutty_logo.png';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const DRAWER_WIDTH = 240;

const Layout = ({ children }) => {
  const location = useLocation();
  const { token, user } = useContext(AuthContext);

  const menuItems = [
    { text: 'About', icon: <Home />, path: '/' },
    { text: 'CSV Cutter', icon: <Upload />, path: '/upload' },
    ...(token ? [] : [{ text: 'Create Account', icon: <Login />, path: '/register' }]),
    ...(token ? [] : [{ text: 'Login', icon: <Login />, path: '/login' }]),
    ...(token ? [{ text: 'Logout', icon: <Logout />, path: '/logout' }] : []),
    { text: 'FAQ', icon: <Help />, path: '/faq' },
  ];

  // Determine the message based on the current path
  const getCuttlefishMessage = () => {
    const message = (() => {
      switch (location.pathname) {
        case '/':
          return "Hello! I am Cutty, the friendly CUTTLEFISH. (not an octopus)";
        case '/upload':
          return "It looks like you are trying to cut a list! Would you like some help with that?";
        case '/register':
          return "Act like you've been here before!";
        case '/login':
          return "Welcome back! I missed you! I'm your BEST FRIEND, CUTTY (the cuttlefish)";
        case '/faq':
          return { text: "Are you still looking for answers where there are only questions?", style: { fontWeight: 'bold', fontFamily: 'Creepster, cursive', color: 'red', fontSize: '1.5rem' } }; // Scary style
        default:
          return "";
      }
    })();

    return typeof message === 'string' ? { text: message, style: {} } : message;
  };

  return (
    <Box sx={{ display: 'flex', bgcolor: 'var(--primary-bg)', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: 'none',
            backgroundColor: 'var(--navbar-bg)',
            color: '#e3f0f7',
          },
        }}
      >
        <Box sx={{ overflow: 'auto', mt: 8 }}>
          <Typography variant="body2" sx={{ padding: 2 }}>
            {token ? <>Hello, <strong>{user ? user.username : 'Unknown User'}</strong>! Thank you for visiting this web site!</> : 'You are not logged in :/'}
          </Typography>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  selected={location.pathname === item.path}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: '#7795ee',
                      '&:hover': {
                        backgroundColor: '#5894ff',
                      },
                    },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 'auto', mb: 5 }}>
          <img src={cuttlefishLogo} alt="Cuttlefish Logo" style={{ maxWidth: '200px' }} />
          <Typography variant="caption" sx={{ textAlign: 'center', mt: -1, ...getCuttlefishMessage().style }}>
            {getCuttlefishMessage().text}
          </Typography>
        </Box>
      </Drawer>
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          mt: 8,
          bgcolor: 'var(--primary-bg)', // Ensure this is set correctly
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;