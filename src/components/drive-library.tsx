"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronDown, ExternalLink, FolderOpen, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DriveFolder, DriveFile } from "@/lib/google/drive";

const MIME_ICONS: Record<string, string> = {
  "application/vnd.google-apps.document": "📄",
  "application/vnd.google-apps.spreadsheet": "📊",
  "application/vnd.google-apps.presentation": "📽️",
  "application/pdf": "📕",
  "video/mp4": "🎬",
  "video/quicktime": "🎬",
};

function mimeIcon(mimeType: string) {
  if (MIME_ICONS[mimeType]) return MIME_ICONS[mimeType];
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📄";
}

function FileRow({ file }: { file: DriveFile }) {
  return (
    <a
      href={file.webViewLink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
    >
      <span className="text-lg shrink-0 leading-none">{mimeIcon(file.mimeType)}</span>
      <span className="flex-1 text-sm truncate">{file.name}</span>
      <ExternalLink
        size={13}
        className="shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors"
      />
    </a>
  );
}

function FolderSection({ folder }: { folder: DriveFolder }) {
  const [open, setOpen] = useState(true);
  const isEmpty = folder.files.length === 0 && folder.subfolders.length === 0;

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-muted/40 transition-colors w-full text-right"
      >
        <FolderOpen size={16} className="text-amber-500 shrink-0" />
        <span className="flex-1 font-semibold text-sm">{folder.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {folder.files.length + folder.subfolders.length} פריטים
        </span>
        {open ? (
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronLeft size={14} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className={cn("mr-3 border-r border-border/50 pr-2 flex flex-col gap-0.5 mt-0.5")}>
          {isEmpty && (
            <p className="text-xs text-muted-foreground px-3 py-2">תיקייה ריקה</p>
          )}
          {folder.subfolders.map((sub) => (
            <FolderSection key={sub.id} folder={sub} />
          ))}
          {folder.files.map((f) => (
            <FileRow key={f.id} file={f} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DriveLibrary() {
  const { data, isLoading, isError } = useQuery<DriveFolder>({
    queryKey: ["drive:tree"],
    queryFn: async () => {
      const r = await fetch("/api/drive/files");
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <AlertCircle size={36} className="opacity-40" />
        <p className="text-sm text-center">לא ניתן לטעון קבצים כרגע</p>
      </div>
    );
  }

  const hasContent =
    (data?.files.length ?? 0) > 0 || (data?.subfolders.length ?? 0) > 0;

  if (!hasContent) {
    return (
      <div className="p-4 flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <FolderOpen size={36} className="opacity-25" />
        <p className="text-sm">אין קבצים בתיקייה</p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-1">
      {data!.subfolders.map((folder) => (
        <FolderSection key={folder.id} folder={folder} />
      ))}
      {data!.files.map((file) => (
        <FileRow key={file.id} file={file} />
      ))}
    </div>
  );
}
