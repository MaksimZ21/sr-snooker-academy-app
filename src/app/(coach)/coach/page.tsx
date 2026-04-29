import { Dashboard } from "@/components/dashboard";

export default function CoachHomePage() {
  return <Dashboard basePath="coach" pollMs={60_000} />;
}
