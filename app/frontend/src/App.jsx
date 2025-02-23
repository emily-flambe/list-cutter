import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import Layout from './components/Layout';
import Home from './components/Home';
import FileUpload from './components/FileUpload';
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
            <Route path="/upload" element={<FileUpload />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;