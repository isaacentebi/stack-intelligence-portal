import Link from "next/link";
import { OperatorRunsApp } from "@/components/operator/OperatorRunsApp";

export default function ResearchRunsPage() {
  return (
    <>
      <OperatorRunsApp />
      <p style={{ maxWidth: 1100, margin: "24px auto 0 auto", padding: "0 24px" }}>
        <Link href="/research-dashboard/status">Operator Status</Link>
        {" · "}
        <Link href="/research-dashboard/reviews">Review Queue</Link>
      </p>
    </>
  );
}
