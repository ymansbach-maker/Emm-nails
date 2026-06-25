// All server communication. VITE_API_URL points at the Render backend in
// production; in dev the Vite proxy forwards /api to localhost:3001.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

// Current business — when multi-business pages arrive, this becomes a route param.
export const BUSINESS_SLUG = 'emm-nails';

export interface Slot {
  time: string;
  available: boolean;
}

export interface Appointment {
  id: number;
  date: string;
  time: string | null;       // null for after-hours bookings
  name: string;
  phone: string;
  email: string | null;
  service: string | null;
  duration: number | null;
  notes: string | null;
  is_personal: number | null;    // 1 = admin personal block
  is_after_hours: number | null; // 1 = after-hours, time TBD
  paid: number | null;           // 1 = paid online
  created_at: string;
}

export interface Block {
  id: number;
  date: string;
  time: string; // '' = whole day
}

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (body as { error?: string }).error ?? 'unknown');
  }
  return body as T;
}

export function getAvailability(date: string): Promise<{ date: string; slots: Slot[] }> {
  return request(`/api/b/${BUSINESS_SLUG}/availability?date=${date}`);
}

export function bookAppointment(data: {
  date: string;
  time: string | null;
  name: string;
  phone: string;
  email: string;
  service: string;
  duration: number;
}): Promise<{ id: number }> {
  return request(`/api/b/${BUSINESS_SLUG}/book`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// --- Admin ---

const TOKEN_KEY = 'gemmys_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function adminLogin(password: string): Promise<void> {
  const { token } = await request<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  localStorage.setItem(TOKEN_KEY, token);
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getToken() ?? ''}` };
}

export function adminGetAppointments(date?: string): Promise<{ appointments: Appointment[] }> {
  const q = date ? `?date=${date}` : '';
  return request(`/api/admin/appointments${q}`, { headers: authHeaders() });
}

export function adminDeleteAppointment(id: number): Promise<{ ok: true }> {
  return request(`/api/admin/appointments/${id}`, { method: 'DELETE', headers: authHeaders() });
}

export function adminPatchAppointmentDuration(id: number, duration: number): Promise<{ ok: true }> {
  return request(`/api/admin/appointments/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ duration }),
  });
}

export function adminPatchAppointmentTime(id: number, time: string): Promise<{ ok: true }> {
  return request(`/api/admin/appointments/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ time }),
  });
}

export function adminPatchAppointmentNotes(id: number, notes: string): Promise<{ ok: true }> {
  return request(`/api/admin/appointments/${id}/notes`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ notes }),
  });
}

export function adminCreateAppointment(data: {
  name: string;
  phone: string;
  date: string;
  time: string;
  service: string | null;
  duration: number;
  is_personal: boolean;
}): Promise<{ id: number; date: string; time: string; name: string }> {
  return request('/api/admin/appointments', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export function adminGetBlocks(): Promise<{ blocks: Block[] }> {
  return request('/api/admin/blocks', { headers: authHeaders() });
}

export function adminCreateBlock(date: string, time: string): Promise<Block> {
  return request('/api/admin/blocks', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ date, time }),
  });
}

export function adminDeleteBlock(id: number): Promise<{ ok: true }> {
  return request(`/api/admin/blocks/${id}`, { method: 'DELETE', headers: authHeaders() });
}

// --- Customer ---

export function lookupAppointment(data: { email: string; phone: string }): Promise<{ appointment: Pick<Appointment, 'id' | 'date' | 'time' | 'name'> }> {
  return request('/api/appointments/lookup', { method: 'POST', body: JSON.stringify(data) });
}

export function cancelOwnAppointment(data: { email: string; phone: string }): Promise<{ ok: true }> {
  return request('/api/appointments/cancel-own', { method: 'DELETE', body: JSON.stringify(data) });
}

export function joinWaitingList(data: { date: string; name: string; phone: string; email: string }): Promise<{ ok: true }> {
  return request(`/api/b/${BUSINESS_SLUG}/waiting-list`, { method: 'POST', body: JSON.stringify(data) });
}

// --- Admin waiting list ---

export interface WaitingListEntry {
  id: number;
  date: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
}

export function adminGetWaitingList(): Promise<{ entries: WaitingListEntry[] }> {
  return request('/api/admin/waiting-list', { headers: authHeaders() });
}

export function adminDeleteWaitingListEntry(id: number): Promise<{ ok: true }> {
  return request(`/api/admin/waiting-list/${id}`, { method: 'DELETE', headers: authHeaders() });
}

// --- Reviews ---

export interface Review {
  id: number;
  name: string;
  rating: number;
  text: string | null;
  created_at: string;
}

export function submitReview(data: {
  name: string;
  email: string;
  phone: string;
  rating: number;
  text: string;
}): Promise<{ ok: true; review: Review }> {
  return request('/api/reviews', { method: 'POST', body: JSON.stringify(data) });
}

export function getReviews(): Promise<{ reviews: Review[] }> {
  return request('/api/reviews');
}

// --- Admin service colors ---

export function adminGetServiceColors(): Promise<{ colors: Record<string, string> }> {
  return request('/api/admin/service-colors', { headers: authHeaders() });
}

export function adminSetServiceColors(colors: Record<string, string>): Promise<{ ok: true }> {
  return request('/api/admin/service-colors', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ colors }),
  });
}

// --- Admin reviews ---

export function adminGetReviews(): Promise<{ reviews: Review[] }> {
  return request('/api/admin/reviews', { headers: authHeaders() });
}

export function adminDeleteReview(id: number): Promise<{ ok: true }> {
  return request(`/api/admin/reviews/${id}`, { method: 'DELETE', headers: authHeaders() });
}

// --- Payments ---

export interface PaymentResult {
  success: boolean;
  transactionId?: string | null;
  error?: string;
  message?: string;
}

// --- Public payments ---

export function getPaymentConfig(): Promise<{ paymentEnabled: boolean }> {
  return request('/api/payments/config');
}

export function createPaymentSession(appointmentId: number): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  return request('/api/payments/create-session', {
    method: 'POST',
    body: JSON.stringify({ appointmentId }),
  });
}

export function confirmPayment(appointmentId: number): Promise<{ success: boolean }> {
  return request('/api/payments/confirm', {
    method: 'POST',
    body: JSON.stringify({ appointmentId }),
  });
}

export function adminChargePayment(appointmentId: number, amount: number): Promise<PaymentResult> {
  return request('/api/admin/payments/charge', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ appointmentId, amount }),
  });
}
