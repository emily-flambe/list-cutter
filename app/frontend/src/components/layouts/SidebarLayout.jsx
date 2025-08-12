import { useState, useContext, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Chip,
  useTheme,
  useMediaQuery,
  Collapse,
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
  ExpandLess,
  ExpandMore,
  ChevronLeft as ChevronLeftIcon,
  AutoAwesome as AutoAwesomeIcon,
  DataObject as DataObjectIcon,
  Analytics as AnalyticsIcon,
  // Anchor as AnchorIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import cuttlefishLogo from '../../assets/cutty_logo.png';
import ThemeSwitcher from '../ThemeSwitcher';
import FontSwitcher from '../FontSwitcher';
import api from '../../api';

const drawerWidth = 280;

// Fixed sidebar cutoff issue - v2
const SidebarLayout = ({ children }) => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token, user, setUser } = useContext(AuthContext);
  const [loadingUser, setLoadingUser] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(
    localStorage.getItem('appearanceOpen') === 'true'
  );

  useEffect(() => {
    const fetchUserData = async () => {
      if (token) {
        try {
          const response = await api.get(`/api/v1/auth/user`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setUser(response.data.user || response.data);
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
        case '/file_lineage':
          return "Wow, is this a FAMILY TREE for FILES? (the answer is yes)";
        case '/file_upload':
          return "Think twice before giving your files to a stranger!";
        case '/manage_files':
          return "I can't be managed. But your files can be!";
        case '/register':
          return "Act like you've been here before!";
        case '/login':
          return "Have we met?";
        case '/do-stuff':
          return "Pick your tool, any tool! Let's get stuff done!";
        case '/do-stuff/synthetic-data':
          return "LET'S SPILL SOME INK.";
        case '/do-stuff/cuttytabs':
          return "Time for a swim swim!";
        case '/do-stuff/cut':
          return "I was born for this!";
        case '/faq':
          return { text: "Are you still looking for answers where there are only questions?", style: { fontWeight: 'bold', fontFamily: 'Creepster, cursive', color: 'red', fontSize: '1.15rem' } };
        case '/logout':
          return { 
            text: "THIS GOD WON'T FORGIVE YOU.", 
            style: { 
              fontSize: '1.75rem',
              className: 'terrifying-message'
            } 
          };
        default:
          return "";
      }
    })();

    return typeof message === 'string' ? { text: message, style: {} } : message;
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleAppearanceToggle = () => {
    const newState = !appearanceOpen;
    setAppearanceOpen(newState);
    localStorage.setItem('appearanceOpen', newState.toString());
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Sidebar Header with Cutty's Dialogue */}
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 2,
          overflow: 'hidden',
          minHeight: '80px'
        }}>
          <img 
            src={cuttlefishLogo} 
            alt="Cutty Logo" 
            className={location.pathname === '/logout' ? "cutty-logo cutty-angry" : "cutty-logo"}
            style={{ 
              height: '80px', 
              marginRight: '12px',
              flexShrink: 0,
              objectFit: 'contain'
            }} 
          />
          <Typography 
            variant="h4" 
            className={location.pathname === '/logout' ? "cutty-text cutty-text-angry" : "cutty-text"}
            sx={{ 
              color: 'var(--primary-text)',
              fontFamily: '"SenorSaturno", monospace',
              fontSize: { xs: '32px', sm: '38px', md: '42px' },
              letterSpacing: '1px',
              fontWeight: 'bold',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0
            }}
          >
            Cutty
          </Typography>
        </Box>
        
        {/* Cutty's Dialogue in Sidebar */}
        {getCuttlefishMessage().text && (
          <Box sx={{ 
            position: 'relative',
            bgcolor: 'var(--secondary-bg)', 
            p: 1.5, 
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.1)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-12px',
              left: '20px',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '0 12px 12px 12px',
              borderColor: 'transparent transparent rgba(255,255,255,0.1) transparent',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '-11px',
              left: '20px',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '0 12px 12px 12px',
              borderColor: 'transparent transparent var(--secondary-bg) transparent',
            }
          }}>
            <Typography
              variant="body2"
              className={location.pathname === '/logout' ? 'terrifying-message' : ''}
              sx={{
                color: 'var(--primary-text)',
                fontSize: '0.8rem',
                lineHeight: 1.3,
                ...(getCuttlefishMessage().style || {}),
              }}
            >
              {getCuttlefishMessage().text}
            </Typography>
          </Box>
        )}
      </Box>

      {/* User Info */}
      {loadingUser ? (
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Chip label="Loading..." size="small" />
        </Box>
      ) : token ? (
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: 'var(--accent)', width: 32, height: 32 }}>
                {user?.username?.[0]?.toUpperCase()}
              </Avatar>
              <Typography variant="body2" sx={{ color: 'var(--primary-text)' }}>
                {user?.username || 'User'}
              </Typography>
            </Box>
            <IconButton
              component={Link}
              to="/logout"
              size="small"
              sx={{ 
                color: 'var(--primary-text)', 
                '&:hover': { 
                  backgroundColor: 'rgba(255,0,0,0.1)' 
                } 
              }}
              title="Logout"
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      ) : (
        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <List sx={{ py: 0 }}>
            <ListItem disablePadding>
              <ListItemButton
                component={Link}
                to="/login"
                selected={location.pathname === '/login'}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'var(--accent)',
                    '&:hover': { backgroundColor: 'var(--dark-accent)' },
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                  <LoginIcon />
                </ListItemIcon>
                <ListItemText primary="Login" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)', fontSize: '0.9rem' } }} />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      )}

      {/* Navigation */}
      <List sx={{ flexGrow: 1, py: 1 }}>
        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            to="/"
            selected={location.pathname === '/'}
            sx={{
              '&.Mui-selected': {
                backgroundColor: 'var(--accent)',
                '&:hover': { backgroundColor: 'var(--dark-accent)' },
              },
            }}
          >
            <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="About" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)', fontSize: '0.9rem' } }} />
          </ListItemButton>
        </ListItem>

        {/* Do Stuff Portal - Available to all users */}
        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            to="/do-stuff"
            selected={location.pathname === '/do-stuff' || location.pathname.startsWith('/do-stuff/')}
            sx={{
              '&.Mui-selected': {
                backgroundColor: 'var(--accent)',
                '&:hover': { backgroundColor: 'var(--dark-accent)' },
              },
            }}
          >
            <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
              <AutoAwesomeIcon />
            </ListItemIcon>
            <ListItemText primary="Do Stuff" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)', fontSize: '0.9rem' } }} />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            to="/faq"
            selected={location.pathname === '/faq'}
            sx={{
              '&.Mui-selected': {
                backgroundColor: 'var(--accent)',
                '&:hover': { backgroundColor: 'var(--dark-accent)' },
              },
            }}
          >
            <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
              <HelpIcon />
            </ListItemIcon>
            <ListItemText primary="FAQ" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)', fontSize: '0.9rem' } }} />
          </ListItemButton>
        </ListItem>
      </List>

      {/* Bottom Actions */}
      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Appearance Section - Collapsible */}
        <List sx={{ p: 0, mb: 2 }}>
          <ListItem disablePadding>
            <ListItemButton 
              onClick={handleAppearanceToggle}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
              }}
            >
              <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                <AutoAwesomeIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Style" 
                sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)', fontSize: '0.9rem' } }} 
              />
              {appearanceOpen ? <ExpandLess sx={{ color: 'var(--primary-text)' }} /> : <ExpandMore sx={{ color: 'var(--primary-text)' }} />}
            </ListItemButton>
          </ListItem>
          <Collapse in={appearanceOpen} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 2, pr: 1, pb: 1 }}>
              {/* Theme Switcher */}
              <Box sx={{ mb: 1.5 }}>
                <ThemeSwitcher />
              </Box>
              
              {/* Font Switcher */}
              <Box>
                <FontSwitcher />
              </Box>
            </Box>
          </Collapse>
        </List>
        
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', bgcolor: 'var(--primary-bg)', minHeight: '100vh' }}>
      {/* Mobile App Bar */}
      {isMobile && (
        <AppBar
          position="fixed"
          sx={{
            width: '100%',
            bgcolor: 'var(--navbar-bg)',
            zIndex: theme.zIndex.drawer - 1,
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, color: 'var(--primary-text)' }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap sx={{ color: 'var(--primary-text)' }}>
              Cutty
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: 'var(--navbar-bg)',
              color: 'var(--primary-text)',
              borderRight: '1px solid rgba(255,255,255,0.1)',
              '& .MuiListItemText-primary': {
                color: 'var(--primary-text)',
              },
              '& .MuiSvgIcon-root': {
                color: 'var(--primary-text)',
              },
              '& .MuiTypography-root': {
                color: 'var(--primary-text)',
              },
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: isMobile ? 8 : 0,
        }}
      >


        <Box sx={{ p: { xs: 1, sm: 1.5, md: 1.5 }, maxWidth: 'none', width: '100%' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default SidebarLayout;