import { useState, useRef, useContext } from "react";
import axios from "axios";
import { AuthContext } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; // Set in your .env file

const FileUpload = () => {
  const { token } = useContext(AuthContext);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    setMessage("");
    setError("");
  };

  // Upload file to the backend
  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    if (!token) {
      setError("You must be logged in to upload files.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/list_cutter/upload/`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`, // Send JWT token
        },
      });

      setSuccessMessage("🦑 File uploaded successfully 🦑");
      setFile(null);
      fileInputRef.current.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      setError(error.response?.data?.error || "Upload failed. Try again.");
    }
    
  };

  return (
    <div>
      <h2>Upload a File</h2>
      {successMessage && <p>{successMessage}</p>}
      <input type="file" onChange={handleFileChange} ref={fileInputRef} />
      <button onClick={handleUpload} disabled={!file}>Upload</button>
    </div>
  );
};

export default FileUpload;
