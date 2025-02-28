import React, { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { Box, Typography, List, ListItem } from '@mui/material';

const FileLineage = () => {
  const { fileId } = useParams(); // Get the file ID from the URL parameters
  const { token } = useContext(AuthContext);
  const [lineage, setLineage] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLineage = async () => {
      try {
        const response = await api.get(`/api/list_cutter/file_lineage/${fileId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLineage(response.data.lineage);
      } catch (err) {
        console.error("Error fetching file lineage:", err);
        setError("Failed to fetch file lineage.");
      }
    };

    fetchLineage();
  }, [fileId, token]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        File Lineage for File ID: {fileId}
      </Typography>
      {error && <Typography color="error">{error}</Typography>}
      <List>
        {lineage.map((file) => (
          <ListItem key={file.file_id}>
            <Typography>
              File ID: {file.file_id} - File Name: {file.file_name}
            </Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default FileLineage; 