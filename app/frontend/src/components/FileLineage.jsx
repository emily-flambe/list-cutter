import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { Box, Typography, MenuItem, Select, Button, CircularProgress } from '@mui/material';
import { ArcherContainer, ArcherElement } from 'react-archer';

const FileLineageArcher = () => {
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

  // For simplicity, assume lineage.nodes is an ordered array representing a chain
  const renderLineageChain = () => {
    if (!lineage || !lineage.nodes || lineage.nodes.length === 0) return null;

    return (
      <ArcherContainer strokeColor="gray">
        <Box sx={{ display: 'flex', alignItems: 'center', overflowX: 'auto', p: 2 }}>
          {lineage.nodes.map((node, index) => (
            <ArcherElement
              key={node.file_id}
              id={node.file_id}
              relations={
                index < lineage.nodes.length - 1
                  ? [
                      {
                        targetId: lineage.nodes[index + 1].file_id,
                        targetAnchor: 'left',
                        sourceAnchor: 'right',
                        style: { strokeColor: 'gray', strokeWidth: 2 },
                      },
                    ]
                  : []
              }
            >
              <Box
                sx={{
                  p: 1,
                  m: 1,
                  minWidth: 150,
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  backgroundColor: node.file_id === selectedFileId ? 'yellow' : 'lightgray',
                  textAlign: 'center',
                }}
              >
                <Typography variant="body1">{node.file_name}</Typography>
              </Box>
            </ArcherElement>
          ))}
        </Box>
      </ArcherContainer>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        File Lineage Archer Visualization
      </Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Select
          value={selectedFileId}
          onChange={(e) => setSelectedFileId(e.target.value)}
          sx={{ minWidth: 200, mr: 2 }}
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
      </Box>
      {loading && <CircularProgress />}
      {lineage && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Lineage Chain:
          </Typography>
          {renderLineageChain()}
        </Box>
      )}
    </Box>
  );
};

export default FileLineageArcher;
