"use client";

import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });

    setLoading(false);
    if (!response.ok) {
      setError("Incorrect email or password.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={onSubmit} className="grid" style={{ marginTop: 22 }}>
      <div className="field">
        <label>Email</label>
        <input name="email" type="email" defaultValue="admin@example.com" required />
      </div>
      <div className="field">
        <label>Password</label>
        <input name="password" type="password" defaultValue="admin1234" required />
      </div>
      {error ? <div className="error">{error}</div> : null}
      <button className="button" type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
