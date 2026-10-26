"use client";

import { useSyncExternalStore } from "react";

// A live clock hook: returns the current time (ms), updating every second.
// On the server it returns null, because the server's clock and timezone aren't the user's.
// Components show a placeholder until the browser takes over.
// (useSyncExternalStore is React's tool for "a value that lives outside React", like the clock.)

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}

// Rounded to the second so React sees the same value if it asks twice in one second.
const getSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const getServerSnapshot = () => null;

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
