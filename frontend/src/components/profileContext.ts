"use client";

import { createContext, useContext } from "react";

export const ProfileContext = createContext<(id: string) => void>(() => {});

export const useOpenProfile = () => useContext(ProfileContext);
