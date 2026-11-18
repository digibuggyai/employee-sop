export type ViewAs = { id: string; name: string };

const KEY = "viewAs";

export function getViewAs(): ViewAs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ViewAs) : null;
  } catch {
    return null;
  }
}

export function startViewAs(person: ViewAs) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(person));
  } catch {}
  window.location.assign(`${window.location.origin}/`);
}

export function stopViewAs() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  window.location.assign(`${window.location.origin}/admin`);
}

export function viewAsSnapshot(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
