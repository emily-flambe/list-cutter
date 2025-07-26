// frontend/src/components/ManageFiles.jsx
import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
// Optimized direct imports for better tree-shaking and build performance
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import TableHead from '@mui/material/TableHead';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';

const ManageFiles = () => {
  const { token } = useContext(AuthContext);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await api.get('/api/v1/files', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFiles(response.data.files || []);
        setError("");
      } catch (err) {
        console.error("Error fetching files:", err);
        setError("Failed to load your files. Please try again.");
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchFiles();
    } else {
      setLoading(false);
      setError("You must be logged in to view your files.");
    }
  }, [token]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const downloadFile = async (fileId, filename) => {
    setDownloadingFileId(fileId);
    try {
      const response = await api.get(`/api/v1/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      // Create a URL for the file and trigger the download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccessMessage(`Successfully downloaded ${filename}`);
    } catch (error) {
      console.error("Download error:", error);
      if (error.response?.status === 404) {
        setError("File not found. It may have been deleted.");
        // Remove file from list if it doesn't exist
        setFiles(files.filter(f => f.id !== fileId));
      } else {
        setError("Failed to download the file. Please try again.");
      }
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleDeleteClick = (file) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    
    setDeletingFileId(fileToDelete.id);
    setDeleteDialogOpen(false);
    
    try {
      await api.delete(`/api/v1/files/${fileToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Remove file from list
      setFiles(files.filter(f => f.id !== fileToDelete.id));
      setSuccessMessage(`Successfully deleted ${fileToDelete.filename}`);
    } catch (error) {
      console.error("Delete error:", error);
      setError("Failed to delete the file. Please try again.");
    } finally {
      setDeletingFileId(null);
      setFileToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setFileToDelete(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Manage Files
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {files.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CloudUploadIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No files yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your CSV files will appear here once you create them.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>File Name</TableCell>
                <TableCell align="right">Size</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DescriptionIcon fontSize="small" color="action" />
                      <Typography>{file.filename}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{formatFileSize(file.size)}</TableCell>
                  <TableCell>{formatDate(file.createdAt)}</TableCell>
                  <TableCell>
                    <Chip 
                      label={file.source === 'synthetic-data' ? 'Synthetic Data' : 'Upload'} 
                      size="small" 
                      color={file.source === 'synthetic-data' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Tooltip title="Download">
                        <IconButton
                          color="primary"
                          onClick={() => downloadFile(file.id, file.filename)}
                          disabled={downloadingFileId === file.id}
                        >
                          {downloadingFileId === file.id ? (
                            <CircularProgress size={24} />
                          ) : (
                            <DownloadIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteClick(file)}
                          disabled={deletingFileId === file.id}
                        >
                          {deletingFileId === file.id ? (
                            <CircularProgress size={24} />
                          ) : (
                            <DeleteIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{fileToDelete?.filename}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageFiles;