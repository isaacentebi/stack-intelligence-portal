import Link from "next/link";
import { RoutingLedgerApp } from "@/components/operator/RoutingLedgerApp";

export default function ResearchRoutingPage() {
  return (
    <>
      <RoutingLedgerApp />
      <p style={{ maxWidth: 1100, margin: "24px auto 0 auto", padding: "0 24px" }}>
        <Link href="/research-dashboard/status">Operator Status</Link>
        {" · "}
        <Link href="/research-dashboard/publications">Publications</Link>
        {" · "}
        <Link href="/research-dashboard/bottlenecks">Bottlenecks</Link>
      </p>
    </>
  );
}
