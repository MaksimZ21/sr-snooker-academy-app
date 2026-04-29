import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { fetchSessionById } from "@/lib/sheets/sessions";
import { listImagesInFolder } from "@/lib/google/drive";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const session = await fetchSessionById(id);
    if (!session) return new NextResponse("not found", { status: 404 });
    if (user.role === "coach" && session.coach_email !== user.email) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (!session.drive_folder_url) return NextResponse.json({ images: [] });
    const images = await listImagesInFolder(session.drive_folder_url);
    return NextResponse.json({ images });
  } catch (e) {
    if (e instanceof Response) return e;
    return new NextResponse("error", { status: 500 });
  }
}
