"use client";

import { Suspense, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { NeuralStackLogo } from "@/components/ui/NeuralStackLogo";

const DEFAULT_INVESTOR_HASH = "Y2xhbmtlcg==";
const ALLOWED_EMAILS = ["marcos@thestack.capital", "isaac@thestack.capital"];

function OperatorLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/operator/status";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (
      sessionStorage.getItem("operator_auth") === "1" ||
      sessionStorage.getItem("investor_auth") === "1"
    ) {
      router.replace(nextPath);
    }
  }, [nextPath, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accessHash =
      process.env.NEXT_PUBLIC_INVESTOR_ACCESS_HASH ?? DEFAULT_INVESTOR_HASH;

    if (
      ALLOWED_EMAILS.includes(email.toLowerCase().trim()) &&
      btoa(password) === accessHash
    ) {
      sessionStorage.setItem("operator_auth", "1");
      sessionStorage.setItem("investor_auth", "1");
      router.push(nextPath);
      return;
    }

    setPassword("");
    setShowError(true);
    setTimeout(() => setShowError(false), 2000);
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
          Canonical operator surfaces now live under <code>/operator</code>.
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
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="investor-login-submit">
            Enter Operator
          </button>
        </form>

        <div className={`error-msg ${showError ? "show" : ""}`}>
          Incorrect password
        </div>

        <div className="investor-login-footer">
          <Link href="/" className="investor-login-footer-link">
            &larr; Back
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function OperatorLoginPage() {
  return (
    <Suspense fallback={null}>
      <OperatorLoginForm />
    </Suspense>
  );
}
