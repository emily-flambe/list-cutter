import React, { useEffect, useState, useContext } from 'react';
import { Box, Typography, MenuItem, Select, Button, CircularProgress, Paper } from '@mui/material';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

// Register dagre layout
cytoscape.use(dagre);

const FileLineageCytoscape = () => {
  const { token } = useContext(AuthContext);
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch list of saved files when component mounts.
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await api.get('/api/list_cutter/list_saved_files/', {
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
      const response = await api.get(`/api/list_cutter/fetch_file_lineage/${selectedFileId}/`, {
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

  // Transform graphData into Cytoscape elements.
  // Deduplicate edges: if multiple edges have the same (source, target) pair, only add one.
  const getElements = () => {
    // Map nodes
    const nodeElements = graphData.nodes.map((node) => ({
      data: { id: node.file_id, label: node.file_name },
    }));

    // Deduplicate edges.
    const seenEdges = new Set();
    const edgeElements = graphData.edges.reduce((acc, edge) => {
      // For our UI, we want arrows to represent CUT_TO.
      // So if the edge is CUT_FROM, we swap source and target.
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
        File Lineage Graph Visualization
      </Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <Select
          value={selectedFileId}
          onChange={(e) => setSelectedFileId(e.target.value)}
          sx={{
            minWidth: 200,
            mr: 2,
            backgroundColor: 'var(--primary-bg)',
            color: 'var(--primary-text)',
          }}
        >
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
        <Box sx={{ height: 600, border: '1px solid var(--navbar-bg)', mb: 2 }}>
          <CytoscapeComponent
            elements={elements}
            style={{ width: '100%', height: '100%' }}
            layout={{
              name: 'dagre',
              rankDir: 'TB', // Top-to-bottom. Change to 'LR' for left-to-right.
              nodeSep: 50,
              edgeSep: 10,
              rankSep: 100,
            }}
            stylesheet={[
              {
                selector: 'node',
                style: {
                  'background-color': 'var(--secondary-bg)',
                  label: 'data(label)',
                  color: 'var(--primary-text)',
                  'text-valign': 'center',
                  'text-halign': 'center',
                  'border-color': 'var(--navbar-bg)',
                  'border-width': 1,
                  shape: 'roundrectangle',
                  'font-size': '12px',
                },
              },
              {
                selector: 'edge',
                style: {
                  width: 2,
                  'line-color': 'var(--primary-text)',
                  'target-arrow-color': 'var(--primary-text)',
                  'target-arrow-shape': 'triangle',
                  'curve-style': 'bezier',
                },
              },
              {
                selector: `node[id = "${selectedFileId}"]`,
                style: {
                  'background-color': 'var(--accent)',
                  'font-weight': 'bold',
                },
              },
            ]}
          />
        </Box>
      )}
      {/* Display the raw JSON response for verification */}
      {graphData && (graphData.nodes.length > 0 || graphData.edges.length > 0) && (
        <Paper sx={{ p: 2, backgroundColor: 'var(--primary-bg)', color: 'var(--primary-text)' }}>
          <Typography variant="h6" gutterBottom>
            Raw JSON Response:
          </Typography>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(graphData, null, 2)}
          </pre>
        </Paper>
      )}
    </Box>
  );
};

export default FileLineageCytoscape;
