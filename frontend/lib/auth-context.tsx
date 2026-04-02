'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import api, { authAPI } from './api';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = Cookies.get('token');
      const storedRefreshToken = Cookies.get('refreshToken');
      
      if (storedToken) {
        try {
          // Immediately set header for the first request
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          const response = await authAPI.getMe();
          setState({
            token: storedToken,
            user: {
              id: response.data.id,
              firstName: response.data.firstName,
              lastName: response.data.lastName,
              email: response.data.email,
            },
            loading: false,
          });
        } catch (err) {
          if (storedRefreshToken) {
            await refreshAccessToken(storedRefreshToken);
          } else {
            console.error('Initial auth validation failed');
            Cookies.remove('token');
            setState({ token: null, user: null, loading: false });
          }
        }
      } else if (storedRefreshToken) {
        await refreshAccessToken(storedRefreshToken);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    initAuth();
  }, []);

  const refreshAccessToken = async (refreshToken: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (response.ok) {
        const data = await response.json();
        const cookieOptions = { expires: 1/24, path: '/', sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' } as const;
        Cookies.set('token', data.accessToken, cookieOptions);
        Cookies.set('refreshToken', data.refreshToken, { ...cookieOptions, expires: 7 });
        
        // Update live API instance
        api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;

        setState({
          token: data.accessToken,
          user: {
            id: data.user.id,
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            email: data.user.email,
          },
          loading: false,
        });
      } else {
        Cookies.remove('token');
        Cookies.remove('refreshToken');
        delete api.defaults.headers.common['Authorization'];
        setState({ token: null, user: null, loading: false });
      }
    } catch {
      Cookies.remove('token');
      Cookies.remove('refreshToken');
      delete api.defaults.headers.common['Authorization'];
      setState({ token: null, user: null, loading: false });
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password });
      const { accessToken, refreshToken, user: userData } = response.data;
      
      const cookieOptions = { expires: 1/24, path: '/', sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' } as const;
      Cookies.set('token', accessToken, cookieOptions);
      Cookies.set('refreshToken', refreshToken, { ...cookieOptions, expires: 7 });
      
      // IMPORTANT: Immediately set the Authorization header for subsequent calls on this same page render
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      setState({
        token: accessToken,
        user: {
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
        },
        loading: false,
      });
    } catch (err: any) {
      console.error('Login error:', err?.response?.data || err.message);
      throw err;
    }
  };

  const register = async (firstName: string, lastName: string, email: string, password: string) => {
    try {
      const response = await authAPI.register({ firstName, lastName, email, password });
      const { accessToken, refreshToken, user: userData } = response.data;
      
      const cookieOptions = { expires: 1/24, path: '/', sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' } as const;
      Cookies.set('token', accessToken, cookieOptions);
      if (refreshToken) {
        Cookies.set('refreshToken', refreshToken, { ...cookieOptions, expires: 7 });
      }
      
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      setState({
        token: accessToken,
        user: {
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
        },
        loading: false,
      });
    } catch (err: any) {
      console.error('Registration error:', err?.response?.data || err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = Cookies.get('refreshToken');
      if (refreshToken) {
        await authAPI.logout();
      }
    } catch {
    } finally {
      Cookies.remove('token');
      Cookies.remove('refreshToken');
      delete api.defaults.headers.common['Authorization'];
      setState({ token: null, user: null, loading: false });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        isAuthenticated: !!state.user && !!state.token,
      }}
    >
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
