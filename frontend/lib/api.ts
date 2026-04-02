import axios, { AxiosInstance } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = Cookies.get('refreshToken');
      if (!refreshToken) {
        Cookies.remove('token');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        Cookies.set('token', accessToken, { expires: 1/24, path: '/', sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' });
        Cookies.set('refreshToken', newRefreshToken, { expires: 7, path: '/', sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' });
        
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        Cookies.remove('token');
        Cookies.remove('refreshToken');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  register: (data: { firstName: string; lastName: string; email: string; password: string; country?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () =>
    api.post('/auth/logout', { refreshToken: Cookies.get('refreshToken') }),
  getMe: () =>
    api.get('/auth/me'),
};

export const postsAPI = {
  getPosts: (page: number = 1, limit: number = 20) =>
    api.get('/posts', { params: { page, limit } }),
  createPost: (formData: FormData) =>
    api.post('/posts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  likePost: (postId: string, action?: 'like' | 'unlike') =>
    api.post(`/posts/${postId}/${action === 'unlike' ? 'unlike' : 'like'}`),
  addComment: (postId: string, content: string) =>
    api.post(`/posts/${postId}/comments`, { content }),
  getComments: (postId: string) =>
    api.get(`/posts/${postId}/comments`),
  likeComment: (postId: string, commentId: string, action?: 'like' | 'unlike') =>
    api.post(`/posts/${postId}/comments/${commentId}/${action === 'unlike' ? 'unlike' : 'like'}`),
  addReply: (postId: string, commentId: string, content: string) =>
    api.post(`/posts/${postId}/comments/${commentId}/replies`, { content }),
  getReplies: (postId: string, commentId: string) =>
    api.get(`/posts/${postId}/comments/${commentId}/replies`),
  likeReply: (postId: string, commentId: string, replyId: string, action?: 'like' | 'unlike') =>
    api.post(`/posts/${postId}/comments/${commentId}/replies/${replyId}/${action === 'unlike' ? 'unlike' : 'like'}`),
};

export default api;
