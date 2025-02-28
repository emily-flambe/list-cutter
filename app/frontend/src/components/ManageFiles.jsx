// frontend/src/components/ManageFiles.jsx
import React, { useEffect, useState, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { Typography, Box, List, ListItem, ListItemText, CircularProgress, Table, TableBody, TableCell, TableRow, Button, TableHead, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, Chip, InputLabel, FormControl } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const ManageFiles = () => {
  const { token } = useContext(AuthContext);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'file_name', direction: 'ascending' });
  const [searchQuery, setSearchQuery] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [newTag, setNewTag] = useState("");
  const [selectedSystemTags, setSelectedSystemTags] = useState([]);
  const [selectedUserTags, setSelectedUserTags] = useState([]);

  useEffect(() => {
    const fetchSavedFiles = async () => {
      try {
        const response = await api.get('/api/list_cutter/list_saved_files/', {
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
      fetchSavedFiles();
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

  const uniqueSystemTags = [...new Set(files.flatMap(file => file.system_tags || []))];
  const uniqueUserTags = [...new Set(files.flatMap(file => file.user_tags || []))];

  const filteredFiles = sortedFiles.filter(file => 
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedSystemTags.length === 0 || file.system_tags?.some(tag => selectedSystemTags.includes(tag))) &&
    (selectedUserTags.length === 0 || file.user_tags?.some(tag => selectedUserTags.includes(tag)))
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

  const deleteFile = async (fileId) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        await api.delete(`/api/list_cutter/delete/${fileId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFiles(files.filter(file => file.id !== fileId)); // Update the state to remove the deleted file
      } catch (error) {
        console.error("Delete error:", error);
        alert("Failed to delete the file.");
      }
    }
  };

  const handleAddTagClick = (fileId) => {
    setSelectedFileId(fileId);
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setNewTag("");
  };

  const handleAddTag = async () => {
    if (!newTag) return;

    try {
      await api.patch(`/api/list_cutter/update_tags/${selectedFileId}/`, {
        user_tags: [newTag]
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles(files.map(file => 
        file.id === selectedFileId ? { 
          ...file, 
          user_tags: Array.isArray(file.user_tags) ? [...file.user_tags, newTag] : [newTag] // Ensure user_tags is an array
        } : file
      ));
      handleDialogClose();
    } catch (error) {
      console.error("Error adding tag:", error);
      alert("Failed to add the tag.");
    }
  };

  return (
    <Box sx={{ textAlign: 'left', marginTop: '50px' }}>
      <Typography variant="h3">Manage Files</Typography>
      <br/><br/>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', marginBottom: '10px' }}>
        <TextField
          variant="outlined"
          placeholder="Search by filename"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ marginRight: '10px' }}
        />
        <FormControl sx={{ marginRight: '10px', minWidth: 200 }}>
          <InputLabel>System Tags</InputLabel>
          <Select
            multiple
            value={selectedSystemTags}
            onChange={(e) => setSelectedSystemTags(e.target.value)}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} sx={{ margin: 0.5 }} />
                ))}
              </Box>
            )}
          >
            {uniqueSystemTags.map((tag) => (
              <MenuItem key={tag} value={tag}>
                <Typography variant="body2" color="text.secondary">{tag}</Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>User Tags</InputLabel>
          <Select
            multiple
            value={selectedUserTags}
            onChange={(e) => setSelectedUserTags(e.target.value)}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} sx={{ margin: 0.5 }} />
                ))}
              </Box>
            )}
          >
            {uniqueUserTags.map((tag) => (
              <MenuItem key={tag} value={tag}>
                <Typography variant="body2" color="text.secondary">{tag}</Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ textAlign: 'left', marginBottom: '10px' }}>
        <Typography variant="body2" style={{ fontStyle: 'italic' }}>
          Click on any column heading to sort files 💁‍♀️
        </Typography>
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Table sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell onClick={() => requestSort('file_name')} style={{ cursor: 'pointer' }}>
                <Typography variant="h6" fontWeight="bold" fontSize="0.9rem">
                  File Name {sortConfig.key === 'file_name' && (sortConfig.direction === 'ascending' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />)}
                </Typography>
              </TableCell>
              <TableCell onClick={() => requestSort('uploaded_at')} style={{ cursor: 'pointer' }}>
                <Typography variant="h6" fontWeight="bold" fontSize="0.9rem">
                  Created At {sortConfig.key === 'uploaded_at' && (sortConfig.direction === 'ascending' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />)}
                </Typography>
              </TableCell>         
              <TableCell onClick={() => requestSort('system_tags')} style={{ cursor: 'pointer' }}>
                <Typography variant="h6" fontWeight="bold" fontSize="0.9rem">
                  System Tags {sortConfig.key === 'system_tags' && (sortConfig.direction === 'ascending' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />)}
                </Typography>
              </TableCell>
              <TableCell onClick={() => requestSort('user_tags')} style={{ cursor: 'pointer' }}>
                <Typography variant="h6" fontWeight="bold" fontSize="0.9rem">
                  User Tags {sortConfig.key === 'user_tags' && (sortConfig.direction === 'ascending' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />)}
                </Typography>
              </TableCell>
              <TableCell onClick={() => requestSort('user_tags')} style={{ cursor: 'pointer' }}>
                <Typography variant="h6" fontWeight="bold" fontSize="0.9rem">
                  Metadata {sortConfig.key === 'user_tags' && (sortConfig.direction === 'ascending' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />)}
                </Typography>
              </TableCell>
              <TableCell>
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
                  <TableCell className="table-cell" style={{ padding: '4px 8px', minWidth: '150px' }}>{file.file_name}</TableCell>
                  <TableCell className="table-cell" style={{ padding: '4px 8px', minWidth: '150px' }}>{file.uploaded_at.slice(0, 16).replace('T', ' ')}</TableCell>
                  <TableCell className="table-cell" style={{ padding: '4px 8px', minWidth: '150px' }}>{file.system_tags ? file.system_tags.join(', ') : ''}</TableCell>
                  <TableCell className="table-cell" style={{ padding: '4px 8px', minWidth: '150px' }}>{file.user_tags ? file.user_tags.join(', ') : ''}</TableCell>
                  <TableCell className="table-cell" style={{ padding: '4px 8px', minWidth: '150px' }}>{file.metadata ? JSON.stringify(JSON.parse(file.metadata), null, 2) : ''}</TableCell>
                  <TableCell>
                    <Button variant="contained" color="primary" onClick={() => handleAddTagClick(file.id)}>
                      Add Tag
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button variant="contained" color="primary" onClick={() => downloadFile(file.file_name)}>
                      Download
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button variant="contained" color="error" onClick={() => deleteFile(file.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="table-cell" style={{ padding: '4px 8px', minWidth: '150px' }}>No files found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <Dialog open={openDialog} onClose={handleDialogClose}>
        <DialogTitle sx={{ color: 'text.secondary' }}>Add Tag</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Tag Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            InputProps={{
              style: { color: 'rgba(0, 0, 0, 0.54)' }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleAddTag} color="primary">
            Add Tag
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManageFiles;
