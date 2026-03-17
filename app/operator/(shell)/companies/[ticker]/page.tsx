import { CompanyProfilePage } from "@/components/operator/companies/CompanyProfilePage";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  return <CompanyProfilePage ticker={ticker} />;
}
