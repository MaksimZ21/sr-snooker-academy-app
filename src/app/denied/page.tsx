import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DeniedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <main className="min-h-screen grid place-items-center p-4 text-center">
      <div className="max-w-md">
        <h1 className="bc-num text-[28px] md:text-[36px] leading-[1.05] mb-2">אין הרשאה</h1>
        <p className="text-muted-foreground mb-4">
          המשתמש <span className="font-mono">{user?.email}</span> אינו מורשה. פנה למנהל האקדמיה.
        </p>
      </div>
    </main>
  );
}
