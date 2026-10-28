"use client";

import { useAuth } from "./AuthProvider";

// Shows its contents only to accounts tracked as employees.
// The Hive Leader (isEmployee = false) doesn't clock in, so check-in and month stats are hidden for her.
export default function EmployeeOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.isEmployee ? <>{children}</> : null;
}
