// frontend/src/components/ManageFiles.jsx
import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { Typography, Box, List, ListItem, ListItemText, CircularProgress, Table, TableBody, TableCell, TableRow, Button, TableHead, TextField } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const ManageFiles = () => {
  const { token } = useContext(AuthContext);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'file_name', direction: 'ascending' });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchUploadedFiles = async () => {
      try {
        const response = await api.get('/api/list_cutter/list_uploaded_files/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFiles(response.data.files);
      } catch (err) {
        setError("Failed to fetch uploaded files.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchUploadedFiles();
    } else {
      setLoading(false);
      setError("You must be logged in to view uploaded files.");
    }
  }, [token]);

  const sortedFiles = [...files].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'ascending' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'ascending' ? 1 : -1;
    }
    return 0;
  });

  const filteredFiles = sortedFiles.filter(file => 
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const downloadFile = async (fileName) => {
    try {
      const response = await api.get(`/api/list_cutter/download/${fileName}/`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob', // Important for handling binary data
      });

      // Create a URL for the file and trigger the download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName); // Set the file name for download
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download the file.");
    }
  };

  return (
    <Box sx={{ textAlign: 'center', marginTop: '50px' }}>
      <Typography variant="h3">Manage Files</Typography>
      <br/><br/>
      <Box sx={{ textAlign: 'left', marginBottom: '20px' }}>
        <TextField
          variant="outlined"
          placeholder="Search by filename"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Box>
      <Box sx={{ textAlign: 'left', marginBottom: '10px' }}>
        <Typography variant="body2" style={{ fontStyle: 'italic' }}>
          Click on any column heading to sort files 💁‍♀️
        </Typography>
      </Box>
      <Table sx={{ marginTop: '20px' }}>
        <TableHead>
          <TableRow>
            <TableCell onClick={() => requestSort('file_name')} style={{ cursor: 'pointer' }}>
              <Typography variant="h6" fontWeight="bold">File Name {sortConfig.key === 'file_name' && (sortConfig.direction === 'ascending' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />)}</Typography>
            </TableCell>
            <TableCell onClick={() => requestSort('uploaded_at')} style={{ cursor: 'pointer' }}>
              <Typography variant="h6" fontWeight="bold">Uploaded At {sortConfig.key === 'uploaded_at' && (sortConfig.direction === 'ascending' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />)}</Typography>
            </TableCell>
            <TableCell>
            </TableCell>
            <TableCell>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredFiles.length > 0 ? (
            filteredFiles.map(file => (
              <TableRow key={file.id}>
                <TableCell>{file.file_name}</TableCell>
                <TableCell>{file.uploaded_at.slice(0, 16).replace('T', ' ')}</TableCell>
                <TableCell>
                  <Button variant="contained" color="primary" onClick={() => downloadFile(file.file_name)}>
                    Download
                  </Button>
                </TableCell>
                <TableCell>
                  <Button variant="contained" color="error" onClick={() => alert('Delete functionality not implemented yet.')}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3}>No files uploaded.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
};

export default ManageFiles;
