import Link from "next/link";
import { BottlenecksApp } from "@/components/operator/BottlenecksApp";

export default function ResearchBottlenecksPage() {
  return (
    <>
      <BottlenecksApp />
      <p style={{ maxWidth: 1100, margin: "24px auto 0 auto", padding: "0 24px" }}>
        <Link href="/research-dashboard/status">Operator Status</Link>
        {" · "}
        <Link href="/research-dashboard/publications">Publications</Link>
        {" · "}
        <Link href="/research-dashboard/routing">Routing</Link>
      </p>
    </>
  );
}
