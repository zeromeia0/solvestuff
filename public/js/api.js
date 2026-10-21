const BASE = (window.SOLVESTUFF_API_BASE || '').replace(/\/$/, '');
const ADMIN_KEY = 'solvestuff.adminToken';

export class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function getAdminToken() {
  try {
    return sessionStorage.getItem(ADMIN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token) {
  try {
    if (token) sessionStorage.setItem(ADMIN_KEY, token);
    else sessionStorage.removeItem(ADMIN_KEY);
  } catch {}
}

async function request(method, path, body, { admin = false } = {}) {
  const headers = {};
  if (admin) headers.Authorization = `Bearer ${getAdminToken()}`;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'server_error');
  return data;
}

let curriculumCache = null;

export async function getCurriculum({ fresh = false } = {}) {
  if (!curriculumCache || fresh) curriculumCache = await request('GET', '/api/curriculum');
  return curriculumCache;
}

export function listSheets(filter = {}) {
  const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
  return request('GET', `/api/sheets${qs.size ? `?${qs}` : ''}`).then((d) => d.sheets);
}

export const fileUrl = (id, download = false) =>
  `${BASE}/api/sheets/${encodeURIComponent(id)}/file${download ? '?download=1' : ''}`;

export const admin = {
  login: (password) => request('POST', '/api/admin/login', { password }),
  logout: () => request('POST', '/api/admin/logout', null, { admin: true }),
  me: () => request('GET', '/api/admin/me', null, { admin: true }),
  uploadSheet: (form) => request('POST', '/api/admin/sheets', form, { admin: true }),
  updateSheet: (id, fields) => request('PATCH', `/api/admin/sheets/${id}`, fields, { admin: true }),
  deleteSheet: (id) => request('DELETE', `/api/admin/sheets/${id}`, null, { admin: true }),
  updateLevel: (level, fields) => request('PATCH', `/api/admin/levels/${level}`, fields, { admin: true }),
  addTopic: (level, fields) => request('POST', `/api/admin/levels/${level}/topics`, fields, { admin: true }),
  updateTopic: (level, topic, fields) =>
    request('PATCH', `/api/admin/levels/${level}/topics/${topic}`, fields, { admin: true }),
  deleteTopic: (level, topic) =>
    request('DELETE', `/api/admin/levels/${level}/topics/${topic}`, null, { admin: true }),
  sequence: () => request('GET', '/api/admin/sequence', null, { admin: true }),
  listStudents: () => request('GET', '/api/admin/students', null, { admin: true }).then((d) => d.students),
  getStudent: (id) => request('GET', `/api/admin/students/${id}`, null, { admin: true }),
  addStudent: (fields) => request('POST', '/api/admin/students', fields, { admin: true }),
  updateStudent: (id, fields) => request('PATCH', `/api/admin/students/${id}`, fields, { admin: true }),
  setProgress: (id, topics) => request('PATCH', `/api/admin/students/${id}/progress`, { topics }, { admin: true }),
  deleteStudent: (id) => request('DELETE', `/api/admin/students/${id}`, null, { admin: true }),
};
