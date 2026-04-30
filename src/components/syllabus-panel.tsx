"use client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

type Image = { id: string; name: string; thumbnailUrl: string; fullUrl: string };

export function SyllabusPanel({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["syllabus", sessionId],
    queryFn: async () => {
      const r = await fetch(`/api/sessions/${sessionId}/syllabus`);
      if (!r.ok) throw new Error("fetch failed");
      return (await r.json()) as { images: Image[] };
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="w-full h-32 rounded" />
        ))}
      </div>
    );
  }
  const images = data?.images ?? [];
  if (images.length === 0)
    return <div className="p-4 text-muted-foreground">אין תמונות עדיין</div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
      {images.map((img) => (
        <a key={img.id} href={img.fullUrl} target="_blank" rel="noopener" className="block">
          <img src={img.thumbnailUrl} alt={img.name} className="w-full h-32 object-cover rounded" loading="lazy" />
          <div className="text-xs mt-1 truncate">{img.name}</div>
        </a>
      ))}
    </div>
  );
}
