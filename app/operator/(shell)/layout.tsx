import { OperatorShell } from "@/components/operator/OperatorShell";
import { OperatorAuthGate } from "@/components/ui/OperatorAuthGate";

export default function OperatorShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OperatorAuthGate>
      <OperatorShell>{children}</OperatorShell>
    </OperatorAuthGate>
  );
}
