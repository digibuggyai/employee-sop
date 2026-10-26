// The ONE place that knows where the backend lives.
// Locally it's http://localhost:4000 (from .env.local); on Vercel it'll be the Railway URL.
// NEXT_PUBLIC_ prefix = this value is allowed to be sent to the browser.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Small wrapper around fetch: calls GET <API_URL><path> and returns the parsed JSON.
// <T> lets each caller say what shape of data it expects back (e.g. Holiday[]).
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return res.json();
}

// Same shape as the backend's Holiday type (backend/src/data/holidays.ts).
export type Holiday = {
  date: string;
  name: string;
  type: "Gazetted" | "Compulsory";
};

// Same shape as backend/src/data/notices.ts
export type Notice = {
  title: string;
  body: string;
  category: "Pay" | "Leave" | "Attendance" | "Work";
};
