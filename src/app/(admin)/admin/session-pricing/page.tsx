import { redirect } from "next/navigation";

// Session pricing moved into the settings page.
export default function Page() {
  redirect("/admin/settings");
}
