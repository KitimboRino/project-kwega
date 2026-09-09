"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "@/components/Icons";

// Drop-in replacement for <input type="password" /> — same props (value,
// onChange, required, minLength, placeholder, …), plus a show/hide toggle.
// Renders inside whatever wraps it (usually a .field div next to a
// <label>), so the caller's markup barely changes.
export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input">
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? Icon.eyeOff : Icon.eye}
      </button>
    </div>
  );
}
