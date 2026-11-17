import { notFound } from "next/navigation";
import {
  Checklists,
  EquipmentPage,
  Issues,
  Logs,
  Suppliers,
} from "@/components/operations";
import {
  AuditLog,
  Notifications,
  Onboarding,
  Reports,
  SettingsPage,
  Team,
} from "@/components/management";
const pages: Record<string, React.ComponentType> = {
  logs: Logs,
  equipment: EquipmentPage,
  issues: Issues,
  suppliers: Suppliers,
  checklists: Checklists,
  reports: Reports,
  team: Team,
  notifications: Notifications,
  audit: AuditLog,
  onboarding: Onboarding,
  settings: SettingsPage,
};
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(pages).map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const Component = pages[section];
  if (!Component) notFound();
  return <Component />;
}
