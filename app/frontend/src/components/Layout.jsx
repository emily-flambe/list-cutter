// Optimized direct imports for better tree-shaking and build performance
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import MuiLink from '@mui/material/Link';

// Optimized direct icon imports for better tree-shaking
import HomeIcon from '@mui/icons-material/Home';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import HelpIcon from '@mui/icons-material/Help';
import FolderIcon from '@mui/icons-material/Folder';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import ListIcon from '@mui/icons-material/List';
import PersonIcon from '@mui/icons-material/Person';
import DataArrayIcon from '@mui/icons-material/DataArray';
import { Link, useLocation } from 'react-router-dom';
import cuttlefishLogo from '../assets/cutty_logo.png';
import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import React from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import { applyTheme, getCurrentTheme } from '../themes/themeVariants';

const DRAWER_WIDTH = 240;

const Layout = ({ children }) => {
  const location = useLocation();
  const { token, user, setUser } = useContext(AuthContext);
  const [loadingUser, setLoadingUser] = useState(true); // Add loading state
  const [openFiles, setOpenFiles] = useState(false); // Add state for toggling Files group
  const [openPeople, setOpenPeople] = useState(false); // Add state for toggling People group

  useEffect(() => {
    // Initialize theme on app startup
    const currentTheme = getCurrentTheme();
    applyTheme(currentTheme);
    
    const fetchUserData = async () => {
      if (token) {
        try {
          const response = await api.get(`/api/v1/accounts/user`, {
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
    ...(token ? [{ text: 'Logout', icon: <LogoutIcon />, path: '/logout' }] : []),
    ...(token ? [] : [{ text: 'Login', icon: <LoginIcon />, path: '/login' }]),
    ...(token ? [] : [{ text: 'CSV Cutter', icon: <ContentCutIcon />, path: '/csv_cutter' }]),
    ...(token ? [{ text: 'CSV Cutter PLUS', icon: <ContentCutIcon />, path: '/csv_cutter_plus' }] : []),
    ...(token ? [{ text: openFiles ? 'Files (-)' : 'Files (+)', icon: <ListIcon />, isGroup: true }] : []),
    ...(token ? [{ text: openPeople ? 'People (-)' : 'People (+)', icon: <ListIcon />, isGroup: true }] : []),
    ...(token ? [{ text: 'FAQ', icon: <HelpIcon />, path: '/faq' }] : []),
    { text: 'About', icon: <HomeIcon />, path: '/' },
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
        case '/csv_cutter_plus':
          return "It looks like you are trying to cut a list! Would you like some help with that?";
        case '/file_upload':
          return "Think twice before giving your files to a stranger!";
        case '/manage_files':
          return "I can't be managed. But your files can be!";
        case '/import_people':
          return "Wait a minute. IS this a CRM?";
        case '/register':
          return "Act like you've been here before!";
        case '/login':
          return "Have we met?";
        case '/synthetic-data':
          return "Creating FAKE people? That's MY job!";
        case '/faq':
          return { text: "Are you still looking for answers where there are only questions?", style: { fontWeight: 'bold', fontFamily: 'Creepster, cursive', color: 'red', fontSize: '1.15rem' } };
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
      <MuiLink
        href="https://github.com/emily-flambe/cutty"
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 1300, // Above drawer
          color: '#e3f0f7',
          opacity: 0.7,
          transition: 'opacity 0.2s ease',
          mb: 2, // Add margin bottom for padding beneath
          '&:hover': {
            opacity: 1
          }
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      </MuiLink>
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
        <Box sx={{ overflow: 'auto', mt: 4 }}>
          <Typography variant="body2" sx={{ padding: 2 }}>
            {loadingUser ? 'Loading...' : (token ? <>Hello, <strong>{user ? user.username : 'Unknown User'}</strong>! Thank you for visiting this web site!</> : <>You are not logged in :/<br />Log in to see all the EXCLUSIVE FEATURES.</>)}
          </Typography>
          <List>
            {menuItems.map((item) => (
              <React.Fragment key={item.text}>
                {item.isGroup ? (
                  <>
                    <ListItem 
                      button 
                      onClick={() => {
                        if (item.text.includes('Files')) {
                          setOpenFiles(!openFiles);
                        } else if (item.text.includes('People')) {
                          setOpenPeople(!openPeople);
                        }
                      }}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItem>
                    {item.text.includes('Files') && (
                      <Collapse in={openFiles} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                          <ListItem key="upload" disablePadding>
                            <ListItemButton 
                              component={Link} 
                              to="/file_upload" 
                              sx={{ paddingLeft: 4 }}
                            >
                              <ListItemIcon><UploadFileIcon /></ListItemIcon>
                              <ListItemText primary="Upload" />
                            </ListItemButton>
                          </ListItem>
                          <ListItem key="manage" disablePadding>
                            <ListItemButton 
                              component={Link} 
                              to="/manage_files" 
                              sx={{ paddingLeft: 4 }}
                            >
                              <ListItemIcon><FolderIcon /></ListItemIcon>
                              <ListItemText primary="Manage" />
                            </ListItemButton>
                          </ListItem>
                        </List>
                      </Collapse>
                    )}
                    {item.text.includes('People') && (
                      <Collapse in={openPeople} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                          <ListItem key="load_person_records" disablePadding>
                            <ListItemButton 
                              component={Link} 
                              to="/load_person_records" 
                              sx={{ paddingLeft: 4 }}
                            >
                              <ListItemIcon><PersonIcon /></ListItemIcon>
                              <ListItemText primary="Load Person Records" />
                            </ListItemButton>
                          </ListItem>
                          <ListItem key="synthetic_data" disablePadding>
                            <ListItemButton 
                              component={Link} 
                              to="/synthetic-data" 
                              sx={{ paddingLeft: 4 }}
                            >
                              <ListItemIcon><DataArrayIcon /></ListItemIcon>
                              <ListItemText primary="Generate Fake Data" />
                            </ListItemButton>
                          </ListItem>
                        </List>
                      </Collapse>
                    )}
                  </>
                ) : (
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
                )}
              </React.Fragment>
            ))}
          </List>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 'auto', mb: 3 }}>
          {/* Design Controls */}
          <Box sx={{ width: '100%', px: 2, mb: 3 }}>
            <Typography variant="overline" sx={{ color: 'var(--primary-text)', opacity: 0.7, fontSize: '0.7rem' }}>
              Design Controls
            </Typography>
            <Box sx={{ mt: 1, mb: 2 }}>
              <ThemeSwitcher compact />
            </Box>
          </Box>
          
          <img src={cuttlefishLogo} alt="Cuttlefish Logo" style={{ maxWidth: '200px' }} />
          <Typography variant="caption" sx={{ textAlign: 'center', mt: -1, ...getCuttlefishMessage().style }}>
            {getCuttlefishMessage().text}
            {location.pathname === '/' && (
              <Box
                component="span"
                sx={{
                  '@keyframes blink': {
                    '0%, 49%': { opacity: 1 },
                    '50%, 100%': { opacity: 0 }
                  },
                  animation: 'blink 1s infinite',
                  ml: 0.5
                }}
              >
                ▌
              </Box>
            )}
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