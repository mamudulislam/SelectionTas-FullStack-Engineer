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
      
      if (storedToken) {
        try {
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
          console.error('Initial auth validation failed');
          Cookies.remove('token');
          setState({ token: null, user: null, loading: false });
        }
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password });
      const { accessToken, user: userData } = response.data;
      
      const cookieOptions = { expires: 1/24, path: '/', sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' } as const;
      Cookies.set('token', accessToken, cookieOptions);
      
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
      const { accessToken, user: userData } = response.data;
      
      const cookieOptions = { expires: 1/24, path: '/', sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' } as const;
      Cookies.set('token', accessToken, cookieOptions);
      
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
      await authAPI.logout();
    } catch {
    } finally {
      Cookies.remove('token');
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