"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/operator/status", label: "Status" },
  { href: "/operator/world", label: "World" },
  { href: "/operator/companies", label: "Companies" },
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

  const isFullBleed = pathname === "/operator/world";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/operator/session/logout", { method: "POST" });
    } finally {
      router.push("/operator/login");
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <div className="si">
      <header className="si-bar">
        <Link href="/operator/status" className="si-brand">
          Stack Intelligence
        </Link>

        <nav className="si-nav">
          {NAV.map((item) => {
            const on =
              pathname === item.href ||
              (item.href === "/operator/companies" &&
                pathname.startsWith("/operator/companies"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`si-nav-item${on ? " si-nav-item--on" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="si-bar-right">
          <span className="si-bar-email">{operatorEmail}</span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="si-bar-signout"
          >
            {signingOut ? "..." : "Sign Out"}
          </button>
        </div>
      </header>

      <main className={isFullBleed ? "si-main si-main--bleed" : "si-main"}>
        {children}
      </main>
    </div>
  );
}
