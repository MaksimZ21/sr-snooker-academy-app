"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronDown,
  ExternalLink,
  FolderOpen,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileVideo,
  FileImage,
  FileAudio,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DriveFolder, DriveFile } from "@/lib/google/drive";

// Each file type in its own color, like the Drive icons people know.
const MIME_ICONS: Record<string, [LucideIcon, string]> = {
  "application/vnd.google-apps.document": [FileText, "#4285f4"],
  "application/vnd.google-apps.spreadsheet": [FileSpreadsheet, "#0f9d58"],
  "application/vnd.google-apps.presentation": [Presentation, "#f4b400"],
  "application/pdf": [FileText, "#db4437"],
};

function mimeIcon(mimeType: string): [LucideIcon, string] {
  if (MIME_ICONS[mimeType]) return MIME_ICONS[mimeType];
  if (mimeType.startsWith("video/")) return [FileVideo, "#db4437"];
  if (mimeType.startsWith("image/")) return [FileImage, "#0f9d58"];
  if (mimeType.startsWith("audio/")) return [FileAudio, "#78716c"];
  return [FileText, "#4285f4"];
}

function FileRow({ file }: { file: DriveFile }) {
  return (
    <a
      href={file.webViewLink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
    >
      {(() => {
        const [Icon, color] = mimeIcon(file.mimeType);
        return (
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1f`, color }}>
            <Icon size={16} strokeWidth={2} />
          </span>
        );
      })()}
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
          {folder.files.length + folder.subfolders.length} ׳₪׳¨׳™׳˜׳™׳
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
            <p className="text-xs text-muted-foreground px-3 py-2">׳×׳™׳§׳™׳™׳” ׳¨׳™׳§׳”</p>
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
        <p className="text-sm text-center">׳׳ ׳ ׳™׳×׳ ׳׳˜׳¢׳•׳ ׳§׳‘׳¦׳™׳ ׳›׳¨׳’׳¢</p>
      </div>
    );
  }

  const hasContent =
    (data?.files.length ?? 0) > 0 || (data?.subfolders.length ?? 0) > 0;

  if (!hasContent) {
    return (
      <div className="p-4 flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <FolderOpen size={36} className="opacity-25" />
        <p className="text-sm">׳׳™׳ ׳§׳‘׳¦׳™׳ ׳‘׳×׳™׳§׳™׳™׳”</p>
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
