/* API client — all calls go through here */
export const API_BASE = 'http://localhost:3001';
const BASE = `${API_BASE}/api`;

const ADMIN_TOKEN_KEY = 'ss_admin_token';
export const CUSTOMER_TOKEN_KEY = 'ss_customer_token';
export const CUSTOMER_USER_KEY = 'ss_customer_user';

function getToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

/* ---- Customer session helpers (shop login) ---- */
export function getCustomerToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}
export function saveCustomerToken(token) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
}
export function clearCustomerToken() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_USER_KEY);
}
export function getCustomerUser() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMER_USER_KEY)) || null;
  } catch {
    return null;
  }
}
export function saveCustomerUser(user) {
  localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
}

/* Options: pass { customer: true } to send the customer JWT instead of the admin JWT. */
async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = options.customer ? getCustomerToken() : getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  get:    (path, options) => request(path, options),
  post:   (path, body, options) => request(path, { method: 'POST', body: JSON.stringify(body), ...options }),
  put:    (path, body, options) => request(path, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch:  (path, body, options) => request(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: (path, options) => request(path, { method: 'DELETE', ...options }),

  // Multipart for gallery upload (admin token)
  upload: async (path, formData) => {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData, headers });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  // Multipart upload with the customer token (e.g. profile photo)
  uploadCustomer: async (path, formData) => {
    const headers = {};
    const token = getCustomerToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  auth: {
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  },
  isLoggedIn: () => !!getToken(),
  logout: () => localStorage.removeItem(ADMIN_TOKEN_KEY),
  saveToken: (token) => localStorage.setItem(ADMIN_TOKEN_KEY, token),
};
