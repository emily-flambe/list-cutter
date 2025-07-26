import { useState, useContext, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  Chip,
  Container,
  useTheme,
  useMediaQuery,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Fab,
} from '@mui/material';
import {
  Home as HomeIcon,
  UploadFile as UploadFileIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Help as HelpIcon,
  Folder as FolderIcon,
  ContentCut as ContentCutIcon,
  Person as PersonIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import cuttlefishLogo from '../../assets/cutty_logo.png';
import ThemeSwitcher from '../ThemeSwitcher';
import FontSwitcher from '../FontSwitcher';
import api from '../../api';

const CompactLayout = ({ children }) => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token, user, setUser } = useContext(AuthContext);
  const [loadingUser, setLoadingUser] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (token) {
        try {
          const response = await api.get(`/api/v1/auth/user`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setUser(response.data);
        } catch (error) {
          console.error("Failed to fetch user data:", error);
          setUser(null);
        } finally {
          setLoadingUser(false);
        }
      } else {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [token, setUser]);

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
        case '/register':
          return "Act like you've been here before!";
        case '/login':
          return "Have we met?";
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

  const allMenuItems = [
    { text: 'About', path: '/', icon: <HomeIcon /> },
    ...(token ? [] : [{ text: 'CSV Cutter', path: '/csv_cutter', icon: <ContentCutIcon /> }]),
    ...(token ? [{ text: 'CSV Cutter PLUS', path: '/csv_cutter_plus', icon: <ContentCutIcon /> }] : []),
    { text: 'Files', path: '/manage_files', icon: <FolderIcon /> },
    { text: 'FAQ', path: '/faq', icon: <HelpIcon /> },
    ...(token ? [
      { text: 'Upload Files', path: '/file_upload', icon: <UploadFileIcon /> },
      { text: 'Load Person Records', path: '/load_person_records', icon: <PersonIcon /> },
    ] : []),
    ...(token ? [{ text: 'Logout', path: '/logout', icon: <LogoutIcon /> }] : [{ text: 'Login', path: '/login', icon: <LoginIcon /> }]),
  ];

  return (
    <Box sx={{ bgcolor: 'var(--primary-bg)', minHeight: '100vh' }}>
      {/* Compact Header */}
      <AppBar 
        position="sticky" 
        sx={{ 
          bgcolor: 'var(--navbar-bg)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar variant="dense">
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <img 
              src={cuttlefishLogo} 
              alt="Cutty Logo" 
              style={{ height: '40px', marginRight: '8px' }} 
            />
            <Typography variant="h6" component="div" sx={{ color: 'var(--primary-text)', fontSize: '1.1rem' }}>
              Cutty
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ThemeSwitcher compact />
            <FontSwitcher compact />
            
            {loadingUser ? (
              <Chip label="..." size="small" />
            ) : token ? (
              <Chip 
                avatar={<Avatar sx={{ bgcolor: 'var(--accent)', width: 24, height: 24 }}>{user?.username?.[0]?.toUpperCase()}</Avatar>}
                label={user?.username || 'User'}
                variant="outlined"
                size="small"
                sx={{ color: 'var(--primary-text)', borderColor: 'var(--accent)' }}
              />
            ) : (
              <Chip label="Guest" size="small" color="warning" />
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Cutty Message Banner - More Compact */}
      {getCuttlefishMessage().text && (
        <Box
          sx={{
            bgcolor: 'var(--secondary-bg)',
            p: 1.5,
            textAlign: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'var(--primary-text)',
              fontSize: '0.9rem',
              ...getCuttlefishMessage().style,
            }}
          >
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
      )}

      {/* Floating Action Button for Menu */}
      <Fab
        color="primary"
        onClick={() => setDrawerOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          bgcolor: 'var(--accent)',
          '&:hover': {
            bgcolor: 'var(--dark-accent)',
          },
          zIndex: 1000,
        }}
      >
        <MenuIcon />
      </Fab>

      {/* Slide-out Navigation Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            backgroundColor: 'var(--navbar-bg)',
            color: 'var(--primary-text)',
            width: 280,
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Navigation</Typography>
          <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: 'var(--primary-text)' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List>
          {allMenuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                component={Link}
                to={item.path}
                onClick={() => setDrawerOpen(false)}
                selected={location.pathname === item.path}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'var(--accent)',
                    '&:hover': {
                      backgroundColor: 'var(--dark-accent)',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Container maxWidth="xl" sx={{ py: 2 }}>
        {children}
      </Container>
    </Box>
  );
};

export default CompactLayout;