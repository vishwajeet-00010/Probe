import { InspectView } from "./inspect-view";
export const metadata = {
  title: "Read-only inspection report",
  robots: { index: false, follow: false },
};
/** The token travels in the URL hash (/inspect#token), so it never reaches server logs. */
export default function Page() {
  return <InspectView />;
}
