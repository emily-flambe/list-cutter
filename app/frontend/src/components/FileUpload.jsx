import { useState } from "react";
import axios from "axios";

// Assume API_BASE_URL is defined somewhere
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filePath, setFilePath] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [showPopup, setShowPopup] = useState(false);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    // Reset states on new file selection
    setColumns([]);
    setSelectedColumns([]);
    setDownloadUrl("");
    setFilePath("");
    setShowPopup(false);
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file");

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
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file");
    }
  };

  const handleColumnSelection = (event) => {
    const { value, checked } = event.target;
    if (checked) {
      setSelectedColumns((prev) => [...prev, value]);
    } else {
      setSelectedColumns((prev) => prev.filter((col) => col !== value));
    }
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
        { columns: selectedColumns, file_path: filePath },
        { responseType: "blob" } // Expecting a CSV blob in response
      );

      // Create a download URL for the blob
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Error exporting CSV");
    }
  };

  const handleDownloadClick = () => {
    // Once the user clicks the download button, show the popup.
    setShowPopup(true);
  };

  const handlePopupYes = () => {
    // Simulate file deletion (or call your API to delete the file here)
    // Then reset the component state to initial
    setFile(null);
    setColumns([]);
    setSelectedColumns([]);
    setFilePath("");
    setDownloadUrl("");
    setShowPopup(false);
  };

  const handlePopupNo = () => {
    alert(">:[");
  };

  return (
    <div>
      <h2>Upload CSV File</h2>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload CSV</button>

      {columns.length > 0 && (
        <div>
          <h3>Select Columns to Export:</h3>
          <ul>
            {columns.map((col, index) => (
              <li key={index}>
                <label>
                  <input
                    type="checkbox"
                    value={col}
                    onChange={handleColumnSelection}
                  />
                  {col}
                </label>
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
          <div style={{ background: "white", padding: "20px", borderRadius: "8px", color: "black", textAlign: "center" }}>
            <h3>Great job! Wanna do it again?</h3>
            <div style={{ marginTop: "10px" }}>
              <button style={{ marginRight: "10px" }} onClick={handlePopupYes}>YES, AGAIN</button>
              <button onClick={handlePopupNo}>DO NOT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
