import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, AuthState } from '@/types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (roles: ('admin' | 'ops' | 'read')[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user for demo - replace with actual API call
const MOCK_USERS: Record<string, { password: string; user: User }> = {
  'admin@bvg.com': {
    password: 'admin123',
    user: {
      id: '1',
      email: 'admin@bvg.com',
      name: 'Admin User',
      role: 'admin',
      createdAt: '2024-01-01T00:00:00Z',
    },
  },
  'ops@bvg.com': {
    password: 'ops123',
    user: {
      id: '2',
      email: 'ops@bvg.com',
      name: 'Ops User',
      role: 'ops',
      createdAt: '2024-01-01T00:00:00Z',
    },
  },
  'viewer@bvg.com': {
    password: 'view123',
    user: {
      id: '3',
      email: 'viewer@bvg.com',
      name: 'Viewer User',
      role: 'read',
      createdAt: '2024-01-01T00:00:00Z',
    },
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Check for stored session on mount
  useEffect(() => {
    const stored = localStorage.getItem('bvg_session');
    if (stored) {
      try {
        const user = JSON.parse(stored) as User;
        setState({ user, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem('bvg_session');
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // TODO: Replace with actual API call to your backend
    // const response = await fetch('/api/auth/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email, password }),
    // });

    const mockUser = MOCK_USERS[email.toLowerCase()];
    if (mockUser && mockUser.password === password) {
      const user = { ...mockUser.user, lastLogin: new Date().toISOString() };
      localStorage.setItem('bvg_session', JSON.stringify(user));
      setState({ user, isAuthenticated: true, isLoading: false });
      return true;
    }

    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('bvg_session');
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const hasRole = useCallback(
    (roles: ('admin' | 'ops' | 'read')[]) => {
      if (!state.user) return false;
      return roles.includes(state.user.role);
    },
    [state.user]
  );

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
