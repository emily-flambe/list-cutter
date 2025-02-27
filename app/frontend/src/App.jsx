import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import Layout from './components/Layout';
import Home from './components/Home';
import CSVCutter from './components/CSVCutter';
import CSVCutterPlus from './components/CSVCutterPlus';
import FileUpload from './components/FileUpload';
import Register from './components/Register';
import Login from './components/Login';
import Logout from './components/LogoutConfirmation';
import ManageFiles from './components/ManageFiles';
import FAQ from './components/FAQ';
import './index.css';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Function to get CSS variable values
const getCssVariable = (variable) => {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
};

const theme = createTheme({
  palette: {
    primary: {
      main: getCssVariable('--secondary'), // Get the CSS variable value
    },
    secondary: {
      main: getCssVariable('--accent'), // Get the CSS variable value
    },
    background: {
      default: getCssVariable('--primary-bg'), // Get the CSS variable value
    },
    text: {
      primary: getCssVariable('--primary-text'), // Get the CSS variable value
      secondary: getCssVariable('--secondary'), // Get the CSS variable value
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/csv_cutter" element={<CSVCutter />} />
            <Route path="/csv_cutter_plus" element={<CSVCutterPlus />} />
            <Route path="/file_upload" element={<FileUpload />} />
            <Route path="/manage_files" element={<ManageFiles />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/faq" element={<FAQ />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;