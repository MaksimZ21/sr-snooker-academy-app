import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchDriveTree } from "@/lib/google/drive";

export async function GET() {
  try {
    await requireUser();
    const tree = await fetchDriveTree();
    return NextResponse.json(tree);
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "error";
    return new NextResponse(msg, { status: 500 });
  }
}
