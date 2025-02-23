import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  TextField,
  Typography,
} from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';

// Assume API_BASE_URL is defined somewhere
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const MAX_FILE_SIZE = Number(import.meta.env.VITE_MAX_FILE_SIZE) || 10 * 1024 * 1024;
const MAX_FILE_SIZE_MB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(2);

const FileUpload = () => {
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
  const fileInputRef = useRef(null);

  useEffect(() => {
    console.log("Updated File Info:", fileInfo);
  }, [fileInfo]);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    // Reset states on new file selection
    setFile(selectedFile);
    setRowCount(0); // Reset row count
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
      setErrorMessage(""); // Clear any previous error messages
      setIsFileValid(true); // Set file as valid

      // Read the file to count rows
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split('\n').length - 1; // Subtract 1 for header row
        setRowCount(rows);
        setFileInfo(`${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`);
      };
      reader.readAsText(selectedFile);
    } else {
      setIsFileValid(false);
    }

    // Reset other states
    setColumns([]);
    setSelectedColumns([]);
    setFilters({});
    setDownloadUrl("");
    setFilePath("");
    setShowPopup(false);
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMessage("Please select a file.");
      return;
    }

    // Validate file type again before upload
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Invalid file type. Please upload a CSV file.");
      return;
    }

    // Prevent upload if file size exceeds limit
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/upload/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      // Expecting response.data to contain { columns: [...], file_path: "..." }
      setColumns(response.data.columns);
      setFilePath(response.data.file_path || "");
      setErrorMessage(""); // Clear error if successful

      // Use the row count calculated during file selection
      // setRowCount(csvData); // Remove this line

      // Set file info with the original row count
      setFileInfo(`${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

    } catch (error) {
      console.error("Error uploading file:", error);

      // Backend file size enforcement message
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

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      return alert("Please select at least one column to export.");
    }
    if (!filePath) {
      return alert("File path is not available.");
    }

    try {
      const exportUrl = `${API_BASE_URL}/api/export_csv/`;
      const response = await axios.post(
        exportUrl,
        { columns: selectedColumns, file_path: filePath, filters },
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Error exporting CSV");
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
    setDownloadUrl(""); // Clear the download URL to hide the download section
  };

  const handlePopupNo = () => {
    alert(">:[");
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      bgcolor: 'var(--primary-bg)', // Background is maintained for consistency
      width: '100%', // Ensure the Box takes full width
    }}>
      <Box sx={{ 
        p: 3, 
        bgcolor: 'var(--secondary-bg)', 
        borderRadius: 2, 
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        width: '100%', // Allow it to stretch to full width
      }}>
        <Typography 
        variant="h3" 
        component="h1"
        fontWeight="bold"
        gutterBottom sx={{ color: 'var(--primary-text)' }}>
          CSV Cutter
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--secondary-text)', mb: 2 }}>
          Upload a CSV and apply filters to generate the file you <span style={{ fontStyle: 'italic' }}>know</span> it can be - if only someone would simply <span style={{ fontStyle: 'italic' }}>cut it</span>.
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--secondary-text)' }}>
          Max file size: {MAX_FILE_SIZE_MB}MB
        </Typography>
        
        <Box sx={{ my: 2 }}>
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
              onClick={handleExport}
              sx={{ mt: 2 }}
            >
              Export Filtered CSV
            </Button>
          </Box>
        )}

        {downloadUrl && (
          <Box sx={{ mt: 3 }}>
            <Button
              variant="contained"
              color="success"
              component="a"
              href={downloadUrl}
              download="filtered.csv"
              onClick={handleDownloadClick}
            >
              Download CSV
            </Button>
          </Box>
        )}

        <Dialog open={showPopup} onClose={() => setShowPopup(false)}>
          <DialogTitle>Great job! What would you like to do next?</DialogTitle>
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

export default FileUpload;
