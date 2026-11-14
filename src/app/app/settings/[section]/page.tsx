import { notFound } from "next/navigation";
import { SettingsPage } from "@/components/management";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!["business", "limits", "notifications", "billing"].includes(section))
    notFound();
  return <SettingsPage section={section} />;
}
