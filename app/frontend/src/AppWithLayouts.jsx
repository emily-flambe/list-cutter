import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useState, useEffect, lazy, Suspense } from 'react';
import { createDynamicTheme } from './themes/muiTheme';

// Layout Component - using sidebar layout only
import SidebarLayout from './components/layouts/SidebarLayout';


// Page Components
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import Logout from './components/LogoutConfirmation';
import CSVCutter from './components/CSVCutter';
import CSVCutterPlus from './components/CSVCutterPlus';
import FileUpload from './components/FileUpload';
import ManageFiles from './components/ManageFiles';
import LoadPersonRecords from './components/LoadPersonRecords';
import FAQ from './components/FAQ';
import SyntheticDataGenerator from './components/SyntheticDataGenerator';
import Analysis from './components/Analysis';
import Cuttytabs from './components/Cuttytabs';
import DoStuff from './components/DoStuff';
import QueryBuilder from './components/QueryBuilder';

// Design Testing Component
import DesignTester from './components/DesignTester';


import './App.css';

function AppWithLayouts() {
  const [theme, setTheme] = useState(createDynamicTheme());

  useEffect(() => {
    // Listen for font changes
    const handleFontChange = () => {
      setTheme(createDynamicTheme());
    };

    // Create a MutationObserver to watch for style changes on the root element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'style') {
          handleFontChange();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    });

    return () => observer.disconnect();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <SidebarLayout>
            <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/csv_cutter" element={<CSVCutter />} />
            <Route path="/csv_cutter_plus" element={<CSVCutterPlus />} />
            <Route path="/file_upload" element={<FileUpload />} />
            <Route path="/manage_files" element={<ManageFiles />} />
            <Route path="/load_person_records" element={<LoadPersonRecords />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/design-tester" element={<DesignTester />} />
            <Route path="/synthetic-data" element={<SyntheticDataGenerator />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/analysis/cuttytabs" element={<Cuttytabs />} />
            <Route path="/cuttytabs" element={<Cuttytabs />} />
            <Route path="/do-stuff" element={<DoStuff />} />
            <Route path="/do-stuff/cut" element={<QueryBuilder />} />
            <Route path="/do-stuff/cut/:fileId" element={<QueryBuilder />} />
            <Route path="/cut" element={<QueryBuilder />} />
            <Route path="/cut/:fileId" element={<QueryBuilder />} />
          </Routes>
        </SidebarLayout>
      </Router>
    </AuthProvider>
  </ThemeProvider>
  );
}

export default AppWithLayouts;