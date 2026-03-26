import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Container,
} from '@mui/material';
import {
  DataObject as DataObjectIcon,
  Folder as FolderIcon,
  Analytics as AnalyticsIcon,
  ContentCut as ContentCutIcon,
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';

const DoStuff = () => {
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);

  const tools = [
    {
      id: 'cut',
      title: 'CUT',
      description: 'Smart CSV filtering with intelligent data detection',
      icon: ContentCutIcon,
      path: '/cut',
      requiresAuth: false,
    },
    {
      id: 'synthetic-data',
      title: 'Generate Fake Data',
      description: 'Create test datasets with realistic fake data',
      icon: DataObjectIcon,
      path: '/synthetic-data',
      requiresAuth: false,
    },
    {
      id: 'files',
      title: 'Manage Files',
      description: 'Upload, organize, and manage your data files',
      icon: FolderIcon,
      path: '/manage_files',
      requiresAuth: false,
    },
    {
      id: 'cuttytabs',
      title: 'Cuttytabs',
      description: 'Analyze relationships between variables',
      icon: AnalyticsIcon,
      path: '/analysis/cuttytabs',
      requiresAuth: false,
    },
  ];

  const handleCardClick = (path) => {
    navigate(path);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 'bold',
            mb: 1,
            color: 'var(--primary-text)',
            textAlign: 'center',
            fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
          }}
        >
          Do Stuff
        </Typography>
        <Typography
          variant="h6"
          sx={{
            mb: 4,
            color: 'var(--secondary-text)',
            textAlign: 'center',
            opacity: 0.8,
          }}
        >
          Choose a tool to get started
        </Typography>

        {/* Option A: Clean List Layout */}
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          {tools.map((tool, index) => (
            <Card
              key={tool.id}
              sx={{
                mb: 3,
                bgcolor: 'var(--secondary-bg)',
                border: '1px solid',
                borderColor: 'var(--border-color)',
                borderRadius: 3,
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                  borderColor: '#3b82f6',
                },
              }}
            >
              <CardActionArea onClick={() => handleCardClick(tool.path)}>
                <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3, md: 4 } }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: { xs: 48, sm: 64 },
                        height: { xs: 48, sm: 64 },
                        borderRadius: 3,
                        bgcolor: 'rgba(59, 130, 246, 0.08)',
                        flexShrink: 0,
                      }}
                    >
                      <tool.icon sx={{ fontSize: { xs: 24, sm: 32 }, color: 'var(--primary-text)', opacity: 0.8 }} />
                    </Box>
                    
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 600,
                          color: 'var(--primary-text)',
                          mb: 1,
                          fontSize: '1.3rem',
                        }}
                      >
                        {tool.title}
                      </Typography>
                      
                      <Typography
                        variant="body1"
                        sx={{
                          color: 'var(--primary-text)',
                          opacity: 0.8,
                          lineHeight: 1.6,
                          fontSize: '1rem',
                        }}
                      >
                        {tool.description}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Box>
    </Container>
  );
};

export default DoStuff;