import { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  TextField,
  Typography,
  Select,
  MenuItem,
} from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { useContext } from 'react';

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
  const fileInputRef = useRef(null);
  const token = useContext(AuthContext);
  const [savedFiles, setSavedFiles] = useState([]);
  const [selectedSavedFile, setSelectedSavedFile] = useState("");

  useEffect(() => {
    console.log("Updated File Info:", fileInfo);
    console.log("Token:", token);
    const fetchSavedFiles = async () => {
      try {
        const response = await api.get('/api/list_cutter/list_saved_files/', {
          headers: {
            Authorization: `Bearer ${token.token}`
          }
        });
        setSavedFiles(response.data.files);
        console.log("Fetched saved files:", response.data.files);
      } catch (error) {
        console.error("Error fetching saved files:", error);
      }
    };
    fetchSavedFiles();
  }, [token]);

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

  const handleSavedFileChange = async (event) => {
    const selectedFilePath = event.target.value || "";
    setSelectedSavedFile(selectedFilePath);
    setFile(null); // Clear the uploaded file state when a saved file is selected

    if (selectedFilePath) {
      try {
        const response = await api.get(`/api/list_cutter/fetch_saved_file/?file_path=${encodeURIComponent(selectedFilePath)}`, {
          headers: {
            Authorization: `Bearer ${token.token}`
          }
        });
        
        // Assuming the response contains the file data you need
        const fileData = response.data;
        setFileInfo(`${fileData.name} (${(fileData.size / (1024 * 1024)).toFixed(2)} MB)`);
        setRowCount(fileData.rowCount);
        setColumns(fileData.columns);
        setFilePath(fileData.filePath);
        console.log("File path after fetching saved file:", fileData.filePath);
        setIsFileValid(true);
        setErrorMessage("");
      } catch (error) {
        console.error("Error fetching saved file:", error);
        setErrorMessage("Error fetching saved file. Please try again.");
      }
    }
  };

  const handleUpload = async () => {
    const selectedFilePath = selectedSavedFile; // Get the selected saved file path

    if (!file && !selectedFilePath) {
        setErrorMessage("Please select a file.");
        return;
    }

    const formData = new FormData();

    // If a saved file is selected, use that instead of the uploaded file
    if (selectedFilePath) {
        // Here you would typically need to handle the file upload differently
        // For now, we will just log the selected file path
        console.log("Using saved file path:", selectedFilePath);
        // You may need to adjust this based on your backend requirements
        // For example, you might need to send a request to get the file data
    } else {
        // Use the uploaded file
        if (!file.name.toLowerCase().endsWith(".csv")) {
            setErrorMessage("Invalid file type. Please upload a CSV file.");
            return;
        }

        // Simulate file size check
        if (file.size > MAX_FILE_SIZE) {
            setErrorMessage(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
            return;
        }

        formData.append("file", file); // Append the uploaded file
    }

    try {
      const response = await api.post(
        `/api/list_cutter/csv_cutter/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setColumns(response.data.columns);
      setFilePath(response.data.file_path || "");
      console.log("File path after upload:", response.data.file_path);
      setErrorMessage("");

      // Set file info with the original row count
      setFileInfo(`${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (error) {
      console.error("Error uploading file:", error);
      if (error.response && error.response.status === 400) {
        setErrorMessage(error.response.data.error || "Error uploading file. Please try again.");
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
    console.log("Current filePath:", filePath);
    if (selectedColumns.length === 0) {
      return alert("Please select at least one column to cut.");
    }
    if (!filePath) {
      return alert("File path is not available.");
    }

    try {
      const exportUrl = `/api/list_cutter/export_csv/`;
      const response = await api.post(
        exportUrl,
        { columns: selectedColumns, file_path: filePath, filters },
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setShowSaveField(false);
      setFilename(`${file.name.split('.csv')[0]}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Error exporting CSV");
    }
  };

  const handleSaveToMyFiles = async () => {
    if (!filename) {
      alert("Please provide a filename.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename", filename);

    // Create metadata object
    const metadata = {
        generated_file_details: {
            source_file: file.name,
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

    console.log(formData);
    try {
        await api.post(`/api/list_cutter/save_generated_file/`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        setShowPopup(true);
    } catch (error) {
        console.error("Error saving file:", error);
        alert("Error saving file. Please try again.");
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
        {token.token === null ? (
          <Typography variant="body2" sx={{ color: 'var(--primary-text)', mb: 2 }}>
            Upload a CSV and apply filters to generate the file you <span style={{ fontStyle: 'italic' }}>know</span> it can be - if only someone would <span style={{ fontStyle: 'italic' }}>cut it</span>.
            <br /> 
            <br />You can do a lot more if you create an account and log in! Seriously!
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'var(--primary-text)', mb: 2 }}>
            Select a file from the dropdown below, or <a href="/file_upload" style={{ textDecoration: 'underline' }}>upload one</a> if you haven't already.
          </Typography>
        )}
        
        <Box sx={{ my: 2 }}>
          {token.token === null ? (
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
                  Upload Temporary File
                </Button>
              </label>
            </>
          ) : (
            <>
              <Box sx={{ my: 2 }}>
                <Select
                  value={selectedSavedFile}
                  onChange={handleSavedFileChange}
                  displayEmpty
                  sx={{ mr: 2 }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        '& .MuiMenuItem-root': {
                          color: 'var(--secondary-text)',
                        },
                      },
                    },
                    MenuListProps: {
                      'aria-hidden': false,
                    },
                  }}
                >
                  <MenuItem value="" disabled>Select a saved file</MenuItem>
                  {savedFiles.length > 0 ? (
                    savedFiles.map((file, index) => (
                      <MenuItem key={index} value={file.file_path}>{file.file_name}</MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>No saved files available</MenuItem>
                  )}
                </Select>
              </Box>
            </>
          )}

          {isFileValid && (
            <Button
              variant="contained"
              onClick={handleUpload}
              color="primary"
            >
              Upload CSV
            </Button>
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
              {token.token === null ? "🦑 File uploaded successfully 🦑" : "🦑 File loaded successfully 🦑"}
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
              <Box sx={{ mt: 3, display: 'flex', alignItems: 'center' }}>
                <Button
                  variant="contained"
                  color="success"
                  component="a"
                  href={downloadUrl}
                  download="filtered.csv"
                  sx={{ mr: 2 }}
                >
                  Download CSV
                </Button>
                {token.token !== null ? (
                  <Button
                    variant="contained"
                    onClick={() => setShowSaveField(!showSaveField)}
                  >
                    Save to My Files
                  </Button>
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    Log in to save the generated file to your account. Then you can cut EVEN MORE LISTS.
                  </Typography>
                )}
              </Box>
            )}

            {showSaveField && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  label="Filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handleSaveToMyFiles}
                  sx={{ mt: 2 }}
                >
                  Save
                </Button>
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
