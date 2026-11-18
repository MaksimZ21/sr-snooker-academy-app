import { AppSplash } from "@/components/app-splash";

// Shown only for the instant it takes to learn the tournament's type; the
// page then shows the ISPA or the academy loading screen.
export default function Loading() {
  return <AppSplash variant="plain" />;
}
