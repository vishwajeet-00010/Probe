import { notFound } from "next/navigation";
import { SettingsPage } from "@/components/management";
const sections = ["business", "limits", "notifications", "billing"];
export const dynamicParams = false;
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <SettingsPage section={section} />;
}
