import { Dashboard } from "@/components/dashboard";

export default function AdminHomePage() {
  return <Dashboard basePath="admin" pollMs={30_000} />;
}
