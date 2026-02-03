import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, AuthState } from '@/types';
import { 
  checkCfAccessAuth, 
  getCfAccessLogoutUrl, 
  isCloudflareAccessEnabled 
} from '@/lib/cloudflareAccess';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: ('admin' | 'ops' | 'read')[]) => boolean;
  authMode: 'cloudflare' | 'local';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// LOCAL DEVELOPMENT USERS (Only used when NOT behind Cloudflare Access)
// ============================================================================
const DEV_USERS: Record<string, { password: string; user: User }> = {
  'admin@bvg.com': {
    password: 'admin123',
    user: {
      id: 'dev-1',
      email: 'admin@bvg.com',
      name: 'Admin (Dev)',
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
  },
  'ops@bvg.com': {
    password: 'ops123',
    user: {
      id: 'dev-2',
      email: 'ops@bvg.com',
      name: 'Ops (Dev)',
      role: 'ops',
      createdAt: new Date().toISOString(),
    },
  },
  'viewer@bvg.com': {
    password: 'view123',
    user: {
      id: 'dev-3',
      email: 'viewer@bvg.com',
      name: 'Viewer (Dev)',
      role: 'read',
      createdAt: new Date().toISOString(),
    },
  },
};

// ============================================================================
// AUTH PROVIDER
// ============================================================================
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  
  const [authMode, setAuthMode] = useState<'cloudflare' | 'local'>('local');

  // ============================================================================
  // INITIALIZATION - Check for Cloudflare Access or local session
  // ============================================================================
  useEffect(() => {
    const initializeAuth = async () => {
      // First, try Cloudflare Access authentication
      if (isCloudflareAccessEnabled()) {
        console.log('Auth: Checking Cloudflare Access...');
        
        try {
          const cfUser = await checkCfAccessAuth();
          
          if (cfUser) {
            console.log('Auth: Authenticated via Cloudflare Access', cfUser.email);
            setAuthMode('cloudflare');
            setState({
              user: cfUser,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          }
        } catch (error) {
          console.log('Auth: Cloudflare Access check failed, falling back to local');
        }
      }
      
      // Fallback: Check for local development session
      console.log('Auth: Using local authentication mode');
      setAuthMode('local');
      
      const stored = localStorage.getItem('bvg_session');
      if (stored) {
        try {
          const user = JSON.parse(stored) as User;
          setState({ user, isAuthenticated: true, isLoading: false });
          return;
        } catch {
          localStorage.removeItem('bvg_session');
        }
      }
      
      setState((prev) => ({ ...prev, isLoading: false }));
    };

    initializeAuth();
  }, []);

  // ============================================================================
  // LOGIN - Only for local development mode
  // ============================================================================
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (authMode === 'cloudflare') {
      // In Cloudflare mode, login is handled by CF Access
      // Redirect to CF Access login if needed
      console.log('Auth: In Cloudflare mode, redirecting to CF Access...');
      window.location.reload(); // CF Access will intercept
      return false;
    }
    
    // Local development login
    await new Promise((resolve) => setTimeout(resolve, 300));

    const devUser = DEV_USERS[email.toLowerCase()];
    if (devUser && devUser.password === password) {
      const user = { ...devUser.user, lastLogin: new Date().toISOString() };
      localStorage.setItem('bvg_session', JSON.stringify(user));
      setState({ user, isAuthenticated: true, isLoading: false });
      return true;
    }

    return false;
  }, [authMode]);

  // ============================================================================
  // LOGOUT
  // ============================================================================
  const logout = useCallback(() => {
    if (authMode === 'cloudflare') {
      // Redirect to Cloudflare Access logout
      window.location.href = getCfAccessLogoutUrl();
      return;
    }
    
    // Local logout
    localStorage.removeItem('bvg_session');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, [authMode]);

  // ============================================================================
  // ROLE CHECK
  // ============================================================================
  const hasRole = useCallback(
    (roles: ('admin' | 'ops' | 'read')[]) => {
      if (!state.user) return false;
      return roles.includes(state.user.role);
    },
    [state.user]
  );

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasRole, authMode }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
