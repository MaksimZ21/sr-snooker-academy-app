import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db/client";

export type ScheduledMessage = {
  id: string;
  chat_id: string;
  chat_name: string;
  message: string;
  scheduled_at: string;
  status: "pending" | "sent" | "failed";
  created_at: string;
  automation_run_id: string | null;
  automation_name: string | null;
};

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const { data } = await db
      .from("whatsapp_scheduled")
      .select("*")
      .order("scheduled_at", { ascending: true });
    return NextResponse.json({ messages: (data ?? []) as ScheduledMessage[] });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "admin") return new NextResponse("Forbidden", { status: 403 });
    const body = z
      .object({
        chat_id: z.string().min(1),
        chat_name: z.string().default(""),
        message: z.string().min(1),
        scheduled_at: z.string().min(1),
        automation_run_id: z.string().uuid().optional(),
        automation_name: z.string().optional(),
      })
      .parse(await req.json());
    const { data, error } = await db.from("whatsapp_scheduled").insert(body).select().single();
    if (error) {
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    return NextResponse.json({ message: data });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
