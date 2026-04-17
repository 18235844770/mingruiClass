import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { router } from '@/router';

export const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  if (auth.campusId) {
    config.headers['X-Campus-Id'] = auth.campusId;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const payload = err.response?.data as
      | { message?: unknown; error?: unknown }
      | undefined;
    if (payload) {
      // 统一校验错误结构，便于页面直接透传可读 message。
      if (Array.isArray(payload.message)) {
        payload.message = payload.message
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
          .join('；');
      } else if (
        payload.message !== undefined &&
        payload.message !== null &&
        typeof payload.message !== 'string'
      ) {
        payload.message = String(payload.message);
      } else if (
        (payload.message === undefined || payload.message === null || payload.message === '') &&
        typeof payload.error === 'string'
      ) {
        payload.message = payload.error;
      }
    }

    const status = err.response?.status as number | undefined;
    const url = String(err.config?.url ?? '');
    if (status === 401 && !url.includes('/auth/login')) {
      const auth = useAuthStore();
      auth.clear();
      router.replace({ name: 'login' });
      return Promise.reject(err);
    }
    if (status === 403) {
      const auth = useAuthStore();
      router.replace(auth.afterLoginRoute());
    }
    return Promise.reject(err);
  },
);
