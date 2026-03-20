import { redirect } from "next/navigation";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { getOperatorSession } from "@/lib/operator-session";
import { OperatorSWRProvider } from "@/lib/hooks/swr-config";

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
    <OperatorSWRProvider>
      <OperatorShell operatorEmail={session.email}>{children}</OperatorShell>
    </OperatorSWRProvider>
  );
}
