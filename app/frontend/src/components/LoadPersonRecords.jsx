import { useState, useEffect, useContext } from "react";
import { Box, Button, Checkbox, List, ListItem, Typography, Select, MenuItem } from '@mui/material';
import api from '../api';
import { AuthContext } from '../context/AuthContext';

const LoadPersonRecords = () => {
  const [savedFiles, setSavedFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const token = useContext(AuthContext);

  useEffect(() => {
    const fetchSavedFiles = async () => {
      try {
        const response = await api.get('/api/list_cutter/list_saved_files/', {
          headers: { Authorization: `Bearer ${token.token}` }
        });
        setSavedFiles(response.data.files);
      } catch (error) {
        console.error("Error fetching saved files:", error);
        setErrorMessage("Error fetching saved files.");
      }
    };

    fetchSavedFiles();
  }, [token]);

  const handleSavedFileChange = async (event) => {
    const selectedFileID = event.target.value || "";
    setSelectedFileId(selectedFileID);

    if (selectedFileID) {
      try {
        const response = await api.get(
          `/api/list_cutter/fetch_saved_file/${encodeURIComponent(selectedFileID)}`,
          { headers: { Authorization: `Bearer ${token.token}` } }
        );
        setColumns(response.data.columns);
        setErrorMessage("");
      } catch (error) {
        console.error("Error fetching saved file:", error);
        setErrorMessage("Error fetching saved file. Please try again.");
      }
    }
  };

  const handleColumnSelection = (event) => {
    const { value, checked } = event.target;
    setSelectedColumns(prev =>
      checked ? [...prev, value] : prev.filter(col => col !== value)
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Load Person Records
      </Typography>
      {errorMessage && <Typography color="error">{errorMessage}</Typography>}
      <Box sx={{ mb: 2 }}>
      <Select
        value={selectedFileId}
        onChange={handleSavedFileChange}
        displayEmpty
        renderValue={(value) => {
            if (value === "") {
            return <span style={{ color: 'var(--primary-text)' }}>Select a saved file</span>;
            }
            const file = savedFiles.find(file => file.file_id === value);
            return <span style={{ color: 'var(--secondary-text)' }}>{file?.file_name}</span>;
        }}
        sx={{ mr: 2 }}
        MenuProps={{
            PaperProps: { sx: { '& .MuiMenuItem-root': { color: 'var(--secondary-text)' } } },
            MenuListProps: { 'aria-hidden': false },
        }}
        >
        <MenuItem value="" disabled>
            Select a saved file
        </MenuItem>
        {savedFiles.map((file, index) => (
            <MenuItem key={index} value={file.file_id}>
            {file.file_name}
            </MenuItem>
        ))}
        </Select>
      </Box>

      {columns.length > 0 && (
        <List>
          {columns.map((col, index) => (
            <ListItem key={index} sx={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox
                checked={selectedColumns.includes(col)}
                onChange={handleColumnSelection}
                value={col}
              />
              <Typography sx={{ minWidth: 75, mr: 1 }}>{col}</Typography>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default LoadPersonRecords; 