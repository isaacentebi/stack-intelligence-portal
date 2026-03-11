import Link from "next/link";
import { PublicationsApp } from "@/components/operator/PublicationsApp";

export default function ResearchPublicationsPage() {
  return (
    <>
      <PublicationsApp />
      <p style={{ maxWidth: 1100, margin: "24px auto 0 auto", padding: "0 24px" }}>
        <Link href="/research-dashboard/status">Operator Status</Link>
        {" · "}
        <Link href="/research-dashboard/runs">Operator Runs</Link>
        {" · "}
        <Link href="/research-dashboard/bottlenecks">Bottlenecks</Link>
        {" · "}
        <Link href="/research-dashboard/routing">Routing</Link>
      </p>
    </>
  );
}
