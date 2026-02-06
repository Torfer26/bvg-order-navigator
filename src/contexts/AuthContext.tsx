import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, AuthState } from '@/types';
import { 
  checkCfAccessAuth, 
  getCfAccessLogoutUrl, 
  isCloudflareAccessEnabled 
} from '@/lib/cloudflareAccess';
import { syncUserFromAuth, type PlatformUser } from '@/lib/usersService';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: ('admin' | 'ops' | 'read')[]) => boolean;
  authMode: 'cloudflare' | 'local';
  platformUser: PlatformUser | null; // Full user from DB
  refreshUser: () => Promise<void>; // Refresh user data from DB
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
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);

  // ============================================================================
  // Sync user with database (auto-registration)
  // ============================================================================
  const syncWithDatabase = async (cfUser: User): Promise<User> => {
    try {
      console.log('Auth: Syncing user with database...', cfUser.email);
      
      const dbUser = await syncUserFromAuth(
        cfUser.email,
        cfUser.name,
        'cloudflare',
        cfUser.id
      );
      
      if (dbUser) {
        console.log('Auth: User synced with DB, role from DB:', dbUser.role);
        setPlatformUser(dbUser);
        
        // Return user with role from database (overrides CF pattern-based role)
        return {
          ...cfUser,
          id: String(dbUser.id),
          role: dbUser.role,
          name: dbUser.name,
        };
      }
      
      console.log('Auth: DB sync failed, using CF user data');
      return cfUser;
    } catch (error) {
      console.error('Auth: Error syncing with database:', error);
      return cfUser;
    }
  };

  // ============================================================================
  // Refresh user data from database
  // ============================================================================
  const refreshUser = useCallback(async () => {
    if (!state.user?.email) return;
    
    try {
      const dbUser = await syncUserFromAuth(
        state.user.email,
        state.user.name,
        authMode === 'cloudflare' ? 'cloudflare' : 'local'
      );
      
      if (dbUser) {
        setPlatformUser(dbUser);
        setState(prev => prev.user ? {
          ...prev,
          user: {
            ...prev.user,
            role: dbUser.role,
            name: dbUser.name,
          }
        } : prev);
      }
    } catch (error) {
      console.error('Auth: Error refreshing user:', error);
    }
  }, [state.user?.email, state.user?.name, authMode]);

  // ============================================================================
  // INITIALIZATION - Check for Cloudflare Access or local session
  // ============================================================================
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('Auth: Initializing authentication...');
      console.log('Auth: Hostname:', window.location.hostname);
      console.log('Auth: CF Access enabled:', isCloudflareAccessEnabled());
      
      // First, try Cloudflare Access authentication
      if (isCloudflareAccessEnabled()) {
        console.log('Auth: Checking Cloudflare Access...');
        
        try {
          const cfUser = await checkCfAccessAuth();
          
          if (cfUser) {
            console.log('Auth: Authenticated via Cloudflare Access', cfUser.email);
            setAuthMode('cloudflare');
            
            // Sync with database to get/create user and get role from DB
            const syncedUser = await syncWithDatabase(cfUser);
            
            setState({
              user: syncedUser,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          } else {
            console.log('Auth: CF Access returned no user, this may indicate an issue');
          }
        } catch (error) {
          console.error('Auth: Cloudflare Access check failed:', error);
        }
      }
      
      // Fallback: Check for local development session
      console.log('Auth: Using local authentication mode');
      setAuthMode('local');
      
      const stored = localStorage.getItem('bvg_session');
      if (stored) {
        try {
          const user = JSON.parse(stored) as User;
          console.log('Auth: Restored local session for', user.email);
          
          // Also sync local user with database
          const dbUser = await syncUserFromAuth(user.email, user.name, 'local');
          if (dbUser) {
            setPlatformUser(dbUser);
            user.role = dbUser.role; // Use role from DB
            user.id = String(dbUser.id);
          }
          
          setState({ user, isAuthenticated: true, isLoading: false });
          return;
        } catch {
          localStorage.removeItem('bvg_session');
        }
      }
      
      console.log('Auth: No authenticated user found');
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
    <AuthContext.Provider value={{ ...state, login, logout, hasRole, authMode, platformUser, refreshUser }}>
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
