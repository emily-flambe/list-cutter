import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';

// Ruby's RADICAL SIMPLICITY: Optimized Material-UI imports for performance
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// Icons for Ruby's clean interface design
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';

/**
 * FilterPanel - Ruby's Lightning-Fast Dynamic Filtering Component
 * 
 * Ruby's RADICAL SIMPLICITY Philosophy:
 * - Build on existing Material-UI patterns from the codebase
 * - Use intelligent data type detection for smart filter suggestions
 * - Simple, clean interface focused on user performance
 * - Reuse API patterns from existing components
 * 
 * Performance Targets: <100ms filter UI response time
 */
const FilterPanel = ({ 
  columns: columnsFromParent, 
  filters: filtersFromParent = [], 
  onFiltersChange,
  updateStrategy,
  isFiltering
}) => {
  const { token } = useContext(AuthContext);
  
  // Component state - use columns from parent if provided
  const [columns, setColumns] = useState(columnsFromParent || []);
  const [filterSuggestions, setFilterSuggestions] = useState({});
  const [fileInfo, setFileInfo] = useState(null);
  const [filters, setFilters] = useState(filtersFromParent || []);
  const [loading, setLoading] = useState(!columnsFromParent || !Array.isArray(columnsFromParent) || columnsFromParent.length === 0);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Update local state when parent columns change
  useEffect(() => {
    if (columnsFromParent && Array.isArray(columnsFromParent) && columnsFromParent.length > 0) {
      setColumns(columnsFromParent);
      setLoading(false);
    }
  }, [columnsFromParent]);

  // Update local filters when parent filters change
  useEffect(() => {
    if (Array.isArray(filtersFromParent)) {
      setFilters(filtersFromParent);
    }
  }, [filtersFromParent]);

  /**
   * RUBY OPTIMIZED: Fast column metadata fetching using new API endpoint
   */
  const fetchColumnMetadata = async () => {
    try {
      setLoading(true);
      setError('');
      
      let apiUrl;
      let headers = {
        'Content-Type': 'application/json'
      };
      
      // Handle demo mode for anonymous users
      if (fileId === 'demo-squirrel' && !token) {
        apiUrl = '/api/v1/public/demo/squirrel/columns';
      } else if (fileId === 'reference-squirrel' && token) {
        apiUrl = '/api/v1/files/reference/squirrel/columns';
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        apiUrl = `/api/v1/files/${fileId}/columns`;
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      const response = await api.get(apiUrl, { headers });

      if (response.data.success) {
        setColumns(response.data.columns);
        setFilterSuggestions(response.data.filterSuggestions || {});
        setFileInfo(response.data.fileInfo);
        
        const isDemoMode = fileId === 'demo-squirrel' && !token;
        console.log(`🐰 Column analysis completed: ${response.data.columns.length} columns ${isDemoMode ? '(demo mode)' : ''}`);
      } else {
        setError('Failed to analyze file columns');
      }
    } catch (err) {
      console.error('Column analysis failed:', err);
      setError(err.response?.data?.message || 'Failed to analyze file columns');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add a new filter to the list
   */
  const addFilter = () => {
    const newFilter = {
      id: Date.now(), // Simple unique ID for UI
      columnName: '',
      filterType: '',
      value: ''
    };
    const updatedFilters = [...filters, newFilter];
    setFilters(updatedFilters);
    notifyFiltersChange(updatedFilters);
  };

  /**
   * Remove a filter from the list
   */
  const removeFilter = (filterId) => {
    const updatedFilters = filters.filter(f => f.id !== filterId);
    setFilters(updatedFilters);
    notifyFiltersChange(updatedFilters);
  };

  /**
   * Update a specific filter
   */
  const updateFilter = (filterId, field, value) => {
    const updatedFilters = filters.map(filter => {
      if (filter.id === filterId) {
        const updated = { ...filter, [field]: value };
        
        // Reset filter type if column changes
        if (field === 'columnName') {
          updated.filterType = '';
          updated.value = '';
        }
        
        return updated;
      }
      return filter;
    });
    
    setFilters(updatedFilters);
    notifyFiltersChange(updatedFilters);
  };

  /**
   * Notify parent component of filter changes
   */
  const notifyFiltersChange = (currentFilters) => {
    if (onFiltersChange) {
      const validFilters = currentFilters.filter(f => 
        f.columnName && f.filterType && f.value
      );
      onFiltersChange(validFilters);
    }
  };

  /**
   * Get available filter types for a column
   */
  const getFilterTypesForColumn = (columnName) => {
    return filterSuggestions[columnName] || [];
  };

  /**
   * Get column data type for UI hints
   */
  const getColumnDataType = (columnName) => {
    const column = columns.find(c => c.name === columnName);
    return column ? column.dataType : 'text';
  };

  /**
   * Get sample values for column to help user
   */
  const getColumnSamples = (columnName) => {
    const column = columns.find(c => c.name === columnName);
    return column ? column.sampleValues.slice(0, 3) : [];
  };

  /**
   * Render individual filter row
   */
  const renderFilter = (filter) => {
    const filterTypes = getFilterTypesForColumn(filter.columnName);
    const dataType = getColumnDataType(filter.columnName);
    const samples = getColumnSamples(filter.columnName);

    return (
      <Grid container spacing={2} key={filter.id} alignItems="center" sx={{ mb: 2 }}>
        <Grid item xs={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Column</InputLabel>
            <Select
              value={filter.columnName}
              label="Column"
              onChange={(e) => updateFilter(filter.id, 'columnName', e.target.value)}
            >
              {columns.map((column) => (
                <MenuItem key={column.name} value={column.name}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{column.name}</span>
                    <Chip 
                      label={column.dataType} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '18px' }}
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Filter Type</InputLabel>
            <Select
              value={filter.filterType}
              label="Filter Type"
              disabled={!filter.columnName}
              onChange={(e) => updateFilter(filter.id, 'filterType', e.target.value)}
            >
              {filterTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.replace('_', ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={4}>
          <TextField
            fullWidth
            size="small"
            label="Value"
            value={filter.value}
            disabled={!filter.filterType}
            onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
            placeholder={samples.length > 0 ? `e.g. ${samples[0]}` : ''}
            helperText={samples.length > 0 ? `Samples: ${samples.join(', ')}` : ''}
          />
        </Grid>

        <Grid item xs={2}>
          <Tooltip title="Remove filter">
            <IconButton 
              onClick={() => removeFilter(filter.id)}
              color="error"
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Grid>
      </Grid>
    );
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>Analyzing column types...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button onClick={fetchColumnMetadata} variant="outlined">
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterListIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            Smart Filters
          </Typography>
          <Tooltip title="AI-powered column type detection for intelligent filtering">
            <IconButton size="small" sx={{ ml: 1 }}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* File info */}
        {fileInfo && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>{fileInfo.filename}</strong> • {fileInfo.totalColumns} columns • {fileInfo.totalRows.toLocaleString()} rows
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {columns.length} columns analyzed with data type detection
            </Typography>
          </Box>
        )}

        {/* Filters section */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Active Filters ({filters.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {filters.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No filters applied. Add filters to narrow down your data.
              </Typography>
            ) : (
              <Box sx={{ mb: 2 }}>
                {filters.map(renderFilter)}
              </Box>
            )}

            <Button
              startIcon={<AddIcon />}
              onClick={addFilter}
              variant="outlined"
              size="small"
            >
              Add Filter
            </Button>
          </AccordionDetails>
        </Accordion>

        {/* Column info section */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Column Information
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {columns.map((column) => (
                <Grid item xs={12} md={6} key={column.name}>
                  <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                        {column.name}
                      </Typography>
                      <Chip 
                        label={column.dataType} 
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Confidence: {(column.confidence * 100).toFixed(0)}% • 
                      Unique values: {column.uniqueValueCount} • 
                      Nulls: {column.nullCount}
                    </Typography>
                    {column.sampleValues.length > 0 && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                        Samples: {column.sampleValues.slice(0, 3).join(', ')}
                      </Typography>
                    )}
                  </Box>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default FilterPanel;