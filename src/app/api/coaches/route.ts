import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { unstable_cache } from "next/cache";
import { readSheet } from "@/lib/sheets/read";

const fetchAll = unstable_cache(
  async () => {
    const rows = await readSheet("Coaches!A:D");
    const [, ...data] = rows;
    return data.map((r) => ({
      email: r[0] ?? "",
      name: r[1] ?? "",
      phone: r[2] ?? "",
      active: (r[3] ?? "").toUpperCase() === "TRUE",
    }));
  },
  ["coaches:all"],
  { revalidate: 300, tags: ["coaches"] },
);

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json({ coaches: await fetchAll() });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
