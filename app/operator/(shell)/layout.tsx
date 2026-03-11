import { redirect } from "next/navigation";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { getOperatorSession } from "@/lib/operator-session";

export default async function OperatorShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getOperatorSession();
  if (!session) {
    redirect("/operator/login");
  }

  return (
    <OperatorShell operatorEmail={session.email}>{children}</OperatorShell>
  );
}
