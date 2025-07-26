// frontend/src/components/ManageFiles.jsx
import React, { useEffect, useState, useContext, useRef } from 'react';
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
import LinearProgress from '@mui/material/LinearProgress';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Link } from 'react-router-dom';
import cuttyLogo from '../assets/cutty_logo.png';

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
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
      const fileExtension = file.name.toLowerCase().split('.').pop();
      const validExtensions = ['csv', 'txt', 'tsv'];
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        setError("Please select a CSV file (.csv, .txt, or .tsv)");
        return;
      }
      
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setError("File size must be less than 50MB");
        return;
      }
      
      setSelectedFile(file);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    setUploading(true);
    setError("");
    
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await api.post('/api/v1/files/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setSuccessMessage(`Successfully uploaded ${selectedFile.name}`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      // Refresh the file list
      const filesResponse = await api.get('/api/v1/files', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles(filesResponse.data.files || []);
    } catch (error) {
      console.error("Upload error:", error);
      setError(error.response?.data?.error || "Failed to upload file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show special logged-out state
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
            YOU ARE NOT LOGGED IN.
          </Typography>
          
          {/* REALLY BIG Cutty - on the right */}
          <Box
            component="img"
            src={cuttyLogo}
            alt="Angry Cutty"
            sx={{
              width: { xs: '380px', sm: '450px', md: '500px', lg: '520px' },
              height: 'auto',
              flexShrink: 0,
              transform: 'scaleX(-1)',
              filter: 'hue-rotate(0deg) saturate(2) brightness(1.2) drop-shadow(0 0 30px #ff0000) drop-shadow(0 0 60px #ff0000)',
              '@keyframes redGlow': {
                '0%': {
                  filter: 'hue-rotate(0deg) saturate(2) brightness(1.2) drop-shadow(0 0 30px #ff0000) drop-shadow(0 0 60px #ff0000)'
                },
                '100%': {
                  filter: 'hue-rotate(0deg) saturate(2) brightness(1.5) drop-shadow(0 0 50px #ff0000) drop-shadow(0 0 100px #ff0000)'
                }
              },
              animation: 'redGlow 2s ease-in-out infinite alternate'
            }}
          />
        </Box>

        {/* Bottom Row: Smaller Cutty and Login Options */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 2,
          justifyContent: 'flex-start',
          width: '100%',
          maxWidth: '900px',
          pl: 2
        }}>
          {/* Smaller Cutty */}
          <Box
            component="img"
            src={cuttyLogo}
            alt="Cutty"
            sx={{
              width: '60px',
              height: 'auto'
            }}
          />
          
          {/* Login message and buttons */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="body1" sx={{ color: 'var(--primary-text)', mb: 2, fontSize: '1.1rem' }}>
              log in or sign up here!
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
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
                color="primary" 
                component={Link} 
                to="/register"
                sx={{ minWidth: '120px' }}
              >
                Sign Up
              </Button>
            </Box>
          </Box>
        </Box>
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

      {/* Upload Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Upload New File
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadFileIcon />}
            disabled={uploading}
            sx={{ minWidth: '140px' }}
          >
            Choose File
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".csv,.txt,.tsv,text/csv,text/plain,application/vnd-ms-excel"
              onChange={handleFileSelect}
            />
          </Button>
          
          {selectedFile && (
            <Typography variant="body2" sx={{ flex: 1 }}>
              Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </Typography>
          )}
          
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
            sx={{ minWidth: '120px' }}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </Box>
        
        {selectedFile && (
          <Box sx={{ 
            p: 2, 
            backgroundColor: 'action.hover', 
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Selected:</strong> {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </Typography>
          </Box>
        )}
        
        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
          </Box>
        )}
      </Paper>

      {files.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CloudUploadIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No files yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload a CSV file above or generate synthetic data to get started.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>File Name</TableCell>
                <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Size</TableCell>
                <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Created</TableCell>
                <TableCell sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Source</TableCell>
                <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DescriptionIcon fontSize="small" color="action" />
                      <Typography sx={{ fontSize: '0.75rem' }}>{file.filename}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem' }}>{formatFileSize(file.size)}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem' }}>{formatDate(file.createdAt)}</TableCell>
                  <TableCell>
                    <Chip 
                      label={file.source === 'synthetic-data' ? 'Synthetic Data' : 'Upload'} 
                      size="small" 
                      color={file.source === 'synthetic-data' ? 'primary' : 'secondary'}
                      sx={{ fontSize: '0.65rem', height: '20px' }}
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