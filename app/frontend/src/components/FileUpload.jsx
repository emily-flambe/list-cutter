import { useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("${API_BASE_URL}/api/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setColumns(response.data.columns);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  return (
    <div>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>

      {columns.length > 0 && (
        <div>
          <h3>Column Names:</h3>
          <ul>
            {columns.map((col, index) => (
              <li key={index}>{col}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
