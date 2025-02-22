import { useState } from "react";
import axios from "axios";

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filePath, setFilePath] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    // Reset states on new file selection
    setColumns([]);
    setSelectedColumns([]);
    setDownloadUrl("");
    setFilePath("");
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/upload/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

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

  return (
    <div>
      <h2>Upload CSV File</h2>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleUpload}>Uploadddd</button>

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
            <button>Download CSV</button>
          </a>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
