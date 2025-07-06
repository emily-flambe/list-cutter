/**
 * Hash password using PBKDF2 with Django-compatible format
 * Django format: pbkdf2_sha256$iterations$salt$hash
 */
export async function hashPassword(password: string): Promise<string> {
  const iterations = 600000; // Django default for security
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    key,
    256
  );
  
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(derived)));
  
  return `pbkdf2_sha256$${iterations}$${saltBase64}$${hashBase64}`;
}

/**
 * Verify password against Django-compatible PBKDF2 hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    // Parse Django format: pbkdf2_sha256$iterations$salt$hash
    const parts = hashedPassword.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
      console.error('Invalid password hash format');
      return false;
    }
    
    const iterations = parseInt(parts[1]);
    const saltBase64 = parts[2];
    const expectedHashBase64 = parts[3];
    
    // Decode salt from base64
    const salt = new Uint8Array(atob(saltBase64).split('').map(c => c.charCodeAt(0)));
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const derived = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      key,
      256
    );
    
    const actualHashBase64 = btoa(String.fromCharCode(...new Uint8Array(derived)));
    
    return actualHashBase64 === expectedHashBase64;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}