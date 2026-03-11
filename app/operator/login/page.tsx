import { redirect } from "next/navigation";
import { OperatorLoginForm } from "@/components/operator/OperatorLoginForm";
import { getOperatorSession } from "@/lib/operator-session";

export default async function OperatorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getOperatorSession();
  const params = await searchParams;
  const nextPath = params.next || "/operator/status";

  if (session) {
    redirect(nextPath);
  }

  return <OperatorLoginForm nextPath={nextPath} />;
}
