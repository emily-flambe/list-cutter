import { useState, useEffect, useContext } from "react";
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
import api from '../api';
import { AuthContext } from '../context/AuthContext';

const CSVCutterPlus = () => {
  const [fileInfo, setFileInfo] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filters, setFilters] = useState({});
  const [filePath, setFilePath] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [showSaveField, setShowSaveField] = useState(false);
  const [filename, setFilename] = useState("");
  const [savedFiles, setSavedFiles] = useState([]);
  const [selectedSavedFile, setSelectedSavedFile] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const token = useContext(AuthContext);

  // On mount, load saved files for the logged-in user.
  useEffect(() => {
    const fetchSavedFiles = async () => {
      try {
        const response = await api.get('/api/list_cutter/list_saved_files/', {
          headers: { Authorization: `Bearer ${token.token}` }
        });
        setSavedFiles(response.data.files);
      } catch (error) {
        console.error("Error fetching saved files:", error);
        setErrorMessage("Error fetching saved files.");
      }
    };
    fetchSavedFiles();
  }, [token]);

  // When a saved file is selected, fetch its details.
  const handleSavedFileChange = async (event) => {
    const selectedFilePath = event.target.value || "";
    setSelectedSavedFile(selectedFilePath);
    
    if (selectedFilePath) {
      try {
        const response = await api.get(
          `/api/list_cutter/fetch_saved_file/?file_path=${encodeURIComponent(selectedFilePath)}`,
          { headers: { Authorization: `Bearer ${token.token}` } }
        );
        const fileData = response.data;
        console.log(fileData);
        // Use the proper keys from your API response:
        setSourceFileName(fileData.file_name);
        setFileInfo(`${fileData.file_name} (${(fileData.size / (1024 * 1024)).toFixed(2)} MB)`);
        setRowCount(fileData.rowCount);
        setColumns(fileData.columns);
        setFilePath(fileData.file_path); // Use file_path, not fileData.filePath
        setErrorMessage("");
      } catch (error) {
        console.error("Error fetching saved file:", error);
        setErrorMessage("Error fetching saved file. Please try again.");
      }
    }
  };
  

  const handleColumnSelection = (event) => {
    const { value, checked } = event.target;
    setSelectedColumns(prev =>
      checked ? [...prev, value] : prev.filter(col => col !== value)
    );
  };

  const handleFilterChange = (column, value) => {
    setFilters(prev => ({ ...prev, [column]: value }));
  };

  // "Cut List" now uses the saved file details. Note that instead of using file.name (which was null),
  // we use sourceFileName to generate the output filename.
  const handleCutList = async () => {
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
      // Use a fallback name if sourceFileName is undefined.
      const baseName = sourceFileName ? sourceFileName.split('.csv')[0] : "filtered_file";
      setFilename(`${baseName}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`);
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
  
    try {
      // Re-run the export call to get the CSV blob
      const exportUrl = `/api/list_cutter/export_csv/`;
      const response = await api.post(
        exportUrl,
        { columns: selectedColumns, file_path: filePath, filters },
        { responseType: "blob" }
      );
  
      const blob = new Blob([response.data], { type: "text/csv" });
      // Create a File object from the blob with the provided filename
      const fileToUpload = new File([blob], filename, { type: "text/csv" });
  
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("filename", filename);
  
      // Build metadata using the saved file's name if available
      const metadata = {
        generated_file_details: {
          source_file: sourceFileName || "generated_file",
          columns: selectedColumns,
          column_filters: {}
        }
      };
  
      selectedColumns.forEach(col => {
        metadata.generated_file_details.column_filters[col] = filters[col] || null;
      });
  
      formData.append("metadata", JSON.stringify(metadata));
  
      await api.post(`/api/list_cutter/save_generated_file/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setShowPopup(true);
    } catch (error) {
      console.error("Error saving file:", error);
      console.error("Error response data:", error.response.data);
      alert("Error saving file. Please try again.");
    }
  };


  const handlePopupStartOver = () => {
    setFileInfo("");
    setRowCount(0);
    setColumns([]);
    setSelectedColumns([]);
    setFilters({});
    setFilePath("");
    setDownloadUrl("");
    setShowPopup(false);
    setSelectedSavedFile("");
    setSourceFileName("");
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
          Select a file from the dropdown below.
        </Typography>
        
        <Box sx={{ my: 2 }}>
          <Select
            value={selectedSavedFile}
            onChange={handleSavedFileChange}
            displayEmpty
            sx={{ mr: 2 }}
            MenuProps={{
              PaperProps: { sx: { '& .MuiMenuItem-root': { color: 'var(--secondary-text)' } } },
              MenuListProps: { 'aria-hidden': false },
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
              File loaded successfully
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
                <Button
                  variant="contained"
                  onClick={() => setShowSaveField(!showSaveField)}
                >
                  Save to My Files
                </Button>
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
          <DialogTitle sx={{ color: 'var(--secondary-text)' }}>
            Great job! What would you like to do next?
          </DialogTitle>
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

export default CSVCutterPlus;
