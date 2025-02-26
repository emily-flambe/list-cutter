import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { Home, Upload, PersonAdd, Login, Logout, Help, FilePresent, ContentCut } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import cuttlefishLogo from '../assets/cutty_logo.png';
import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

const DRAWER_WIDTH = 240;

const Layout = ({ children }) => {
  const location = useLocation();
  const { token, user, setUser } = useContext(AuthContext);
  const [loadingUser, setLoadingUser] = useState(true); // Add loading state

  useEffect(() => {
    const fetchUserData = async () => {
      if (token) {
        try {
          const response = await axios.get(`/api/accounts/user/`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setUser(response.data); // Update user state
        } catch (error) {
          console.error("Failed to fetch user data:", error);
          setUser(null); // Reset user state on error
        } finally {
          setLoadingUser(false); // Set loading to false after fetching
        }
      } else {
        setLoadingUser(false); // Set loading to false if no token
      }
    };

    fetchUserData();
  }, [token]); // Fetch user data whenever the token changes

  const menuItems = [
    ...(token ? [{ text: 'Logout', icon: <Logout />, path: '/logout' }] : []),
    ...(token ? [] : [{ text: 'Login', icon: <Login />, path: '/login' }]),
    { text: 'CSV Cutter', icon: <ContentCut />, path: '/csv_cutter' },
    // SECRET MENU. MEMBERS ONLY. also no boys allowed
    ...(token ? [{ text: 'Upload Files', icon: <Logout />, path: '/file_upload' }] : []),
    ...(token ? [{ text: 'Manage Files', icon: <Logout />, path: '/manage_files' }] : []),
    // ok back to the regular menu
    { text: 'FAQ', icon: <Help />, path: '/faq' },
    { text: 'About', icon: <Home />, path: '/' },
  ];

  // Determine the message based on the current path
  const getCuttlefishMessage = () => {
    const message = (() => {
      switch (location.pathname) {
        case '/':
          return token 
            ? "Welcome back! I missed you! I'm your BEST FRIEND, CUTTY (the cuttlefish)" 
            : "Hello! I am Cutty, the friendly CUTTLEFISH. (not an octopus)";
        case '/csv_cutter':
          return "It looks like you are trying to cut a list! Would you like some help with that?";
        case '/register':
          return "Act like you've been here before!";
        case '/login':
          return "Have we met?";
        case '/faq':
          return { text: "Are you still looking for answers where there are only questions?", style: { fontWeight: 'bold', fontFamily: 'Creepster, cursive', color: 'red', fontSize: '1.5rem' } };
        case '/logout':
          return { text: "THIS GOD WON'T FORGIVE YOU.", style: { fontWeight: 'bold', fontFamily: 'Creepster, cursive', color: 'red', fontSize: '1.75rem' } };
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
            {loadingUser ? 'Loading...' : (token ? <>Hello, <strong>{user ? user.username : 'Unknown User'}</strong>! Thank you for visiting this web site!</> : <>You are not logged in :/<br />Log in to see all the EXCLUSIVE FEATURES.</>)}
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