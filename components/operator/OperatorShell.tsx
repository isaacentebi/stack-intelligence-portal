"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/operator/status", label: "Status" },
  { href: "/operator/world", label: "World" },
  { href: "/operator/reviews", label: "Reviews" },
  { href: "/operator/runs", label: "Runs" },
  { href: "/operator/publications", label: "Publications" },
  { href: "/operator/bottlenecks", label: "Bottlenecks" },
  { href: "/operator/routing", label: "Routing" },
];

export function OperatorShell({
  children,
  operatorEmail,
}: {
  children: ReactNode;
  operatorEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/operator/session/logout", {
        method: "POST",
      });
    } finally {
      router.push("/operator/login");
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f3ec" }}>
      <header
        style={{
          borderBottom: "1px solid #ddd4c4",
          background: "#fffdf8",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "20px 24px",
            display: "grid",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 12, letterSpacing: "0.08em", color: "#736a5f" }}>OPERATOR</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>Stack Intelligence Operator</div>
              <div style={{ fontSize: 13, color: "#736a5f", marginTop: 4 }}>
                Signed in as <code>{operatorEmail}</code>. Legacy research-dashboard operator URLs redirect here during
                transition.
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                border: "1px solid #cfc4b0",
                borderRadius: 999,
                background: "#fff",
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              {signingOut ? "Signing Out…" : "Sign out"}
            </button>
          </div>

          <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    border: active ? "1px solid #0b5ea8" : "1px solid #d8d0c3",
                    background: active ? "#eef6ff" : "#fff",
                    color: active ? "#0b5ea8" : "#3f3a35",
                    borderRadius: 999,
                    padding: "10px 14px",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 0 40px 0" }}>{children}</div>
    </div>
  );
}
