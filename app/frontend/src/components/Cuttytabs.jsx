/**
 * Cuttytabs - Dynamic Segmentation Interface
 * 
 * A nimble interface for creating and managing data segments with real-time updates.
 * Features segment builder, live counts, and Google Ads activation.
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Alert,
  Skeleton,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Group as GroupIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';
import cuttyLogo from '../assets/cutty_logo.png';

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'greater_equal', label: 'Greater Than or Equal' },
  { value: 'less_equal', label: 'Less Than or Equal' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
  { value: 'starts_with', label: 'Starts With' },
  { value: 'ends_with', label: 'Ends With' }
];

const Cuttytabs = () => {
  const { token } = useContext(AuthContext);
  const [segments, setSegments] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Form state for segment creation/editing
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    fileId: '',
    query: {
      conditions: [{ field: '', operator: 'equals', value: '' }],
      logic: 'AND'
    },
    googleAdsEnabled: false,
    googleAdsCustomerId: '',
    googleAdsListId: ''
  });

  // Load segments and files on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Set up real-time updates via Server-Sent Events
  useEffect(() => {
    const eventSource = new EventSource('/api/v1/realtime/segments', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    eventSource.onopen = () => {
      console.log('Real-time connection established');
      setRealtimeConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'segment_update') {
          setSegments(data.segments);
        } else if (data.type === 'error') {
          console.error('Real-time error:', data.message);
        }
      } catch (error) {
        console.error('Failed to parse real-time data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Real-time connection error:', error);
      setRealtimeConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [segmentsResponse, filesResponse] = await Promise.all([
        api.get('/segments'),
        api.get('/files')
      ]);

      setSegments(segmentsResponse.data.segments || []);
      setFiles(filesResponse.data.files || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load segments and files');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSegment = () => {
    setEditingSegment(null);
    setFormData({
      name: '',
      description: '',
      fileId: '',
      query: {
        conditions: [{ field: '', operator: 'equals', value: '' }],
        logic: 'AND'
      },
      googleAdsEnabled: false,
      googleAdsCustomerId: '',
      googleAdsListId: ''
    });
    setDialogOpen(true);
  };

  const handleEditSegment = (segment) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name,
      description: segment.description || '',
      fileId: segment.fileId,
      query: segment.query,
      googleAdsEnabled: segment.googleAdsEnabled || false,
      googleAdsCustomerId: segment.googleAdsCustomerId || '',
      googleAdsListId: segment.googleAdsListId || ''
    });
    setDialogOpen(true);
  };

  const handleDeleteSegment = async (segmentId) => {
    if (!window.confirm('Are you sure you want to delete this segment?')) {
      return;
    }

    try {
      await api.delete(`/segments/${segmentId}`);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Failed to delete segment:', error);
      setError('Failed to delete segment');
    }
  };

  const handlePreviewSegment = async () => {
    if (!formData.fileId || formData.query.conditions.some(c => !c.field || !c.operator)) {
      setError('Please select a file and define at least one complete condition');
      return;
    }

    try {
      setPreviewLoading(true);
      const response = await api.post('/segments/preview', {
        fileId: formData.fileId,
        query: formData.query,
        limit: 5
      });

      setPreviewData(response.data);
    } catch (error) {
      console.error('Failed to preview segment:', error);
      setError('Failed to preview segment');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveSegment = async () => {
    if (!formData.name || !formData.fileId) {
      setError('Please provide a name and select a file');
      return;
    }

    try {
      if (editingSegment) {
        await api.put(`/segments/${editingSegment.id}`, formData);
      } else {
        await api.post('/segments', formData);
      }

      setDialogOpen(false);
      setPreviewData(null);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Failed to save segment:', error);
      setError('Failed to save segment');
    }
  };

  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      query: {
        ...prev.query,
        conditions: [...prev.query.conditions, { field: '', operator: 'equals', value: '' }]
      }
    }));
  };

  const removeCondition = (index) => {
    setFormData(prev => ({
      ...prev,
      query: {
        ...prev.query,
        conditions: prev.query.conditions.filter((_, i) => i !== index)
      }
    }));
  };

  const updateCondition = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      query: {
        ...prev.query,
        conditions: prev.query.conditions.map((condition, i) =>
          i === index ? { ...condition, [field]: value } : condition
        )
      }
    }));
  };

  const formatLastProcessed = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'fresh': return 'success';
      case 'stale': return 'warning';
      case 'never_processed': return 'info';
      default: return 'default';
    }
  };

  // Show scary warning for unauthenticated users
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
            ANALYSIS REQUIRES LOGIN.
          </Typography>
          
          {/* REALLY BIG Cutty - on the right */}
          <Box sx={{ 
            position: 'relative',
            '@keyframes redGlow': {
              '0%': {
                filter: 'drop-shadow(0 0 20px #ff0000) drop-shadow(0 0 40px #ff0000)',
                transform: 'scale(1)'
              },
              '100%': {
                filter: 'drop-shadow(0 0 40px #ff0000) drop-shadow(0 0 60px #ff0000)',
                transform: 'scale(1.05)'
              }
            },
            animation: 'redGlow 3s ease-in-out infinite alternate'
          }}>
            <img 
              src={cuttyLogo} 
              alt="Angry Cutty" 
              style={{ 
                width: '300px', 
                height: '300px', 
                filter: 'brightness(1.2) contrast(1.3) hue-rotate(0deg)'
              }} 
            />
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
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
            color="secondary" 
            component={Link} 
            to="/register"
            sx={{ minWidth: '120px' }}
          >
            Register
          </Button>
        </Box>

        <Typography 
          variant="body1" 
          sx={{ 
            mt: 3, 
            textAlign: 'center',
            color: 'text.secondary',
            maxWidth: '600px'
          }}
        >
          Dynamic data segmentation and analysis tools require authentication.
          Login to create segments, track audience changes, and sync with Google Ads.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Cuttytabs - Dynamic Segmentation
        </Typography>
        <Grid container spacing={3}>
          {[1, 2, 3].map(i => (
            <Grid item xs={12} md={6} lg={4} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={40} />
                  <Skeleton variant="text" width="40%" />
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="rectangular" height={60} sx={{ mt: 2 }} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Cuttytabs - Dynamic Segmentation
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              icon={realtimeConnected ? <TrendingUpIcon /> : <ScheduleIcon />}
              label={realtimeConnected ? 'Live Updates' : 'Connecting...'}
              color={realtimeConnected ? 'success' : 'default'}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {segments.length} segments • Real-time processing
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateSegment}
          >
            Create Segment
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Segments Grid */}
      <Grid container spacing={3}>
        {segments.map((segment) => (
          <Grid item xs={12} md={6} lg={4} key={segment.id}>
            <Card 
              sx={{ 
                height: '100%',
                position: 'relative',
                '&:hover': { boxShadow: 3 }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                    {segment.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" onClick={() => handleEditSegment(segment)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteSegment(segment.id)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {segment.description || 'No description'}
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    File: {segment.fileName}
                  </Typography>
                </Box>

                {/* Member Count */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <GroupIcon color="primary" />
                  <Typography variant="h5" color="primary">
                    {(segment.memberCount || 0).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    members
                  </Typography>
                </Box>

                {/* Status */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Chip 
                    label={segment.processingStatus || 'Unknown'}
                    color={getStatusColor(segment.processingStatus)}
                    size="small"
                  />
                  {segment.googleAdsEnabled && (
                    <Chip 
                      label="Google Ads"
                      color="info"
                      size="small"
                    />
                  )}
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Last processed: {formatLastProcessed(segment.lastProcessed)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {segments.length === 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <GroupIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No segments yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create your first segment to start organizing your data dynamically
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreateSegment}
                >
                  Create Your First Segment
                </Button>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Create/Edit Segment Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingSegment ? 'Edit Segment' : 'Create New Segment'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {/* Basic Info */}
            <TextField
              label="Segment Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />

            <FormControl fullWidth required>
              <InputLabel>Data File</InputLabel>
              <Select
                value={formData.fileId}
                onChange={(e) => setFormData(prev => ({ ...prev, fileId: e.target.value }))}
                label="Data File"
              >
                {files.map((file) => (
                  <MenuItem key={file.id} value={file.id}>
                    {file.filename} ({file.source})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Query Conditions */}
            <Typography variant="h6" sx={{ mt: 2 }}>
              Segment Conditions
            </Typography>

            {formData.query.conditions.map((condition, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  label="Field"
                  value={condition.field}
                  onChange={(e) => updateCondition(index, 'field', e.target.value)}
                  sx={{ flexGrow: 1 }}
                />
                
                <FormControl sx={{ minWidth: 150 }}>
                  <InputLabel>Operator</InputLabel>
                  <Select
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                    label="Operator"
                  >
                    {OPERATORS.map((op) => (
                      <MenuItem key={op.value} value={op.value}>
                        {op.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Value"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                  sx={{ flexGrow: 1 }}
                />

                {formData.query.conditions.length > 1 && (
                  <IconButton onClick={() => removeCondition(index)} color="error">
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            ))}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                startIcon={<AddIcon />}
                onClick={addCondition}
                variant="outlined"
                size="small"
              >
                Add Condition
              </Button>

              {formData.query.conditions.length > 1 && (
                <FormControl size="small">
                  <InputLabel>Logic</InputLabel>
                  <Select
                    value={formData.query.logic}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      query: { ...prev.query, logic: e.target.value }
                    }))}
                    label="Logic"
                  >
                    <MenuItem value="AND">AND</MenuItem>
                    <MenuItem value="OR">OR</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Box>

            {/* Google Ads Integration */}
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.googleAdsEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, googleAdsEnabled: e.target.checked }))}
                  />
                }
                label="Enable Google Ads Sync"
              />

              {formData.googleAdsEnabled && (
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <TextField
                    label="Customer ID"
                    value={formData.googleAdsCustomerId}
                    onChange={(e) => setFormData(prev => ({ ...prev, googleAdsCustomerId: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="List ID"
                    value={formData.googleAdsListId}
                    onChange={(e) => setFormData(prev => ({ ...prev, googleAdsListId: e.target.value }))}
                    fullWidth
                  />
                </Box>
              )}
            </Box>

            {/* Preview */}
            <Box sx={{ mt: 2 }}>
              <Button
                startIcon={<PlayIcon />}
                onClick={handlePreviewSegment}
                variant="outlined"
                disabled={previewLoading || !formData.fileId}
                fullWidth
              >
                {previewLoading ? 'Previewing...' : 'Preview Segment'}
              </Button>

              {previewLoading && <LinearProgress sx={{ mt: 1 }} />}

              {previewData && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    Preview Results: {previewData.count.toLocaleString()} matches
                  </Typography>
                  
                  {previewData.sampleRows.length > 0 ? (
                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {previewData.sampleRows.map((row, index) => (
                        <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 0.5 }}>
                          <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem' }}>
                            {JSON.stringify(row.data, null, 2)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No matching records found
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveSegment} variant="contained">
            {editingSegment ? 'Update' : 'Create'} Segment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Cuttytabs;