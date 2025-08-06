import React from 'react';
import { Box, Typography, Card, CardContent, Button, Grid } from '@mui/material';
import { Link } from 'react-router-dom';
import { Analytics as AnalyticsIcon, TableChart as TableChartIcon } from '@mui/icons-material';
import AuthRequired from './AuthRequired';

const Analysis = () => {
  return (
    <AuthRequired>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
          Analysis Tools
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Choose from our collection of data analysis tools to explore and understand your data.
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TableChartIcon sx={{ mr: 1, color: 'primary.main', fontSize: 28 }} />
                  <Typography variant="h6" component="h2">
                    Cuttytabs
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                  Create cross-tabulation tables to analyze relationships between two categorical variables. 
                  Features interactive field selection, frequency counts with totals, and CSV export functionality.
                </Typography>
                
                <Button
                  component={Link}
                  to="/analysis/cuttytabs"
                  variant="contained"
                  color="primary"
                  startIcon={<AnalyticsIcon />}
                  sx={{ mt: 'auto' }}
                >
                  Open Cuttytabs
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Placeholder for future analysis tools */}
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', opacity: 0.6 }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AnalyticsIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 28 }} />
                  <Typography variant="h6" component="h2" color="text.secondary">
                    More Tools Coming Soon
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
                  Additional analysis tools will be added here in future releases.
                </Typography>
                
                <Button
                  variant="outlined"
                  disabled
                  sx={{ mt: 'auto' }}
                >
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </AuthRequired>
  );
};

export default Analysis;