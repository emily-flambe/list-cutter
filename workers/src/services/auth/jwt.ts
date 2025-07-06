import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { UserJWTPayload, User, TokenPair, Env, RefreshTokenData, BlacklistedToken } from '../../types';
import { ApiError } from '../../middleware/error';

const JWT_ALGORITHM = 'HS256';

/**
 * Generate JWT token with specified payload and expiration
 */
export async function generateJWT(
  payload: Omit<UserJWTPayload, 'exp' | 'iat' | 'jti'>,
  secret: string,
  expiresIn: string
): Promise<string> {
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseExpiresIn(expiresIn);
  
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);
  
  const jwt = await new SignJWT({
    ...payload,
    jti,
    exp,
    iat: now
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(secretKey);
  
  return jwt;
}

/**
 * Verify JWT token and return payload
 */
export async function verifyJWT(token: string, secret: string): Promise<UserJWTPayload | null> {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);
    
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [JWT_ALGORITHM]
    });
    
    // Validate required fields exist
    if (typeof payload.user_id !== 'number' || typeof payload.username !== 'string') {
      throw new Error('Invalid token payload');
    }
    
    return payload as unknown as UserJWTPayload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Generate access and refresh token pair for user
 */
export async function generateTokenPair(
  user: User,
  env: Env
): Promise<TokenPair> {
  const access_token = await generateJWT(
    {
      user_id: user.id,
      username: user.username,
      email: user.email,
      token_type: 'access'
    },
    env.JWT_SECRET,
    '10m'
  );
  
  const refresh_token = await generateJWT(
    {
      user_id: user.id,
      username: user.username,
      email: user.email,
      token_type: 'refresh'
    },
    env.JWT_SECRET,
    '1d'
  );
  
  // Store refresh token in KV
  const refreshPayload = await verifyJWT(refresh_token, env.JWT_SECRET);
  if (refreshPayload) {
    const refreshData: RefreshTokenData = {
      user_id: user.id,
      username: user.username,
      expires_at: refreshPayload.exp * 1000
    };
    
    await env.AUTH_KV.put(
      `refresh_token:${refreshPayload.jti}`,
      JSON.stringify(refreshData),
      { expirationTtl: 86400 } // 24 hours
    );
  }
  
  return { access_token, refresh_token };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refresh_token: string,
  env: Env
): Promise<TokenPair | null> {
  // Verify refresh token
  const payload = await verifyJWT(refresh_token, env.JWT_SECRET);
  if (!payload || payload.token_type !== 'refresh') {
    return null;
  }
  
  // Check if token exists in KV and is not blacklisted
  const storedTokenData = await env.AUTH_KV.get(`refresh_token:${payload.jti}`);
  const blacklisted = await env.AUTH_KV.get(`blacklist:${payload.jti}`);
  
  if (!storedTokenData || blacklisted) {
    return null;
  }
  
  const tokenData: RefreshTokenData = JSON.parse(storedTokenData);
  
  // Blacklist old refresh token
  const blacklistData: BlacklistedToken = {
    reason: 'token_rotated',
    blacklisted_at: Date.now()
  };
  
  await env.AUTH_KV.put(
    `blacklist:${payload.jti}`,
    JSON.stringify(blacklistData),
    { expirationTtl: 86400 } // Keep for 24 hours
  );
  
  // Generate new token pair
  const user: User = {
    id: tokenData.user_id,
    username: tokenData.username,
    email: payload.email || '',
    created_at: new Date().toISOString()
  };
  
  return generateTokenPair(user, env);
}

/**
 * Blacklist a token (for logout)
 */
export async function blacklistToken(token: string, reason: string, env: Env): Promise<void> {
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return;
  }
  
  const blacklistData: BlacklistedToken = {
    reason,
    blacklisted_at: Date.now()
  };
  
  await env.AUTH_KV.put(
    `blacklist:${payload.jti}`,
    JSON.stringify(blacklistData),
    { expirationTtl: payload.token_type === 'access' ? 600 : 86400 } // Match token lifetime
  );
}

/**
 * Check if token is blacklisted
 */
export async function isTokenBlacklisted(token: string, env: Env): Promise<boolean> {
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    return true; // Invalid tokens are considered blacklisted
  }
  
  const blacklisted = await env.AUTH_KV.get(`blacklist:${payload.jti}`);
  return !!blacklisted;
}

/**
 * Parse expiration string to seconds
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid expiresIn format');
  
  const [, value, unit] = match;
  const num = parseInt(value);
  
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: throw new Error('Invalid time unit');
  }
}

// Legacy compatibility functions
export async function signJWT(user: User, secret: string): Promise<string> {
  return generateJWT(
    {
      user_id: user.id,
      username: user.username,
      email: user.email,
      token_type: 'access'
    },
    secret,
    '24h'
  );
}

export async function refreshJWT(token: string, secret: string): Promise<string | null> {
  // This is a simplified version for backwards compatibility
  // In practice, should use refreshAccessToken with KV storage
  const payload = await verifyJWT(token, secret);
  if (!payload) {
    return null;
  }

  const user: User = {
    id: payload.user_id,
    username: payload.username,
    email: payload.email || '',
    created_at: new Date().toISOString()
  };

  return signJWT(user, secret);
}