import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('qm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const message =
        'Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.';
      window.dispatchEvent(
        new CustomEvent('hdmarket:network-error', {
          detail: { message },
          bubbles: true,
          cancelable: false
        })
      );
    }
    return Promise.reject(error);
  }
);

export default api;
