import Link from "next/link";
import { ReviewQueueApp } from "@/components/operator/ReviewQueueApp";

export default async function ResearchReviewQueuePage() {
  return (
    <>
      <ReviewQueueApp />
      <p style={{ maxWidth: 1100, margin: "24px auto 0 auto", padding: "0 24px" }}>
        <Link href="/research-dashboard/status">Operator Status</Link>
        {" · "}
        <Link href="/research-dashboard/runs">Operator Runs</Link>
        {" · "}
        <Link href="/research-dashboard/world">World Model</Link>
      </p>
    </>
  );
}
