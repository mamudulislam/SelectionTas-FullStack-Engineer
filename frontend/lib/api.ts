import axios, { AxiosInstance } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
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
    api.post('/auth/logout'),
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