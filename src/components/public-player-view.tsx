import type { PublicPlayer } from "@/lib/sheets/tournaments-public";

export function PublicPlayerView({ player }: { player: PublicPlayer }) {
  return (
    <div className="min-h-dvh bg-background px-4 py-6 flex flex-col gap-6 max-w-md mx-auto" dir="rtl">
      <div className="text-center flex flex-col gap-1">
        <h1 className="bc-num text-[28px] md:text-[36px] leading-[1.05]">{player.name}</h1>
        <p className="text-sm text-muted-foreground">דירוג נוכחי: {player.rating}</p>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-base font-extrabold">טורנירים</h2>
        {player.tournaments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">עדיין לא השתתף/ה בטורנירים</p>
        ) : (
          player.tournaments.map((t) => (
            <a
              key={t.publicSlug}
              href={`/t/${t.publicSlug}`}
              className="rounded-[14px] border bg-card p-3 flex items-center justify-between text-sm hover:border-primary/40 transition-colors"
            >
              <span className="font-medium">{t.name}</span>
              {t.completed && <span className="text-xs text-muted-foreground">הסתיים</span>}
            </a>
          ))
        )}
      </div>
    </div>
  );
}
