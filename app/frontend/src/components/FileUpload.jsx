import { useState, useRef } from "react";
import axios from "axios";

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
    <div>
      <h2>Upload CSV File</h2>
      <p style={{ fontSize: "12px", color: "#666" }}>Max file size: {MAX_FILE_SIZE_MB}MB</p>
      <input type="file" accept=".csv" onChange={handleFileChange} ref={fileInputRef} />
      <button onClick={handleUpload} disabled={!!errorMessage}>Upload CSV</button>

      {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}

      {columns.length > 0 && (
        <div>
          <h3>Select Columns & Filters:</h3>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "10px" }}>
            Filters use SQL WHERE clause syntax (e.g., "&gt;10", "&lt;=20", "!=15", "LIKE '%text%'", "IN (1,2,3)")
          </p>
          <ul>
            {columns.map((col, index) => (
              <li key={index}>
                <label>
                  <input type="checkbox" value={col} onChange={handleColumnSelection} />
                  {col}
                </label>
                {selectedColumns.includes(col) && (
                  <input
                    type="text"
                    placeholder="e.g. >10, <=20, !=15"
                    value={filters[col] || ""}
                    onChange={(e) => handleFilterChange(col, e.target.value)}
                  />
                )}
              </li>
            ))}
          </ul>
          <button onClick={handleExport}>Export Filtered CSV</button>
        </div>
      )}

      {downloadUrl && (
        <div>
          <h3>Download Filtered CSV</h3>
          <a href={downloadUrl} download="filtered.csv">
            <button onClick={handleDownloadClick}>Download CSV</button>
          </a>
        </div>
      )}

      {showPopup && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center",
          alignItems: "center"
        }}>
          <div style={{
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            color: "black",
            textAlign: "center"
          }}>
            <h3>Great job! What would you like to do next?</h3>
            <div style={{ marginTop: "10px" }}>
              <button style={{ marginRight: "10px" }} onClick={handlePopupStartOver}>
                START OVER
              </button>
              <button style={{ marginRight: "10px" }} onClick={handlePopupKeepGoing}>
                KEEP GOING
              </button>
              <button onClick={handlePopupNo}>DO NOT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
