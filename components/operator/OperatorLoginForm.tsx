"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NeuralStackLogo } from "@/components/ui/NeuralStackLogo";

export function OperatorLoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/operator/session/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `Login failed (${response.status})`);
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setPassword("");
      setError(err instanceof Error ? err.message : "Unknown login error");
      setSubmitting(false);
    }
  }

  return (
    <main className="investor-login-body">
      <div className="investor-login-card">
        <div className="investor-login-logo-wrap">
          <NeuralStackLogo size={64} interactive animate density="high" />
        </div>
        <p className="investor-login-kicker">Stack Intelligence</p>
        <h1 className="investor-login-title">Operator Console</h1>
        <p className="investor-login-subtitle">
          Operator routes are protected by a server-backed session.
        </p>

        <form className="investor-login-form" onSubmit={handleSubmit}>
          <div className="investor-login-field">
            <label className="investor-login-label" htmlFor="operator-email">
              Email
            </label>
            <input
              id="operator-email"
              className="investor-login-input"
              type="email"
              placeholder="name@firm.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="investor-login-field">
            <label className="investor-login-label" htmlFor="operator-pass">
              Password
            </label>
            <input
              id="operator-pass"
              className="investor-login-input"
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button type="submit" className="investor-login-submit" disabled={submitting}>
            {submitting ? "Signing In…" : "Enter Operator"}
          </button>
        </form>

        {error ? <div className="error-msg show">{error}</div> : null}

        <div className="investor-login-footer">
          <Link href="/" className="investor-login-footer-link">
            &larr; Back
          </Link>
        </div>
      </div>
    </main>
  );
}
