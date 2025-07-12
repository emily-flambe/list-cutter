import type { Env } from '../../types';
import { APIKeyService } from '../../services/auth/apiKeys';
import { requireAuth } from '../../middleware/auth';
import { PERMISSION_DESCRIPTIONS, PERMISSION_PRESETS } from '../../types/permissions';

export async function renderAPIKeyManagement(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await requireAuth(request, env);
  const apiKeyService = new APIKeyService(env);
  const keys = await apiKeyService.listAPIKeys(user.user_id);
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>API Key Management - List Cutter</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          background: #f5f5f5; 
          margin: 0; 
          padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
          background: white; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 20px; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header h1 { color: #2c5aa0; }
        .header p { color: #666; margin-top: 5px; }
        .card { 
          background: white; 
          border-radius: 8px; 
          padding: 20px; 
          margin-bottom: 20px; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .key-card { 
          border: 1px solid #e0e0e0; 
          border-radius: 6px; 
          padding: 15px; 
          margin: 10px 0; 
          background: #fafafa;
        }
        .key-card.inactive { opacity: 0.6; background: #f0f0f0; }
        .key-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; }
        .key-name { font-weight: bold; color: #2c5aa0; }
        .key-status { 
          padding: 4px 8px; 
          border-radius: 4px; 
          font-size: 0.8em; 
          font-weight: bold; 
          text-transform: uppercase;
        }
        .status-active { background: #d4edda; color: #155724; }
        .status-expired { background: #f8d7da; color: #721c24; }
        .status-revoked { background: #e2e3e5; color: #383d41; }
        .permissions { 
          display: flex; 
          flex-wrap: wrap; 
          gap: 4px; 
          margin: 10px 0; 
        }
        .permission-tag { 
          background: #e3f2fd; 
          color: #1976d2; 
          padding: 2px 8px; 
          border-radius: 12px; 
          font-size: 0.8em;
        }
        .form-group { margin: 15px 0; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
        .form-group input, .form-group select { 
          width: 100%; 
          padding: 10px; 
          border: 1px solid #ddd; 
          border-radius: 4px; 
          font-size: 14px;
        }
        .form-group select[multiple] { height: 120px; }
        .btn { 
          padding: 10px 20px; 
          border: none; 
          border-radius: 4px; 
          cursor: pointer; 
          font-size: 14px; 
          font-weight: 500;
          text-decoration: none;
          display: inline-block;
          text-align: center;
        }
        .btn-primary { background: #2c5aa0; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .btn:hover { opacity: 0.9; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-text { font-size: 0.9em; color: #666; margin-top: 10px; }
        .warning { 
          background: #fff3cd; 
          color: #856404; 
          padding: 10px; 
          border-radius: 4px; 
          margin: 10px 0; 
          border-left: 4px solid #ffc107;
        }
        .success { 
          background: #d4edda; 
          color: #155724; 
          padding: 10px; 
          border-radius: 4px; 
          margin: 10px 0; 
          border-left: 4px solid #28a745;
        }
        .error { 
          background: #f8d7da; 
          color: #721c24; 
          padding: 10px; 
          border-radius: 4px; 
          margin: 10px 0; 
          border-left: 4px solid #dc3545;
        }
        .meta { font-size: 0.85em; color: #666; }
        .actions { margin-top: 15px; }
        .preset-buttons { display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap; }
        .preset-btn { 
          padding: 5px 10px; 
          border: 1px solid #ddd; 
          background: white; 
          border-radius: 4px; 
          cursor: pointer; 
          font-size: 0.85em;
        }
        .preset-btn:hover { background: #f0f0f0; }
        .hidden { display: none; }
        @media (max-width: 768px) {
          .grid { grid-template-columns: 1fr; }
          .container { padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>API Key Management</h1>
          <p>Manage programmatic access to your List Cutter account</p>
        </div>
        
        <div id="alertContainer"></div>
        
        <div class="grid">
          <div class="card">
            <h2>Create New API Key</h2>
            <form id="createKeyForm">
              <div class="form-group">
                <label for="keyName">Name *</label>
                <input type="text" id="keyName" required maxlength="100" placeholder="e.g., Production API, Mobile App" />
                <div class="info-text">Choose a descriptive name to identify this API key</div>
              </div>
              
              <div class="form-group">
                <label for="permissions">Permissions *</label>
                <div class="preset-buttons">
                  <button type="button" class="preset-btn" onclick="setPermissionPreset('READ_ONLY')">Read Only</button>
                  <button type="button" class="preset-btn" onclick="setPermissionPreset('BASIC_USER')">Basic User</button>
                  <button type="button" class="preset-btn" onclick="setPermissionPreset('LIST_PROCESSING')">List Processing</button>
                  <button type="button" class="preset-btn" onclick="setPermissionPreset('FULL_ACCESS')">Full Access</button>
                </div>
                <select id="permissions" multiple required>
                  ${Object.entries(PERMISSION_DESCRIPTIONS).map(([perm, desc]) => 
                    `<option value="${perm}">${perm} - ${desc}</option>`
                  ).join('')}
                </select>
                <div class="info-text">Hold Ctrl/Cmd to select multiple permissions</div>
              </div>
              
              <div class="form-group">
                <label for="expiresIn">Expires In (days)</label>
                <input type="number" id="expiresIn" min="1" max="365" placeholder="Never (leave blank)" />
                <div class="info-text">Leave blank for keys that never expire</div>
              </div>
              
              <div class="form-group">
                <label for="rateLimit">Rate Limit (requests/minute)</label>
                <input type="number" id="rateLimit" min="1" max="10000" placeholder="Default (1000)" />
                <div class="info-text">Custom rate limit for this key (default: 1000/min)</div>
              </div>
              
              <button type="submit" class="btn btn-primary">Create API Key</button>
            </form>
          </div>
          
          <div class="card">
            <h2>API Documentation</h2>
            <p>Use your API keys to access List Cutter programmatically:</p>
            
            <h3>Authentication</h3>
            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">Authorization: Bearer cutty_your_api_key_here</pre>
            
            <h3>Base URL</h3>
            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${new URL(request.url).origin}/api/</pre>
            
            <h3>Example</h3>
            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">curl -H "Authorization: Bearer cutty_your_key" \\
  ${new URL(request.url).origin}/api/accounts/user</pre>
            
            <div class="warning">
              <strong>Security Notice:</strong> Keep your API keys secure. Never share them in client-side code or public repositories.
            </div>
          </div>
        </div>
        
        <div class="card">
          <h2>Your API Keys (${keys.length})</h2>
          
          <div id="apiKeys">
            ${keys.length === 0 ? 
              '<p class="info-text">No API keys created yet. Create your first API key above.</p>' :
              keys.map(key => `
                <div class="key-card ${!key.is_active ? 'inactive' : ''}">
                  <div class="key-header">
                    <div class="key-name">${key.name}</div>
                    <div class="key-status status-${getKeyStatus(key)}">${getKeyStatus(key)}</div>
                  </div>
                  
                  <div class="meta">
                    <strong>Key ID:</strong> ${key.key_id}<br>
                    <strong>Created:</strong> ${new Date(key.created_at!).toLocaleDateString()}<br>
                    <strong>Last Used:</strong> ${key.last_used ? new Date(key.last_used).toLocaleDateString() : 'Never'}<br>
                    ${key.expires_at ? `<strong>Expires:</strong> ${new Date(key.expires_at).toLocaleDateString()}<br>` : ''}
                    ${key.rate_limit_override ? `<strong>Rate Limit:</strong> ${key.rate_limit_override}/min<br>` : ''}
                  </div>
                  
                  <div class="permissions">
                    ${(key.permissions || []).map(perm => 
                      `<span class="permission-tag">${perm}</span>`
                    ).join('')}
                  </div>
                  
                  <div class="actions">
                    <button class="btn btn-secondary" onclick="viewUsage('${key.key_id}')">View Usage</button>
                    ${key.is_active ? 
                      `<button class="btn btn-danger" onclick="revokeKey('${key.key_id}', '${key.name}')">Revoke</button>` : 
                      '<span class="info-text">Revoked</span>'
                    }
                  </div>
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
      
      <script>
        const PERMISSION_PRESETS = ${JSON.stringify(PERMISSION_PRESETS)};
        
        // Set permission preset
        function setPermissionPreset(presetName) {
          const permissions = PERMISSION_PRESETS[presetName];
          const select = document.getElementById('permissions');
          
          // Clear current selection
          Array.from(select.options).forEach(option => option.selected = false);
          
          // Select preset permissions
          permissions.forEach(permission => {
            const option = Array.from(select.options).find(opt => opt.value === permission);
            if (option) option.selected = true;
          });
        }
        
        // Show alert
        function showAlert(message, type = 'info') {
          const container = document.getElementById('alertContainer');
          const alert = document.createElement('div');
          alert.className = type;
          alert.textContent = message;
          container.appendChild(alert);
          
          setTimeout(() => {
            if (alert.parentNode) {
              alert.parentNode.removeChild(alert);
            }
          }, 5000);
        }
        
        // Get auth token
        function getAuthToken() {
          return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        }
        
        // Create API key form handler
        document.getElementById('createKeyForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const token = getAuthToken();
          if (!token) {
            showAlert('Please log in to create API keys', 'error');
            return;
          }
          
          const formData = {
            name: document.getElementById('keyName').value,
            permissions: Array.from(document.getElementById('permissions').selectedOptions).map(o => o.value),
            expires_in_days: document.getElementById('expiresIn').value ? parseInt(document.getElementById('expiresIn').value) : undefined,
            rate_limit_override: document.getElementById('rateLimit').value ? parseInt(document.getElementById('rateLimit').value) : undefined
          };
          
          if (formData.permissions.length === 0) {
            showAlert('Please select at least one permission', 'error');
            return;
          }
          
          try {
            const response = await fetch('/api/api-keys', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            if (response.ok) {
              showAlert('API Key created successfully! Save this key securely - it will not be shown again.', 'success');
              prompt('Your API Key (save this now):', result.api_key);
              location.reload();
            } else {
              showAlert('Error: ' + result.error, 'error');
            }
          } catch (error) {
            showAlert('Error creating API key: ' + error.message, 'error');
          }
        });
        
        // Revoke API key
        async function revokeKey(keyId, keyName) {
          if (!confirm(\`Are you sure you want to revoke the API key "\${keyName}"? This action cannot be undone.\`)) return;
          
          const token = getAuthToken();
          if (!token) {
            showAlert('Please log in to revoke API keys', 'error');
            return;
          }
          
          try {
            const response = await fetch(\`/api/api-keys/\${keyId}\`, {
              method: 'DELETE',
              headers: {
                'Authorization': 'Bearer ' + token
              }
            });
            
            const result = await response.json();
            if (response.ok) {
              showAlert('API key revoked successfully', 'success');
              location.reload();
            } else {
              showAlert('Error: ' + result.error, 'error');
            }
          } catch (error) {
            showAlert('Error revoking API key: ' + error.message, 'error');
          }
        }
        
        // View usage statistics
        async function viewUsage(keyId) {
          const token = getAuthToken();
          if (!token) {
            showAlert('Please log in to view usage statistics', 'error');
            return;
          }
          
          try {
            const response = await fetch(\`/api/api-keys/\${keyId}/usage?details=true\`, {
              method: 'GET',
              headers: {
                'Authorization': 'Bearer ' + token
              }
            });
            
            const result = await response.json();
            if (response.ok) {
              const stats = result.stats;
              const usage = \`Usage Statistics for \${result.key_name}:
              
Total Requests: \${stats.total_requests || 0}
Successful: \${stats.successful_requests || 0}
Errors: \${stats.error_requests || 0}
Average Response Time: \${Math.round(stats.avg_response_time || 0)}ms
              
Period: Last \${result.usage_period_days} days\`;
              
              alert(usage);
            } else {
              showAlert('Error: ' + result.error, 'error');
            }
          } catch (error) {
            showAlert('Error fetching usage: ' + error.message, 'error');
          }
        }
        
        // Check if user is logged in
        window.addEventListener('load', () => {
          const token = getAuthToken();
          if (!token) {
            showAlert('Please log in to manage API keys', 'warning');
          }
        });
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function getKeyStatus(key: any): string {
  if (!key.is_active) {
    return 'revoked';
  }
  
  if (key.expires_at && key.expires_at <= Date.now()) {
    return 'expired';
  }
  
  if (key.expires_at) {
    return 'active';
  }
  
  return 'active';
}