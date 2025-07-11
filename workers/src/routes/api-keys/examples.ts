import type { Env } from '../../types';

/**
 * API Key Usage Examples and Documentation
 */
export async function renderAPIKeyExamples(
  request: Request,
  env: Env
): Promise<Response> {
  const baseUrl = new URL(request.url).origin;
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>API Key Usage Examples - List Cutter</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          max-width: 1000px; 
          margin: 0 auto; 
          padding: 20px; 
        }
        .header { margin-bottom: 30px; }
        .header h1 { color: #2c5aa0; }
        .section { margin: 30px 0; }
        .section h2 { color: #2c5aa0; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
        .section h3 { color: #555; margin-top: 25px; }
        .code-block { 
          background: #f8f9fa; 
          border: 1px solid #e9ecef; 
          border-radius: 6px; 
          padding: 15px; 
          margin: 15px 0; 
          overflow-x: auto; 
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; 
          font-size: 14px; 
        }
        .method { 
          display: inline-block; 
          padding: 2px 6px; 
          border-radius: 3px; 
          font-weight: bold; 
          font-size: 12px; 
          margin-right: 10px; 
        }
        .method.get { background: #d4edda; color: #155724; }
        .method.post { background: #fff3cd; color: #856404; }
        .method.delete { background: #f8d7da; color: #721c24; }
        .endpoint { font-family: monospace; background: #f1f3f4; padding: 2px 6px; border-radius: 3px; }
        .permission-req { 
          background: #e3f2fd; 
          color: #1976d2; 
          padding: 5px 10px; 
          border-radius: 4px; 
          font-size: 0.9em; 
          margin: 10px 0; 
        }
        .warning { 
          background: #fff3cd; 
          color: #856404; 
          padding: 15px; 
          border-radius: 6px; 
          border-left: 4px solid #ffc107; 
          margin: 15px 0; 
        }
        .info { 
          background: #d1ecf1; 
          color: #0c5460; 
          padding: 15px; 
          border-radius: 6px; 
          border-left: 4px solid #17a2b8; 
          margin: 15px 0; 
        }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .nav { 
          background: #f8f9fa; 
          padding: 15px; 
          border-radius: 6px; 
          margin-bottom: 20px; 
        }
        .nav a { 
          text-decoration: none; 
          color: #2c5aa0; 
          margin-right: 20px; 
          font-weight: 500; 
        }
        .nav a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>List Cutter API Documentation</h1>
        <p>Comprehensive guide to using API keys for programmatic access</p>
      </div>
      
      <div class="nav">
        <a href="#authentication">Authentication</a>
        <a href="#permissions">Permissions</a>
        <a href="#endpoints">Endpoints</a>
        <a href="#examples">Examples</a>
        <a href="#sdks">SDKs</a>
        <a href="/api-keys/manage">Manage Keys</a>
      </div>
      
      <div class="section" id="authentication">
        <h2>Authentication</h2>
        
        <h3>API Key Format</h3>
        <p>All API keys follow the format: <code>cutty_[32-character-string]</code></p>
        
        <h3>Using API Keys</h3>
        <p>Include your API key in the Authorization header:</p>
        <div class="code-block">Authorization: Bearer cutty_your_api_key_here</div>
        
        <div class="warning">
          <strong>Security:</strong> Never expose API keys in client-side code, public repositories, or logs. 
          Store them securely as environment variables or in secure credential storage.
        </div>
        
        <h3>Rate Limiting</h3>
        <p>API keys are subject to rate limiting:</p>
        <ul>
          <li>Default: 1000 requests per minute</li>
          <li>Custom limits can be set per key (1-10,000 requests/minute)</li>
          <li>Rate limit headers are included in responses</li>
        </ul>
      </div>
      
      <div class="section" id="permissions">
        <h2>Permission System</h2>
        
        <p>API keys use granular permissions to control access to different features:</p>
        
        <table>
          <thead>
            <tr>
              <th>Permission</th>
              <th>Description</th>
              <th>Use Cases</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>auth:read</code></td>
              <td>Read authentication status and user info</td>
              <td>User profile integration</td>
            </tr>
            <tr>
              <td><code>auth:write</code></td>
              <td>Modify authentication settings</td>
              <td>Profile management systems</td>
            </tr>
            <tr>
              <td><code>files:read</code></td>
              <td>Read file information and download files</td>
              <td>Data export, file browsers</td>
            </tr>
            <tr>
              <td><code>files:write</code></td>
              <td>Upload and modify files</td>
              <td>Data import, file management</td>
            </tr>
            <tr>
              <td><code>files:delete</code></td>
              <td>Delete files</td>
              <td>Cleanup scripts, admin tools</td>
            </tr>
            <tr>
              <td><code>list:process</code></td>
              <td>Process CSV files and perform list operations</td>
              <td>Automated data processing</td>
            </tr>
            <tr>
              <td><code>list:export</code></td>
              <td>Export processed lists</td>
              <td>Report generation, data pipelines</td>
            </tr>
            <tr>
              <td><code>analytics:read</code></td>
              <td>Read analytics and usage statistics</td>
              <td>Monitoring dashboards</td>
            </tr>
          </tbody>
        </table>
        
        <h3>Permission Presets</h3>
        <ul>
          <li><strong>Read Only:</strong> <code>auth:read, files:read, analytics:read</code></li>
          <li><strong>Basic User:</strong> <code>auth:read, files:read, files:write, list:process, list:export</code></li>
          <li><strong>List Processing:</strong> <code>auth:read, files:read, files:write, list:process, list:export</code></li>
          <li><strong>Full Access:</strong> All available permissions</li>
        </ul>
      </div>
      
      <div class="section" id="endpoints">
        <h2>API Endpoints</h2>
        
        <h3>Authentication & User Management</h3>
        
        <div>
          <span class="method get">GET</span>
          <span class="endpoint">/api/accounts/user</span>
          <div class="permission-req">Required: auth:read</div>
          <p>Get current user information</p>
          <div class="code-block">curl -H "Authorization: Bearer cutty_your_key" \\
  ${baseUrl}/api/accounts/user</div>
        </div>
        
        <h3>File Management</h3>
        
        <div>
          <span class="method get">GET</span>
          <span class="endpoint">/api/list_cutter/list_saved_files</span>
          <div class="permission-req">Required: files:read</div>
          <p>List all saved files for the authenticated user</p>
        </div>
        
        <div>
          <span class="method post">POST</span>
          <span class="endpoint">/api/list_cutter/upload</span>
          <div class="permission-req">Required: files:write</div>
          <p>Upload a new CSV file</p>
        </div>
        
        <div>
          <span class="method delete">DELETE</span>
          <span class="endpoint">/api/list_cutter/delete/{fileId}</span>
          <div class="permission-req">Required: files:delete</div>
          <p>Delete a specific file</p>
        </div>
        
        <h3>List Processing</h3>
        
        <div>
          <span class="method post">POST</span>
          <span class="endpoint">/api/list_cutter/csv_cutter</span>
          <div class="permission-req">Required: list:process</div>
          <p>Process CSV data with filters and transformations</p>
        </div>
        
        <div>
          <span class="method post">POST</span>
          <span class="endpoint">/api/list_cutter/export_csv</span>
          <div class="permission-req">Required: list:export</div>
          <p>Export processed data as CSV</p>
        </div>
        
        <h3>API Key Management</h3>
        
        <div>
          <span class="method get">GET</span>
          <span class="endpoint">/api/api-keys</span>
          <p>List your API keys (requires JWT authentication)</p>
        </div>
        
        <div>
          <span class="method post">POST</span>
          <span class="endpoint">/api/api-keys</span>
          <p>Create a new API key (requires JWT authentication)</p>
        </div>
        
        <div>
          <span class="method get">GET</span>
          <span class="endpoint">/api/api-keys/{keyId}/usage</span>
          <p>Get usage statistics for an API key</p>
        </div>
      </div>
      
      <div class="section" id="examples">
        <h2>Code Examples</h2>
        
        <h3>JavaScript/Node.js</h3>
        <div class="code-block">const API_KEY = 'cutty_your_api_key_here';
const BASE_URL = '${baseUrl}/api';

// Get user information
async function getUser() {
  const response = await fetch(\`\${BASE_URL}/accounts/user\`, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`
    }
  });
  return response.json();
}

// Upload a CSV file
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(\`\${BASE_URL}/list_cutter/upload\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`
    },
    body: formData
  });
  return response.json();
}

// Process CSV data
async function processCsv(data) {
  const response = await fetch(\`\${BASE_URL}/list_cutter/csv_cutter\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
}</div>
        
        <h3>Python</h3>
        <div class="code-block">import requests

API_KEY = 'cutty_your_api_key_here'
BASE_URL = '${baseUrl}/api'
HEADERS = {'Authorization': f'Bearer {API_KEY}'}

# Get user information
def get_user():
    response = requests.get(f'{BASE_URL}/accounts/user', headers=HEADERS)
    return response.json()

# Upload a CSV file
def upload_file(file_path):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(
            f'{BASE_URL}/list_cutter/upload',
            headers={'Authorization': f'Bearer {API_KEY}'},
            files=files
        )
    return response.json()

# List saved files
def list_files():
    response = requests.get(f'{BASE_URL}/list_cutter/list_saved_files', headers=HEADERS)
    return response.json()</div>
        
        <h3>cURL</h3>
        <div class="code-block"># Get user info
curl -H "Authorization: Bearer cutty_your_key" \\
  ${baseUrl}/api/accounts/user

# Upload file
curl -X POST \\
  -H "Authorization: Bearer cutty_your_key" \\
  -F "file=@data.csv" \\
  ${baseUrl}/api/list_cutter/upload

# List saved files
curl -H "Authorization: Bearer cutty_your_key" \\
  ${baseUrl}/api/list_cutter/list_saved_files

# Process CSV data
curl -X POST \\
  -H "Authorization: Bearer cutty_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"columns": ["name", "email"], "filters": {}}' \\
  ${baseUrl}/api/list_cutter/csv_cutter</div>
      </div>
      
      <div class="section" id="sdks">
        <h2>Error Handling</h2>
        
        <h3>HTTP Status Codes</h3>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Meaning</th>
              <th>Common Causes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>200</td>
              <td>Success</td>
              <td>Request completed successfully</td>
            </tr>
            <tr>
              <td>400</td>
              <td>Bad Request</td>
              <td>Invalid request data or parameters</td>
            </tr>
            <tr>
              <td>401</td>
              <td>Unauthorized</td>
              <td>Invalid or missing API key</td>
            </tr>
            <tr>
              <td>403</td>
              <td>Forbidden</td>
              <td>API key lacks required permissions</td>
            </tr>
            <tr>
              <td>404</td>
              <td>Not Found</td>
              <td>Resource doesn't exist or access denied</td>
            </tr>
            <tr>
              <td>429</td>
              <td>Rate Limited</td>
              <td>Too many requests, check rate limits</td>
            </tr>
            <tr>
              <td>500</td>
              <td>Server Error</td>
              <td>Internal server error</td>
            </tr>
          </tbody>
        </table>
        
        <h3>Error Response Format</h3>
        <div class="code-block">{
  "error": "Insufficient permissions",
  "details": {
    "required": ["files:write"],
    "granted": ["files:read"]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}</div>
        
        <h3>Rate Limit Headers</h3>
        <div class="code-block">X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642252200</div>
      </div>
      
      <div class="info">
        <strong>Need Help?</strong> Visit <a href="/api-keys/manage">API Key Management</a> to create and manage your keys, 
        or check the <a href="/api/api-keys/info">API configuration endpoint</a> for current limits and available permissions.
      </div>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}