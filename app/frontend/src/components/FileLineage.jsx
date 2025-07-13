import React, { useEffect, useState, useContext, useMemo } from 'react';
import { Box, Typography, MenuItem, Select, Button, CircularProgress } from '@mui/material';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
// import CytoscapeComponent from 'react-cytoscapejs';
// import cytoscape from 'cytoscape';
// import dagre from 'cytoscape-dagre';

// Register the dagre layout extension
// cytoscape.use(dagre);

const FileLineageCytoscape = () => {
  const { token } = useContext(AuthContext);
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Compute CSS variable values from the root.
  const computedColors = useMemo(() => {
    const computedStyles = window.getComputedStyle(document.documentElement);
    return {
      primaryBg: computedStyles.getPropertyValue('--primary-bg').trim(),
      navbarBg: computedStyles.getPropertyValue('--navbar-bg').trim(),
      secondaryBg: computedStyles.getPropertyValue('--secondary-bg').trim(),
      primaryText: computedStyles.getPropertyValue('--primary-text').trim(),
      secondaryText: computedStyles.getPropertyValue('--secondary-text').trim(),
      accent: computedStyles.getPropertyValue('--accent').trim(),
      action: computedStyles.getPropertyValue('--action').trim(),
      secondary: computedStyles.getPropertyValue('--secondary').trim(),
    };
  }, []);

  // Fetch saved files on mount.
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await api.get('/api/v1/files/list', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFiles(response.data.files);
        if (response.data.files.length > 0) {
          setSelectedFileId(response.data.files[0].file_id);
        }
      } catch (err) {
        console.error('Error fetching saved files:', err);
        setError('Failed to fetch saved files.');
      }
    };
    fetchFiles();
  }, [token]);

  const handleFetchLineage = async () => {
    if (!selectedFileId) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/v1/files/lineage/${selectedFileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGraphData(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching file lineage:', err);
      setError('Failed to fetch file lineage.');
      setGraphData({ nodes: [], edges: [] });
    }
    setLoading(false);
  };

  // Build Cytoscape elements.
  const getElements = () => {
    const nodeElements = graphData.nodes.map((node) => {
      const computedWidth = Math.max(80, node.file_name.length * 7 + 16);
      const element = {
        data: {
          id: node.file_id,
          label: node.file_name,
          width: computedWidth,
          height: 30,
        },
      };
      if (node.file_id === selectedFileId) {
        element.classes = 'selected';
      }
      return element;
    });

    // Deduplicate edges and flip CUT_FROM edges.
    const seenEdges = new Set();
    const edgeElements = graphData.edges.reduce((acc, edge) => {
      const source = edge.type === 'CUT_FROM' ? edge.target : edge.source;
      const target = edge.type === 'CUT_FROM' ? edge.source : edge.target;
      const key = `${source}->${target}`;
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        acc.push({ data: { id: `edge-${key}`, source, target } });
      }
      return acc;
    }, []);

    return [...nodeElements, ...edgeElements];
  };

  const elements = getElements();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        File Lineage
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Select a file to see its lineage.
      </Typography>
      <br />
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Select
          value={selectedFileId}
          onChange={(e) => setSelectedFileId(e.target.value)}
          displayEmpty
          renderValue={(value) => {
            if (value === "") {
              return <span style={{ color: computedColors.primaryText }}>Select a saved file</span>;
            }
            const file = files.find(file => file.file_id === value);
            return <span style={{ color: computedColors.primaryText }}>{file?.file_name}</span>;
          }}
          sx={{ minWidth: 200, mr: 2 }}
          MenuProps={{
            PaperProps: {
              sx: { '& .MuiMenuItem-root': { color: computedColors.secondaryText } }
            },
            MenuListProps: { 'aria-hidden': false }
          }}
        >
          <MenuItem value="" disabled>
            Select a saved file
          </MenuItem>
          {files.map((file) => (
            <MenuItem key={file.file_id} value={file.file_id}>
              {file.file_name}
            </MenuItem>
          ))}
        </Select>
        <Button variant="contained" onClick={handleFetchLineage}>
          Fetch Lineage
        </Button>
      </Box>
      {loading && <CircularProgress />}
      {!loading && elements.length > 0 && (
        <Box sx={{ height: 600, border: `1px solid ${computedColors.navbarBg}`, mb: 2 }}>
          {/* <CytoscapeComponent
            elements={elements}
            style={{ width: '100%', height: '100%' }}
            layout={{
              name: 'dagre',
              rankDir: 'TB',
              nodeSep: 70,
              edgeSep: 20,
              rankSep: 120,
            }}
            stylesheet={[
              {
                selector: 'node',
                style: {
                  'background-color': computedColors.secondaryBg,
                  label: 'data(label)',
                  'text-valign': 'center',
                  'text-halign': 'center',
                  color: computedColors.primaryText,
                  'border-color': computedColors.navbarBg,
                  'border-width': 1,
                  shape: 'roundrectangle',
                  'font-size': '12px',
                  width: 'data(width)',
                  height: 'data(height)',
                  padding: '4px',
                },
              },
              {
                selector: 'edge',
                style: {
                  width: 2,
                  'line-color': computedColors.primaryText,
                  'target-arrow-color': computedColors.primaryText,
                  'target-arrow-shape': 'triangle',
                  'curve-style': 'bezier',
                },
              },
              {
                // Style for the selected node.
                selector: `node#${selectedFileId}`,
                style: {
                  'background-color': computedColors.action,
                  'border-width': 2,
                  'border-color': computedColors.accent,
                  'font-weight': 'bold',
                  color: computedColors.secondaryText,
                },
              },
            ]}
          /> */}
        </Box>
      )}
    </Box>
  );
};

export default FileLineageCytoscape;
