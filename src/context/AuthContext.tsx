import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: { 
    name: string; 
    email: string; 
    password?: string; 
    avatarUrl?: string; 
    bio?: string; 
    studyGoal?: string;
    leetcodeUrl?: string;
    hackerrankUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; code?: string; previewCode?: string; emailDelivered?: boolean; message?: string; error?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  allUsers: User[];
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('study_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Fetch initial profile if token exists
  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('study_token');
      if (storedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setToken(storedToken);
          } else {
            localStorage.removeItem('study_token');
            setUser(null);
            setToken(null);
          }
        } catch {
          localStorage.removeItem('study_token');
          setUser(null);
          setToken(null);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setIsLoading(false);
    }
    loadUser();
    refreshUsers();
  }, []);

  const refreshUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const users = await res.json();
        setAllUsers(users);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  };

  const login = async (email: string, password = 'password123'): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: 'Server returned an invalid response' }; }

      if (res.ok && data.token) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('study_token', data.token);
        refreshUsers();
        return { success: true };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch (e: any) {
      console.error('Login error:', e);
      return { success: false, error: e.message || 'Connection error' };
    }
  };

  const signup = async (data: { 
    name: string; 
    email: string; 
    password?: string; 
    avatarUrl?: string; 
    bio?: string; 
    studyGoal?: string;
    leetcodeUrl?: string;
    hackerrankUrl?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password || 'password123',
          avatarUrl: data.avatarUrl,
          bio: data.bio,
          studyGoal: data.studyGoal,
          leetcodeUrl: data.leetcodeUrl,
          hackerrankUrl: data.hackerrankUrl
        })
      });
      const text = await res.text();
      let resData: any = {};
      try { resData = JSON.parse(text); } catch { resData = { error: 'Server returned an invalid response' }; }

      if (res.ok && resData.token) {
        setUser(resData.user);
        setToken(resData.token);
        localStorage.setItem('study_token', resData.token);
        refreshUsers();
        return { success: true };
      }
      return { success: false, error: resData.error || 'Sign up failed' };
    } catch (e: any) {
      console.error('Signup error:', e);
      return { success: false, error: e.message || 'Connection error' };
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; previewCode?: string; emailDelivered?: boolean; message?: string; error?: string }> => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: 'Server returned an invalid response' }; }

      if (res.ok && data.success) {
        return { 
          success: true, 
          message: data.message,
          previewCode: data.previewCode,
          emailDelivered: data.emailDelivered
        };
      }
      return { success: false, error: data.error || 'Failed to send reset code' };
    } catch (e: any) {
      console.error('Forgot password error:', e);
      return { success: false, error: e.message || 'Connection error' };
    }
  };

  const resetPassword = async (email: string, code: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: 'Server returned an invalid response' }; }

      if (res.ok && data.success) {
        if (data.token && data.user) {
          setUser(data.user);
          setToken(data.token);
          localStorage.setItem('study_token', data.token);
          refreshUsers();
        }
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || 'Failed to reset password' };
    } catch (e: any) {
      console.error('Reset password error:', e);
      return { success: false, error: e.message || 'Connection error' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('study_token');
  };

  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        refreshUsers();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      login,
      signup,
      forgotPassword,
      resetPassword,
      logout,
      updateProfile,
      allUsers,
      refreshUsers
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
