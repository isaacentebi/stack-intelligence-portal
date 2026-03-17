import { Suspense } from "react";
import { OperatorWorldModelPage } from "@/components/operator/world/OperatorWorldModelPage";

export default function OperatorWorldPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: "#aaa" }}>Loading world model…</div>}>
      <OperatorWorldModelPage />
    </Suspense>
  );
}
