import { useState, useRef, useContext } from "react";
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { Box, Button, Typography, Alert, TextField } from '@mui/material';
import { getNewToken } from '../auth';

const FileUpload = () => {
  const { token } = useContext(AuthContext);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef(null);

  // Check if user is logged in
  if (!token) {
    setError("You must be logged in to access this page. How did you even get here???");
    return (
      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Typography variant="h4">You may NOT Upload a File</Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </Box>
    );
  }

  // Handle file selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    setError("");
  };

  // Upload file to the backend
  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    // Set the success message to indicate upload is in progress
    setSuccessMessage("Upload in progress...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Refresh the token before making the upload request
      const newToken = await getNewToken();
      if (!newToken) {
        setError("Failed to refresh token. Please log in again.");
        return;
      }

      const response = await api.post(`/api/cutty/upload/`, formData, {
        headers: {
          "Authorization": `Bearer ${newToken}`, // Use the refreshed token
        },
      });
      console.log("Response from upload:", response.data);
      console.log("File name:", file.name);
      console.log("File path:", file.path);

      setSuccessMessage("🦑 File uploaded successfully 🦑");
      setFile(null);
      fileInputRef.current.value = "";
    } catch (error) {
      console.log("Request data being sent:");
      // Iterating through FormData entries to log the data
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }
      console.error("Upload error:", error);
      setError(error.response?.data?.error || "Upload failed. Try again.");
    }
  };

  return (
    <Box sx={{ textAlign: 'left', mt: 4 }}>
      <Typography variant="h4">Upload a File</Typography>
      <br />
      <Typography variant="body1">
        Upload files in order to <a href="/csv_cutter_plus">cut lists</a> with them!
        <br />You can manage your files <a href="/manage_files">on this page</a>.
      </Typography>
      <br />
      {successMessage && (
        <Typography
          variant="body1"
          color={successMessage === "Upload in progress..." ? "text.secondary" : "success.main"}
        >
          {successMessage}
        </Typography>
      )}
      <TextField
        type="file"
        inputRef={fileInputRef}
        onChange={handleFileChange}
        sx={{ display: 'none' }}
        id="file-upload"
      />
      <label htmlFor="file-upload">
        <Button variant="contained" component="span" sx={{ ml: 2, mt: 4 }}>
          Choose File
        </Button>
      </label>
      <Button onClick={handleUpload} disabled={!file} variant="contained" sx={{ ml: 2, mt: 4 }}>
        Upload
      </Button>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Box>
  );
};

export default FileUpload;
