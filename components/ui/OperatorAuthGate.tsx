"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

function hasOperatorAccess() {
  return (
    sessionStorage.getItem("operator_auth") === "1" ||
    sessionStorage.getItem("investor_auth") === "1"
  );
}

export function OperatorAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const authenticated = hasOperatorAccess();
    setIsAuthenticated(authenticated);
    setIsReady(true);

    if (!authenticated) {
      const next = pathname && pathname !== "/operator/login" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/operator/login${next}`);
    }
  }, [pathname, router]);

  if (!isReady || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
