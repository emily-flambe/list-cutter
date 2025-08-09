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
  updateStrategy,
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
    };
    const updatedFilters = [...filters, newFilter];
    setFilters(updatedFilters);
    console.log('🟢 Filters now:', updatedFilters.length);
  };
  
  // Remove filter
  const removeFilter = (filterId) => {
    const updatedFilters = filters.filter(f => f.id !== filterId);
    setFilters(updatedFilters);
  };
  
  // Update filter column selection
  const updateFilterColumn = (filterId, columnName) => {
    console.log('🟢 Updating filter', filterId, 'to column:', columnName);
    const updatedFilters = filters.map(filter => {
      if (filter.id === filterId) {
        return { ...filter, selectedColumn: columnName };
      }
      return filter;
    });
    setFilters(updatedFilters);
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
            <Typography variant="subtitle1">
              Active Filters ({filters.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            {filters.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                Click the + next to columns below to configure filters for them.<br />Or you could not
              </Typography>
            ) : (
              <Box sx={{ mb: 2 }}>
                {filters.map((filter) => (
                  <Box key={filter.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <FormControl sx={{ minWidth: 200 }}>
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
                    
                    {filter.selectedColumn && (
                      <Typography variant="body2" color="success.main">
                        ✓ Column selected: {filter.selectedColumn}
                      </Typography>
                    )}
                    
                    <Tooltip title="Remove filter">
                      <IconButton 
                        onClick={() => removeFilter(filter.id)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
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