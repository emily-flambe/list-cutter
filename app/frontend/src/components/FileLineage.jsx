import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { Box, Typography, MenuItem, Select, Button, CircularProgress } from '@mui/material';

const FileLineageMinimal = () => {
  const { token } = useContext(AuthContext);
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [lineage, setLineage] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch list of saved files when component mounts
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await api.get('/api/list_cutter/list_saved_files/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFiles(response.data.files);
        if (response.data.files.length > 0) {
          setSelectedFileId(response.data.files[0].file_id);
        }
      } catch (err) {
        console.error('Error fetching saved files:', err);
        setError('Failed to fetch saved files.');
      }
    };
    fetchFiles();
  }, [token]);

  const handleFetchLineage = async () => {
    if (!selectedFileId) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/list_cutter/fetch_file_lineage/${selectedFileId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLineage(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching file lineage:', err);
      setError('Failed to fetch file lineage.');
      setLineage(null);
    }
    setLoading(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        File Lineage Minimal
      </Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Select
        value={selectedFileId}
        onChange={(e) => {
          const newSelectedFileId = e.target.value;
          setSelectedFileId(newSelectedFileId);
          console.log('Selected File ID:', newSelectedFileId);
        }}
        sx={{ minWidth: 200, mb: 2 }}
      >
        {files.map((file) => (
          <MenuItem key={file.file_id} value={file.file_id}>
            {file.file_name}
          </MenuItem>
        ))}
      </Select>
      <Button variant="contained" onClick={handleFetchLineage}>
        Fetch Lineage
      </Button>
      {loading && <CircularProgress sx={{ mt: 2 }} />}
      {lineage && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">Lineage Data:</Typography>
          <pre>{JSON.stringify(lineage, null, 2)}</pre>
        </Box>
      )}
    </Box>
  );
};

export default FileLineageMinimal;
