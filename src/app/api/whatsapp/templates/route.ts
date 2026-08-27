import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export type WhatsAppTemplate = {
  id: string;
  name: string;
  body: string;
  created_at: string;
};

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data } = await db
      .from("whatsapp_templates")
      .select("*")
      .order("name", { ascending: true });
    return NextResponse.json({ templates: (data ?? []) as WhatsAppTemplate[] });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = z
      .object({
        name: z.string().min(1),
        body: z.string().min(1),
      })
      .parse(await req.json());
    const { data } = await db.from("whatsapp_templates").insert(body).select().single();
    return NextResponse.json({ template: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
