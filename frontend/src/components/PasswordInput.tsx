"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass } from "./form";

// A password box with an eye button to show / hide what's typed.
// Takes every normal <input> prop (name, value, onChange, autoComplete, required, ...).
// defaultVisible: start shown (e.g. the admin's generated temporary password).
export default function PasswordInput({
  defaultVisible = false,
  className = "",
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { defaultVisible?: boolean }) {
  const [visible, setVisible] = useState(defaultVisible);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        spellCheck={false}
        autoCapitalize="none" // phones shouldn't capitalise the first letter of a password
        className={`${inputClass} pr-11 ${className}`}
      />
      <button
        type="button" // a plain button: never submits the form
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 sm:size-8"
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
