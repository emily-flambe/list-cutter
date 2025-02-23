import { useState, useRef } from "react";
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
  Paper,
} from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';

// Assume API_BASE_URL is defined somewhere
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const MAX_FILE_SIZE = Number(import.meta.env.VITE_MAX_FILE_SIZE) || 10 * 1024 * 1024;
const MAX_FILE_SIZE_MB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(2);

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filters, setFilters] = useState({}); // New state for filters
  const [filePath, setFilePath] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];

    // Reset states on new file selection
    setFile(selectedFile);
    setColumns([]);
    setSelectedColumns([]);
    setFilters({});
    setDownloadUrl("");
    setFilePath("");
    setShowPopup(false);
    setErrorMessage("");

    // Validate file type
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Invalid file type. Please upload a CSV file.");
      return;
    }

    // Frontend file size validation
    if (selectedFile && selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
    }
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
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Upload CSV File
      </Typography>
      <Typography variant="caption" color="text.secondary">
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
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!!errorMessage}
          color="primary"
        >
          Upload CSV
        </Button>
      </Box>

      {errorMessage && (
        <Typography color="error" sx={{ mt: 2 }}>
          {errorMessage}
        </Typography>
      )}

      {columns.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select Columns & Filters:
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
                <Typography sx={{ minWidth: 150 }}>{col}</Typography>
                {selectedColumns.includes(col) && (
                  <TextField
                    size="small"
                    placeholder="e.g. >10, IN ('Alice', 'Bob'), != 'New York'"
                    value={filters[col] || ""}
                    onChange={(e) => handleFilterChange(col, e.target.value)}
                    sx={{ ml: 2, flex: 1 }}
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
          <Typography variant="h6" gutterBottom>
            Download Filtered CSV
          </Typography>
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
    </Paper>
  );
};

export default FileUpload;
