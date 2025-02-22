import FileUpload from "./components/FileUpload";

function App() {
  return (
    <div>
      <h1>List Cutter App</h1>
      <p style={{ fontSize: '0.8em', color: 'gray' }}>
        ALL FEATURES IN THIS APP—EVEN THOSE BASED ON REAL USE CASES—ARE ENTIRELY FICTIONAL. ALL FUNCTIONALITY IS BASIC AND IMPLEMENTED... POORLY. THE FOLLOWING APP MAY CONTAIN COARSE LANGUAGE AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE. ▌
      </p>
      <FileUpload />
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <a
          href="https://github.com/emily-flambe/list-cutter"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0366d6', textDecoration: 'none', fontSize: '0.9em' }}
        >
          view on GitHub (don't @ me)
        </a>
      </div>
    </div>
  );
}

export default App;
