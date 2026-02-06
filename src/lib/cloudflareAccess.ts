/**
 * Cloudflare Access Authentication Service
 * 
 * Este servicio maneja la autenticación mediante Cloudflare Access (Zero Trust).
 * Cloudflare inyecta headers JWT cuando el usuario está autenticado.
 * 
 * Headers relevantes:
 * - Cf-Access-Jwt-Assertion: JWT firmado por Cloudflare
 * - Cf-Access-Authenticated-User-Email: Email del usuario
 * 
 * @see https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

import type { User } from '@/types';

// Cloudflare Access JWT payload structure
export interface CfAccessJwtPayload {
  aud: string[];           // Application audience (AUD tag)
  email: string;           // User email
  exp: number;             // Expiration timestamp
  iat: number;             // Issued at timestamp
  nbf: number;             // Not before timestamp
  iss: string;             // Issuer (your team domain)
  type: string;            // Token type
  identity_nonce: string;  // Unique identifier
  sub: string;             // Subject (user ID)
  country?: string;        // User's country
  custom?: Record<string, unknown>; // Custom claims from IdP
}

// Role mapping based on email domain or specific emails
// Configure this based on your organization's needs
const ROLE_MAPPINGS: Record<string, User['role']> = {
  // Specific users
  'admin@bvg.com': 'admin',
  'ops@bvg.com': 'ops',
  // Default role for authenticated users
  '_default': 'read',
};

// Admin email patterns (users matching these get admin role)
const ADMIN_PATTERNS = [
  /@bvg\.com$/i,           // All @bvg.com emails are admin
  /@aiautomate\.es$/i,     // All @aiautomate.es emails are admin
];

// Ops email patterns
const OPS_PATTERNS = [
  /ops@/i,                 // Any email starting with ops@
  /operador@/i,            // Any email starting with operador@
];

/**
 * Decode a JWT without verification (verification is done by Cloudflare)
 * Cloudflare Access already validates the JWT at the edge
 */
function decodeJwt(token: string): CfAccessJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    // Handle base64url encoding
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload) as CfAccessJwtPayload;
  } catch (error) {
    console.error('Failed to decode CF Access JWT:', error);
    return null;
  }
}

/**
 * Determine user role based on email
 */
function determineRole(email: string): User['role'] {
  const lowerEmail = email.toLowerCase();
  
  // Check specific mappings first
  if (ROLE_MAPPINGS[lowerEmail]) {
    return ROLE_MAPPINGS[lowerEmail];
  }
  
  // Check admin patterns
  for (const pattern of ADMIN_PATTERNS) {
    if (pattern.test(email)) {
      return 'admin';
    }
  }
  
  // Check ops patterns
  for (const pattern of OPS_PATTERNS) {
    if (pattern.test(email)) {
      return 'ops';
    }
  }
  
  // Default role
  return ROLE_MAPPINGS['_default'] || 'read';
}

/**
 * Extract user name from email
 */
function extractName(email: string): string {
  const localPart = email.split('@')[0];
  // Convert "john.doe" or "john_doe" to "John Doe"
  return localPart
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Check if running behind Cloudflare Access
 * This makes a request to check for CF Access headers
 */
export async function checkCfAccessAuth(): Promise<User | null> {
  try {
    // Make a request to get CF Access identity
    // The /cdn-cgi/access/get-identity endpoint returns user info
    console.log('CF Access: Checking authentication...');
    
    const response = await fetch('/cdn-cgi/access/get-identity', {
      credentials: 'include',
    });
    
    console.log('CF Access: Response status:', response.status);
    
    if (!response.ok) {
      console.log('CF Access: Not authenticated or not behind CF Access');
      return null;
    }
    
    const identity = await response.json();
    console.log('CF Access: Identity received:', identity);
    
    // Cloudflare Access returns email in different fields depending on IdP
    const email = identity.email || identity.user_email || identity.preferred_username;
    
    if (!email) {
      console.log('CF Access: No email found in identity. Available fields:', Object.keys(identity));
      return null;
    }
    
    const role = determineRole(email);
    
    // Try to get name from various possible fields (check each properly)
    let name: string;
    if (identity.name && identity.name !== 'undefined undefined') {
      name = identity.name;
    } else if (identity.given_name && identity.family_name) {
      name = `${identity.given_name} ${identity.family_name}`;
    } else if (identity.given_name) {
      name = identity.given_name;
    } else if (identity.displayName) {
      name = identity.displayName;
    } else {
      // Fallback: extract from email (ferran.torres@... -> "Ferran Torres")
      name = extractName(email);
    }
    
    const user: User = {
      id: identity.id || identity.sub || identity.user_uuid || email,
      email: email,
      name: name,
      role: role,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    
    // Store in sessionStorage for persistence across page reloads
    sessionStorage.setItem('cf_access_user', JSON.stringify(user));
    
    console.log('CF Access: User authenticated', { email, role, name });
    return user;
    
  } catch (error) {
    console.error('CF Access: Error checking auth:', error);
    
    // Try to recover from sessionStorage
    const stored = sessionStorage.getItem('cf_access_user');
    if (stored) {
      try {
        const user = JSON.parse(stored) as User;
        console.log('CF Access: Recovered user from session:', user.email);
        return user;
      } catch {
        sessionStorage.removeItem('cf_access_user');
      }
    }
    
    return null;
  }
}

/**
 * Get CF Access JWT from cookie or header
 * Useful for passing to backend APIs
 */
export function getCfAccessToken(): string | null {
  // Try to get from cookie (CF_Authorization)
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'CF_Authorization') {
      return value;
    }
  }
  return null;
}

/**
 * Decode CF Access token to get user info
 */
export function decodeAccessToken(token: string): CfAccessJwtPayload | null {
  return decodeJwt(token);
}

/**
 * Check if CF Access token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload) return true;
  
  // Check expiration with 60 second buffer
  return Date.now() / 1000 > payload.exp - 60;
}

/**
 * Get logout URL for Cloudflare Access
 * Redirects user to CF Access logout page
 */
export function getCfAccessLogoutUrl(): string {
  return '/cdn-cgi/access/logout';
}

/**
 * Environment detection
 */
export function isCloudflareAccessEnabled(): boolean {
  // Check if we're likely behind CF Access
  // In production, the /cdn-cgi/ path is available
  // For local development (localhost, 127.0.0.1, or private IPs), use local auth
  const hostname = window.location.hostname;
  
  // Local development patterns
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }
  
  // Private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(hostname)) {
    return false;
  }
  
  // Docker internal hostnames
  if (hostname.includes('docker') || hostname.includes('container')) {
    return false;
  }
  
  // If env var is set to disable CF Access
  if (import.meta.env.VITE_DISABLE_CF_ACCESS === 'true') {
    return false;
  }
  
  return true;
}
