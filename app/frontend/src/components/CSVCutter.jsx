import { useState, useRef, useEffect } from "react";
// Optimized direct imports for better tree-shaking and build performance
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { Upload as UploadIcon, ExpandMore as ExpandMoreIcon, Download as DownloadIcon, Save as SaveIcon, ContentCut as ContentCutIcon, FolderOpen as FolderOpenIcon } from '@mui/icons-material';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';
import cuttyLogo from '../assets/cutty_logo.png';

const MAX_FILE_SIZE = Number(import.meta.env.VITE_MAX_FILE_SIZE) || 10 * 1024 * 1024;
const MAX_FILE_SIZE_MB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(2);

const CSVCutter = () => {
  const [file, setFile] = useState(null);
  const [fileInfo, setFileInfo] = useState("");
  const [isFileValid, setIsFileValid] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filters, setFilters] = useState({});
  const [filePath, setFilePath] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSaveField, setShowSaveField] = useState(false);
  const [filename, setFilename] = useState("");
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [userFiles, setUserFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [fileSource, setFileSource] = useState("upload"); // "upload" or "saved"
  const fileInputRef = useRef(null);
  const token = useContext(AuthContext);

  // Load user's files when component mounts if authenticated
  useEffect(() => {
    if (token.token) {
      loadUserFiles();
    }
  }, [token.token]);

  const loadUserFiles = async () => {
    try {
      const response = await api.get('/api/v1/files/');
      setUserFiles(response.data.files || []);
    } catch (error) {
      console.error('Error loading user files:', error);
    }
  };


  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    setRowCount(0);
    setFileInfo(selectedFile ? `${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)` : "");

    // Validate file type and size
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
        setErrorMessage("Invalid file type. Please upload a CSV file.");
        setIsFileValid(false);
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        setErrorMessage(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
        setIsFileValid(false);
        return;
      }
      setErrorMessage("");
      setIsFileValid(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split('\n').length - 1;
        setRowCount(rows);
        setFileInfo(`${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`);
      };
      reader.readAsText(selectedFile);
    } else {
      setIsFileValid(false);
    }

    setColumns([]);
    setSelectedColumns([]);
    setFilters({});
    setDownloadUrl("");
    setFilePath("");
    setShowPopup(false);
  };

  const handleUpload = async () => {
    // Handle loading from saved files
    if (fileSource === "saved" && selectedFileId) {
      try {
        // Get file columns/fields from the backend
        const response = await api.get(`/api/v1/files/${selectedFileId}/fields`);
        setColumns(response.data.fields || []);
        setFilePath(selectedFileId);
        setErrorMessage("");
        
        // Update row count if available
        if (response.data.rowCount) {
          setRowCount(response.data.rowCount);
        }
      } catch (error) {
        console.error("Error loading file:", error);
        setErrorMessage("Error loading file. Please try again.");
      }
      return;
    }

    // Original upload logic for new files
    if (!file) {
      setErrorMessage("Please select a file.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Invalid file type. Please upload a CSV file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post(
        `/api/v1/files/process`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setColumns(response.data.columns);
      setFilePath(response.data.file_path || "");
      setErrorMessage("");

      // Set file info with the original row count
      setFileInfo(`${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (error) {
      console.error("Error uploading file:", error);
      if (error.response && error.response.status === 400 && error.response.data.error.includes("File size exceeds")) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage("Error uploading file. Please try again.");
      }
    }
  };

  const handleColumnSelection = (event) => {
    const { value, checked } = event.target;
    setSelectedColumns((prev) =>
      checked ? [...prev, value] : prev.filter((col) => col !== value)
    );
  };

  const handleFilterChange = (column, value) => {
    setFilters((prev) => ({ ...prev, [column]: value }));
  };

  const handleCutList = async () => {
    if (selectedColumns.length === 0) {
      return alert("Please select at least one column to cut.");
    }
    if (!filePath) {
      return alert("File path is not available.");
    }

    try {
      console.log('Cutting list with columns:', selectedColumns, 'and filters:', filters);
      const exportUrl = `/api/v1/files/export`;
      const response = await api.post(
        exportUrl,
        { columns: selectedColumns, file_path: filePath, filters },
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setShowSaveField(false);
      // Initialize filename with a default value
      const baseFilename = file?.name ? file.name.split('.csv')[0] : 'filtered';
      setFilename(`${baseFilename}_cut_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`);
      console.log('Cut list successful, download URL created');
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Error exporting CSV");
    }
  };

  const handleSaveToMyFiles = async () => {
    console.log('handleSaveToMyFiles called');
    console.log('Token:', !!token.token);
    console.log('Filename:', filename);
    console.log('FilePath:', filePath);
    console.log('Selected Columns:', selectedColumns);
    
    if (!token.token) {
      setShowLoginMessage(true);
      return;
    }
    
    if (!filename || filename.trim() === '') {
      alert("Please provide a filename.");
      return;
    }

    if (!filePath) {
      alert("Please process or select a file first.");
      return;
    }

    if (selectedColumns.length === 0) {
      alert("Please select at least one column.");
      return;
    }

    const formData = new FormData();
    formData.append("filename", filename.trim());
    formData.append("file_path", filePath); // The file ID from the process endpoint
    formData.append("columns", JSON.stringify(selectedColumns));
    formData.append("filters", JSON.stringify(filters));

    // Create metadata object
    const metadata = {
        generated_file_details: {
            source_file: file?.name || 'unknown',
            columns: selectedColumns,
            column_filters: {}
        }
    };

    // Populate column_filters with the filters applied
    selectedColumns.forEach(col => {
        metadata.generated_file_details.column_filters[col] = filters[col] || null;
    });

    // Append metadata as a JSON string
    formData.append("metadata", JSON.stringify(metadata));

    try {
        console.log('Sending save request to /api/v1/files/save');
        const response = await api.post(`/api/v1/files/save`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        console.log('Save response:', response.data);
        setShowPopup(true);
        setShowSaveField(false);
        alert("File saved to your collection!");
        // Refresh the user files list
        if (window.loadUserFiles) {
            await loadUserFiles();
        }
    } catch (error) {
        console.error("Error saving file:", error);
        console.error("Error details:", error.response?.data);
        alert(`Error saving file: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDownloadClick = () => {
    setShowPopup(true);
  };

  const handlePopupStartOver = () => {
    setFile(null);
    setColumns([]);
    setSelectedColumns([]);
    setFilters({});
    setFilePath("");
    setDownloadUrl("");
    setShowPopup(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePopupKeepGoing = () => {
    setShowPopup(false);
    setDownloadUrl("");
  };

  const handlePopupNo = () => {
    alert(">:[");
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      bgcolor: 'var(--primary-bg)',
      width: '100%',
    }}>
      <Box sx={{ 
        p: 3, 
        bgcolor: 'var(--secondary-bg)', 
        borderRadius: 2, 
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        width: '100%',
      }}>
        <Typography 
        variant="h3" 
        component="h1"
        fontWeight="bold"
        gutterBottom sx={{ color: 'var(--primary-text)' }}>
          CSV Cutter
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--primary-text)', mb: 2 }}>
          Upload a CSV and apply filters to generate the file you <span style={{ fontStyle: 'italic' }}>know</span> it can be - if only someone would <span style={{ fontStyle: 'italic' }}>cut it</span>.
          <br /> 
          <br />You can do a lot more if you create an account and log in!
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--primary-text)' }}>
          Max file size: {MAX_FILE_SIZE_MB}MB
        </Typography>
        
        <Box sx={{ my: 2 }}>
          {/* File source selector for authenticated users */}
          {token.token && userFiles.length > 0 && (
            <FormControl sx={{ minWidth: 200, mr: 2 }}>
              <InputLabel>File Source</InputLabel>
              <Select
                value={fileSource}
                onChange={(e) => {
                  setFileSource(e.target.value);
                  // Reset file selection when switching source
                  setFile(null);
                  setSelectedFileId("");
                  setColumns([]);
                  setSelectedColumns([]);
                  setFilters({});
                  setFilePath("");
                  setIsFileValid(false);
                }}
                label="File Source"
              >
                <MenuItem value="upload">Upload New File</MenuItem>
                <MenuItem value="saved">Select from My Files</MenuItem>
              </Select>
            </FormControl>
          )}

          {/* Show file selector or upload button based on source */}
          {fileSource === "saved" && token.token ? (
            <Box sx={{ display: 'inline-block' }}>
              <FormControl sx={{ minWidth: 300, mr: 2 }}>
                <InputLabel>Select a File</InputLabel>
                <Select
                  value={selectedFileId}
                  onChange={async (e) => {
                    const fileId = e.target.value;
                    setSelectedFileId(fileId);
                    const selectedFile = userFiles.find(f => f.id === fileId);
                    if (selectedFile) {
                      setFile({ name: selectedFile.filename, size: selectedFile.file_size });
                      setFileInfo(`${selectedFile.filename} (${(selectedFile.file_size / (1024 * 1024)).toFixed(2)} MB)`);
                      setFilePath(fileId);
                      setIsFileValid(true);
                    }
                  }}
                  label="Select a File"
                >
                  {userFiles.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <FolderOpenIcon sx={{ mr: 1, fontSize: 'small' }} />
                        {f.filename} ({(f.file_size / (1024 * 1024)).toFixed(2)} MB)
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedFileId && (
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  color="primary"
                >
                  Load File
                </Button>
              )}
            </Box>
          ) : (
            // Original upload interface
            <>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
                id="csv-file-input"
              />
              <label htmlFor="csv-file-input">
                <Button
                  variant="contained"
                  component="span"
                  startIcon={<UploadIcon />}
                  sx={{ mr: 2 }}
                >
                  Choose File
                </Button>
              </label>

              {isFileValid && (
                <Button
                  variant="contained"
                  onClick={handleUpload}
                  color="primary"
                >
                  Upload CSV
                </Button>
              )}
            </>
          )}
        </Box>

        {fileInfo && (
          <Typography variant="body2" className="file-info">
            {fileInfo}
          </Typography>
        )}

        {rowCount > 0 && (
          <Typography variant="body2" className="file-info">
            Number of rows: {rowCount}
          </Typography>
        )}

        {errorMessage && (
          <Typography color="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Typography>
        )}

        {columns.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" sx={{ color: '#00ccf0', fontWeight: 'bold', mb: 2 }}>
            🦑 File uploaded successfully 🦑
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }} gutterBottom>
              Select Columns & Filters:
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Filters use SQL WHERE clause syntax (e.g., "&gt;10", "&lt;=20", "!=15", "LIKE '%text%'", "IN (1,2,3)")
            </Typography>
            
            <List>
              {columns.map((col, index) => (
                <ListItem key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={selectedColumns.includes(col)}
                    onChange={handleColumnSelection}
                    value={col}
                  />
                  <Typography sx={{ minWidth: 75, mr: 1 }}>{col}</Typography>
                  {selectedColumns.includes(col) && (
                    <TextField
                      size="small"
                      placeholder="e.g. >10, IN ('Alice', 'Bob'), != 'New York'"
                      value={filters[col] || ""}
                      onChange={(e) => handleFilterChange(col, e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  )}
                </ListItem>
              ))}
            </List>
            
            <Button
              variant="contained"
              onClick={handleCutList}
              sx={{ mt: 2 }}
            >
              Cut List
            </Button>

            {downloadUrl && (
              <Box sx={{ mt: 3 }}>
                <Accordion>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      backgroundColor: 'var(--action)',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'var(--dark-accent)',
                      },
                      '&.Mui-expanded': {
                        backgroundColor: 'var(--dark-accent)',
                      },
                      borderRadius: '4px 4px 0 0',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ContentCutIcon />
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        CUT it!
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                      {/* Download Button - Always available */}
                      <Button
                        variant="contained"
                        color="success"
                        component="a"
                        href={downloadUrl}
                        download="filtered.csv"
                        startIcon={<DownloadIcon />}
                        sx={{ 
                          py: 1.5,
                          fontSize: '1.1rem',
                          fontWeight: 'bold'
                        }}
                      >
                        Download
                      </Button>

                      {/* Save to My Files Button - Conditional styling */}
                      <Box sx={{ position: 'relative' }}>
                        <Button
                          variant="contained"
                          startIcon={<SaveIcon />}
                          onClick={() => {
                            console.log('Save to My Files clicked - logged in:', !!token.token);
                            if (token.token) {
                              setShowSaveField(!showSaveField);
                            } else {
                              setShowLoginMessage(true);
                            }
                          }}
                          sx={{ 
                            py: 1.5,
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            width: '100%'
                          }}
                        >
                          Save to My Files
                        </Button>
                      </Box>

                      {/* Login message - only show when save clicked while not logged in */}
                      {showLoginMessage && !token.token && (
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 2, 
                          mt: 2, 
                          p: 2,
                          backgroundColor: 'rgba(255, 0, 0, 0.1)',
                          borderRadius: 1,
                          border: '1px solid rgba(255, 0, 0, 0.3)'
                        }}>
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              color: '#ff0000',
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              textShadow: '0 0 5px rgba(255, 0, 0, 0.5)',
                              flex: 1
                            }}
                          >
                            You must be logged in to save things.
                          </Typography>
                          <Box
                            component="img"
                            src={cuttyLogo}
                            alt="Angry Cutty"
                            sx={{
                              width: '60px',
                              height: 'auto',
                              transform: 'scaleX(-1)',
                              filter: 'hue-rotate(0deg) saturate(2) brightness(1.2) drop-shadow(0 0 10px #ff0000)',
                            }}
                          />
                        </Box>
                      )}

                      {/* Save filename field - only show for logged-in users */}
                      {showSaveField && token.token && (
                        <Box sx={{ mt: 2 }}>
                          <TextField
                            label="Filename"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            fullWidth
                            sx={{ mb: 2 }}
                          />
                          <Button
                            variant="contained"
                            onClick={handleSaveToMyFiles}
                            startIcon={<SaveIcon />}
                            sx={{ 
                              py: 1.5,
                              fontSize: '1.1rem',
                              fontWeight: 'bold'
                            }}
                          >
                            Save Now
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Box>
            )}
          </Box>
        )}

        <Dialog open={showPopup} onClose={() => setShowPopup(false)}>
        <DialogTitle sx={{ color: 'var(--secondary-text)' }}>Great job! What would you like to do next?</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button variant="contained" onClick={handlePopupStartOver}>
                START OVER
              </Button>
              <Button variant="contained" onClick={handlePopupKeepGoing}>
                KEEP GOING
              </Button>
              <Button variant="contained" color="error" onClick={handlePopupNo}>
                DO NOT
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </Box>
  );
};

export default CSVCutter;
