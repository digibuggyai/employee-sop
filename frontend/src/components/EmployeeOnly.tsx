"use client";

import { useAuth } from "./AuthProvider";

export default function EmployeeOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.isEmployee ? <>{children}</> : null;
}
