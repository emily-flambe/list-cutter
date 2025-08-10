import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';

// Simple Material-UI imports
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

// Icons
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';

/**
 * DEAD SIMPLE FilterPanel - Start over approach
 * 1. Click "Add Filter" 
 * 2. Show dropdown with all column names
 * 3. User picks one
 * That's it for now.
 */
const FilterPanel = ({ 
  columns: columnsFromParent, 
  filters: filtersFromParent = [], 
  onFiltersChange,
  onApplyFilters,
  isFiltering
}) => {
  const { token } = useContext(AuthContext);
  
  // Simple state
  const [columns, setColumns] = useState([]);
  const [filters, setFilters] = useState([]);
  const [columnSearch, setColumnSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Update columns when parent provides them
  useEffect(() => {
    console.log('🟢 FilterPanel got columns:', columnsFromParent?.length);
    
    if (columnsFromParent && Array.isArray(columnsFromParent) && columnsFromParent.length > 0) {
      console.log('🟢 Setting columns:', columnsFromParent.length);
      setColumns(columnsFromParent);
      setLoading(false);
      setError('');
    }
  }, [columnsFromParent]);
  
  // Add a new filter - SIMPLE VERSION
  const addFilter = (columnName = '') => {
    console.log('🟢 Adding filter for column:', columnName);
    const newFilter = {
      id: Date.now(),
      selectedColumn: columnName, // Pre-select the column if provided
      column: columnName,
      operator: 'contains',
      value: ''
    };
    const updatedFilters = [...filters, newFilter];
    setFilters(updatedFilters);
    console.log('🟢 Filters now:', updatedFilters.length);
    
    // Notify parent component about filter changes
    if (onFiltersChange) {
      onFiltersChange(updatedFilters);
    }
  };
  
  // Remove filter
  const removeFilter = (filterId) => {
    const updatedFilters = filters.filter(f => f.id !== filterId);
    setFilters(updatedFilters);
    
    // Notify parent component about filter changes
    if (onFiltersChange) {
      onFiltersChange(updatedFilters);
    }
  };
  
  // Update filter column selection
  const updateFilterColumn = (filterId, columnName) => {
    console.log('🟢 Updating filter', filterId, 'to column:', columnName);
    const updatedFilters = filters.map(filter => {
      if (filter.id === filterId) {
        return { ...filter, selectedColumn: columnName, column: columnName };
      }
      return filter;
    });
    setFilters(updatedFilters);
    
    // Notify parent component about filter changes
    if (onFiltersChange) {
      onFiltersChange(updatedFilters);
    }
  };
  
  // Update filter operator
  const updateFilterOperator = (filterId, operator) => {
    console.log('🟢 Updating filter', filterId, 'operator to:', operator);
    const updatedFilters = filters.map(filter => {
      if (filter.id === filterId) {
        // Clear value when switching to is_empty or is_not_empty
        const newValue = (operator === 'is_empty' || operator === 'is_not_empty') ? '' : filter.value;
        return { ...filter, operator, value: newValue };
      }
      return filter;
    });
    setFilters(updatedFilters);
    
    // Notify parent component about filter changes
    if (onFiltersChange) {
      onFiltersChange(updatedFilters);
    }
  };
  
  // Update filter value
  const updateFilterValue = (filterId, value) => {
    console.log('🟢 Updating filter', filterId, 'value to:', value);
    const updatedFilters = filters.map(filter => {
      if (filter.id === filterId) {
        return { ...filter, value };
      }
      return filter;
    });
    setFilters(updatedFilters);
    
    // Notify parent component about filter changes
    if (onFiltersChange) {
      onFiltersChange(updatedFilters);
    }
  };
  
  // Show loading state
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography>Loading columns...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
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
            Simple Filters
          </Typography>
        </Box>
        
        {/* Filters section */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1">
                Active Filters ({filters.length})
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => onApplyFilters && onApplyFilters()}
                sx={{ mr: 2 }}
              >
                Apply Filters
              </Button>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {filters.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                Click the + next to columns below to configure filters for them.<br />Or you could not
              </Typography>
            ) : (
              <Box sx={{ mb: 2 }}>
                {filters.map((filter) => (
                  <Box key={filter.id} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5, 
                    mb: 2,
                    flexWrap: 'wrap'
                  }}>
                    <Tooltip title="Remove filter">
                      <IconButton 
                        onClick={() => removeFilter(filter.id)}
                        color="error"
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Select Column</InputLabel>
                      <Select
                        value={filter.selectedColumn}
                        label="Select Column"
                        onChange={(e) => updateFilterColumn(filter.id, e.target.value)}
                      >
                        {columns.map((column) => (
                          <MenuItem key={column.name} value={column.name}>
                            {column.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={filter.operator}
                        label="Operator"
                        onChange={(e) => updateFilterOperator(filter.id, e.target.value)}
                      >
                        <MenuItem value="equals">Equals</MenuItem>
                        <MenuItem value="not_equals">Not Equals</MenuItem>
                        <MenuItem value="contains">Contains</MenuItem>
                        <MenuItem value="not_contains">Not Contains</MenuItem>
                        <MenuItem value="starts_with">Starts With</MenuItem>
                        <MenuItem value="ends_with">Ends With</MenuItem>
                        <MenuItem value="is_empty">Is Empty</MenuItem>
                        <MenuItem value="is_not_empty">Is Not Empty</MenuItem>
                      </Select>
                    </FormControl>
                    
                    {filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' && (
                      <TextField
                        size="small"
                        label="Value"
                        value={filter.value}
                        onChange={(e) => updateFilterValue(filter.id, e.target.value)}
                        sx={{ minWidth: 180 }}
                      />
                    )}
                  </Box>
                ))}
              </Box>
            )}

          </AccordionDetails>
        </Accordion>

        {/* Column info section - Always expanded */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {/* Search box */}
            <TextField
              size="small"
              placeholder="Search columns..."
              value={columnSearch}
              onChange={(e) => setColumnSearch(e.target.value)}
              sx={{ 
                mb: 2, 
                '& input': { textAlign: 'left' },
                '& .MuiInputBase-input::placeholder': { textAlign: 'left' }
              }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {columns
                .filter(column => column.name.toLowerCase().includes(columnSearch.toLowerCase()))
                .map((column, index) => (
                <Box 
                  key={column.name}
                  sx={{ 
                    p: 1.5, 
                    border: 1, 
                    borderColor: 'divider', 
                    borderRadius: 1,
                    backgroundColor: index % 2 === 0 ? 'background.default' : 'background.paper',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1
                  }}
                >
                  {/* Add filter button */}
                  <IconButton
                    size="small"
                    onClick={() => addFilter(column.name)}
                    sx={{ 
                      mt: -0.5,
                      color: 'primary.main',
                      '&:hover': { backgroundColor: 'primary.main', color: 'white' }
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                  
                  {/* Column details - narrower to make room for + button */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 500, textAlign: 'left' }}>
                      {column.name}
                    </Typography>
                    <Chip 
                      label={column.dataType || 'text'} 
                      size="small" 
                      color="primary"
                      variant="outlined"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Unique: <Box component="span" sx={{ fontWeight: 400, color: 'text.primary' }}>
                        {column.uniqueValueCount || 'N/A'}
                      </Box>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Nulls: <Box component="span" sx={{ fontWeight: 400, color: 'text.primary' }}>
                        {column.nullCount || 0}
                      </Box>
                    </Typography>
                    {(column.sampleValues || []).length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ 
                        flex: 1, 
                        fontWeight: 500,
                        minWidth: '200px',
                        textAlign: 'right'
                      }}>
                        Example Values: <Box component="span" sx={{ 
                          fontWeight: 400, 
                          fontStyle: 'italic',
                          color: 'text.primary'
                        }}>
                          {(column.sampleValues || []).slice(0, 2).join(', ')}
                        </Box>
                      </Typography>
                    )}
                  </Box>
                </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default FilterPanel;