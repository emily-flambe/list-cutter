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
  AccountTree as AccountTreeIcon,
  ExpandLess,
  ExpandMore,
  ChevronLeft as ChevronLeftIcon,
  WaterDrop as WaterDropIcon,
  // Other aquatic options:
  // Water as WaterIcon,
  // Waves as WavesIcon,
  // Pool as PoolIcon,
  // Sailing as SailingIcon,
  // Anchor as AnchorIcon,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import cuttlefishLogo from '../../assets/cutty_logo.png';
import ThemeSwitcher from '../ThemeSwitcher';
import FontSwitcher from '../FontSwitcher';
import api from '../../api';

const drawerWidth = 280;

const SidebarLayout = ({ children }) => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token, user, setUser } = useContext(AuthContext);
  const [loadingUser, setLoadingUser] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
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
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <img 
            src={cuttlefishLogo} 
            alt="Cutty Logo" 
            className={location.pathname === '/logout' ? "cutty-logo cutty-angry" : "cutty-logo"}
            style={{ height: '80px', marginRight: '12px' }} 
          />
          <Typography 
            variant="h4" 
            className={location.pathname === '/logout' ? "cutty-text cutty-text-angry" : "cutty-text"}
            sx={{ 
              color: 'var(--primary-text)',
              fontFamily: '"SenorSaturno", monospace',
              fontSize: '42px',
              letterSpacing: '1px',
              fontWeight: 'bold'
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
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {loadingUser ? (
          <Chip label="Loading..." size="small" />
        ) : token ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ bgcolor: 'var(--accent)', width: 32, height: 32 }}>
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="body2" sx={{ color: 'var(--primary-text)' }}>
                {user?.username || 'User'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--primary-text)', opacity: 0.7 }}>
                Logged in
              </Typography>
            </Box>
          </Box>
        ) : (
          <Chip 
            label="Not logged in :(" 
            size="small" 
            color="warning"
            component={Link}
            to="/login"
            clickable
            sx={{
              textDecoration: 'none',
              '&:hover': {
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
              }
            }}
          />
        )}
      </Box>

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
            <ListItemText primary="About" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
          </ListItemButton>
        </ListItem>

        {!token && (
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/csv_cutter"
              selected={location.pathname === '/csv_cutter'}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'var(--accent)',
                  '&:hover': { backgroundColor: 'var(--dark-accent)' },
                },
              }}
            >
              <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                <ContentCutIcon />
              </ListItemIcon>
              <ListItemText primary="CSV Cutter" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
            </ListItemButton>
          </ListItem>
        )}

        {token && (
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/csv_cutter_plus"
              selected={location.pathname === '/csv_cutter_plus'}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'var(--accent)',
                  '&:hover': { backgroundColor: 'var(--dark-accent)' },
                },
              }}
            >
              <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                <ContentCutIcon />
              </ListItemIcon>
              <ListItemText primary="CSV Cutter PLUS" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
            </ListItemButton>
          </ListItem>
        )}

        {token && (
          <>
            <ListItem disablePadding>
              <ListItemButton onClick={() => setFilesOpen(!filesOpen)}>
                <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                  <FolderIcon />
                </ListItemIcon>
                <ListItemText primary="Files" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
                {filesOpen ? <ExpandLess sx={{ color: 'var(--primary-text)' }} /> : <ExpandMore sx={{ color: 'var(--primary-text)' }} />}
              </ListItemButton>
            </ListItem>
            <Collapse in={filesOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                <ListItemButton
                  component={Link}
                  to="/file_upload"
                  selected={location.pathname === '/file_upload'}
                  sx={{
                    pl: 4,
                    '&.Mui-selected': {
                      backgroundColor: 'var(--accent)',
                      '&:hover': { backgroundColor: 'var(--dark-accent)' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                    <UploadFileIcon />
                  </ListItemIcon>
                  <ListItemText primary="Upload" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
                </ListItemButton>
                <ListItemButton
                  component={Link}
                  to="/manage_files"
                  selected={location.pathname === '/manage_files'}
                  sx={{
                    pl: 4,
                    '&.Mui-selected': {
                      backgroundColor: 'var(--accent)',
                      '&:hover': { backgroundColor: 'var(--dark-accent)' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                    <FolderIcon />
                  </ListItemIcon>
                  <ListItemText primary="Manage" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
                </ListItemButton>
                <ListItemButton
                  component={Link}
                  to="/file_lineage"
                  selected={location.pathname === '/file_lineage'}
                  sx={{
                    pl: 4,
                    '&.Mui-selected': {
                      backgroundColor: 'var(--accent)',
                      '&:hover': { backgroundColor: 'var(--dark-accent)' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                    <AccountTreeIcon />
                  </ListItemIcon>
                  <ListItemText primary="Lineage" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
                </ListItemButton>
              </List>
            </Collapse>

            <ListItem disablePadding>
              <ListItemButton
                component={Link}
                to="/load_person_records"
                selected={location.pathname === '/load_person_records'}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'var(--accent)',
                    '&:hover': { backgroundColor: 'var(--dark-accent)' },
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText primary="Load Person Records" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
              </ListItemButton>
            </ListItem>
          </>
        )}

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
            <ListItemText primary="FAQ" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
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
                <WaterDropIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Appearance" 
                sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} 
              />
              {appearanceOpen ? <ExpandLess sx={{ color: 'var(--primary-text)' }} /> : <ExpandMore sx={{ color: 'var(--primary-text)' }} />}
            </ListItemButton>
          </ListItem>
          <Collapse in={appearanceOpen} timeout="auto" unmountOnExit>
            <Box sx={{ pl: 2, pr: 1, pb: 1 }}>
              {/* Theme Switcher */}
              <Box sx={{ mb: 1.5 }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'var(--primary-text)', 
                    fontSize: '0.75rem',
                    opacity: 0.7,
                    mb: 0.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Theme
                </Typography>
                <ThemeSwitcher />
              </Box>
              
              {/* Font Switcher */}
              <Box>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'var(--primary-text)', 
                    fontSize: '0.75rem',
                    opacity: 0.7,
                    mb: 0.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Font
                </Typography>
                <FontSwitcher />
              </Box>
            </Box>
          </Collapse>
        </List>
        
        {/* Auth Actions */}
        <Box>
          {token ? (
            <ListItemButton
              component={Link}
              to="/logout"
              sx={{
                borderRadius: 1,
                '&:hover': { backgroundColor: 'rgba(255,0,0,0.1)' },
              }}
            >
              <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
            </ListItemButton>
          ) : (
            <ListItemButton
              component={Link}
              to="/login"
              sx={{
                borderRadius: 1,
                '&:hover': { backgroundColor: 'var(--accent)' },
              }}
            >
              <ListItemIcon sx={{ color: 'var(--primary-text)' }}>
                <LoginIcon />
              </ListItemIcon>
              <ListItemText primary="Login" sx={{ '& .MuiTypography-root': { color: 'var(--primary-text)' } }} />
            </ListItemButton>
          )}
        </Box>
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
            zIndex: theme.zIndex.drawer + 1,
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


        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default SidebarLayout;