"use client";

import { createContext, useContext } from "react";

export const ProfileContext = createContext<(id: string) => void>(() => {});

export const useOpenProfile = () => useContext(ProfileContext);

export type ProfileAction = { type: "edit" | "attendance"; id: string };

export const PROFILE_ACTION = "profile-action";

export const sendProfileAction = (action: ProfileAction) => window.dispatchEvent(new CustomEvent<ProfileAction>(PROFILE_ACTION, { detail: action }));

export function onProfileAction(type: ProfileAction["type"], handler: (id: string) => void) {
  const listener = (e: Event) => {
    const { detail } = e as CustomEvent<ProfileAction>;
    if (detail.type === type) handler(detail.id);
  };
  window.addEventListener(PROFILE_ACTION, listener);
  return () => window.removeEventListener(PROFILE_ACTION, listener);
}
