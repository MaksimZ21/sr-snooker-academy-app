"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle,
  ChevronLeft,
  ExternalLink,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  Home,
  Play,
  Presentation,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DriveFile, DriveFolder } from "@/lib/google/drive";

// Each file type in its own color, like the Drive icons people know.
type FileKind = { icon: LucideIcon; color: string; label: string };

const MIME_KINDS: Record<string, FileKind> = {
  "application/vnd.google-apps.document": { icon: FileText, color: "#4285f4", label: "מסמך" },
  "application/vnd.google-apps.spreadsheet": { icon: FileSpreadsheet, color: "#0f9d58", label: "גיליון" },
  "application/vnd.google-apps.presentation": { icon: Presentation, color: "#f4b400", label: "מצגת" },
  "application/pdf": { icon: FileText, color: "#db4437", label: "PDF" },
};

function fileKind(mimeType: string): FileKind {
  if (MIME_KINDS[mimeType]) return MIME_KINDS[mimeType];
  if (mimeType.startsWith("video/")) return { icon: FileVideo, color: "#db4437", label: "וידאו" };
  if (mimeType.startsWith("image/")) return { icon: FileImage, color: "#0f9d58", label: "תמונה" };
  if (mimeType.startsWith("audio/")) return { icon: FileAudio, color: "#78716c", label: "אודיו" };
  return { icon: FileText, color: "#4285f4", label: "קובץ" };
}

// Google's own embeddable viewer for the file, so it opens inside the app.
// Docs, Sheets and Slides have their own preview pages; everything else
// (video, PDF, images, Office files) plays in Drive's file preview.
function previewUrl(file: DriveFile): string {
  const id = encodeURIComponent(file.id);
  switch (file.mimeType) {
    case "application/vnd.google-apps.document":
      return `https://docs.google.com/document/d/${id}/preview`;
    case "application/vnd.google-apps.spreadsheet":
      return `https://docs.google.com/spreadsheets/d/${id}/preview`;
    case "application/vnd.google-apps.presentation":
      return `https://docs.google.com/presentation/d/${id}/preview`;
    default:
      return `https://drive.google.com/file/d/${id}/preview`;
  }
}

function FileViewer({ file, onClose }: { file: DriveFile | null; onClose: () => void }) {
  const kind = file ? fileKind(file.mimeType) : null;
  const isVideo = file?.mimeType.startsWith("video/") ?? false;
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        {file && kind && (
          <>
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
              <kind.icon size={18} className="shrink-0" style={{ color: kind.color }} />
              <DialogTitle className="flex-1 min-w-0 truncate text-sm font-bold">{file.name}</DialogTitle>
              <a
                href={file.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ExternalLink size={13} />
                <span className="hidden sm:inline">פתח בדרייב</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label="סגור"
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className={cn("relative w-full bg-black/90", isVideo ? "aspect-video" : "h-[78vh] bg-muted")}>
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
              <iframe
                key={file.id}
                src={previewUrl(file)}
                title={file.name}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="relative h-full w-full border-0"
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function countFiles(folder: DriveFolder): number {
  return folder.files.length + folder.subfolders.reduce((n, sub) => n + countFiles(sub), 0);
}

// Every file in the tree with the folder path it sits in, for search.
function flatten(folder: DriveFolder, path: string[] = []): { file: DriveFile; path: string[] }[] {
  return [
    ...folder.files.map((file) => ({ file, path })),
    ...folder.subfolders.flatMap((sub) => flatten(sub, [...path, sub.name])),
  ];
}

function FolderCard({ folder, index, onOpen }: { folder: DriveFolder; index: number; onOpen: () => void }) {
  const files = countFiles(folder);
  const subs = folder.subfolders.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${index * 40}ms` }}
      className="animate-fade-in-up group relative flex flex-col items-start gap-3 rounded-[18px] border bg-card p-4 text-right transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-amber-400/60 hover:shadow-[0_16px_30px_-18px_rgb(13_21_16/0.35)]"
    >
      <span className="relative flex h-14 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-2xl bg-amber-400/15 blur-md opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <Folder
          size={52}
          strokeWidth={1.4}
          className="relative text-amber-500 fill-amber-400/90 transition-transform duration-200 group-hover:scale-105"
        />
      </span>
      <span className="w-full">
        <span className="block font-display text-[15px] font-bold leading-tight line-clamp-2">{folder.name}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {files} קבצים{subs > 0 ? ` · ${subs} תיקיות` : ""}
        </span>
      </span>
    </button>
  );
}

function FileCard({
  file,
  index,
  path,
  onOpen,
}: {
  file: DriveFile;
  index: number;
  path?: string[];
  onOpen: () => void;
}) {
  const kind = fileKind(file.mimeType);
  const Icon = kind.icon;
  const isVideo = file.mimeType.startsWith("video/");
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ animationDelay: `${index * 40}ms` }}
      className="animate-fade-in-up group flex flex-col overflow-hidden rounded-[18px] border bg-card text-right transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_-18px_rgb(13_21_16/0.35)]"
    >
      <span
        className="relative flex h-24 items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${kind.color}26, ${kind.color}0d)` }}
      >
        {isVideo ? (
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200 group-hover:scale-110"
            style={{ background: kind.color }}
          >
            <Play size={20} className="fill-current -translate-x-px" />
          </span>
        ) : (
          <Icon size={38} strokeWidth={1.6} style={{ color: kind.color }} className="transition-transform duration-200 group-hover:scale-110" />
        )}
        <span
          className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
          style={{ background: kind.color }}
        >
          {kind.label}
        </span>
      </span>
      <span className="flex items-start gap-2 p-3">
        <Icon size={15} className="mt-0.5 shrink-0" style={{ color: kind.color }} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-snug line-clamp-2">{file.name}</span>
          {path && path.length > 0 && (
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{path.join(" › ")}</span>
          )}
        </span>
      </span>
    </button>
  );
}

function SectionTitle({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <h3 className="flex items-center gap-2 font-display text-sm font-bold text-muted-foreground">
      {children}
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums">{count}</span>
    </h3>
  );
}

const GRID = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3";

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

  // The folders opened so far, from the top; the last one is on screen.
  const [trail, setTrail] = useState<DriveFolder[]>([]);
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<DriveFile | null>(null);

  const allFiles = useMemo(() => (data ? flatten(data) : []), [data]);

  if (isLoading) {
    return (
      <div className={cn("p-4", GRID)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-[18px]" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-4 flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <AlertCircle size={36} className="opacity-40" />
        <p className="text-sm text-center">לא ניתן לטעון קבצים כרגע</p>
      </div>
    );
  }

  const current = trail.at(-1) ?? data;
  const q = query.trim().toLowerCase();
  const results = q ? allFiles.filter(({ file }) => file.name.toLowerCase().includes(q)) : [];
  const isEmpty = current.files.length === 0 && current.subfolders.length === 0;

  return (
    <div className="p-4 flex flex-col gap-5">
      <FileViewer file={viewing} onClose={() => setViewing(null)} />
      {/* Search across every folder */}
      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש קובץ בכל התיקיות..."
          className="h-10 rounded-xl pr-9 pl-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="נקה חיפוש"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {q ? (
        <section className="flex flex-col gap-3">
          <SectionTitle count={results.length}>תוצאות חיפוש</SectionTitle>
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">לא נמצאו קבצים בשם הזה</p>
          ) : (
            <div className={GRID}>
              {results.map(({ file, path }, i) => (
                <FileCard key={file.id} file={file} path={path} index={i} onOpen={() => setViewing(file)} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Breadcrumbs */}
          <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-muted/50 px-2 py-1.5 text-sm">
            <button
              type="button"
              onClick={() => setTrail([])}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold transition-colors hover:bg-background",
                trail.length === 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Home size={14} />
              כל הקבצים
            </button>
            {trail.map((f, i) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronLeft size={14} className="text-muted-foreground/60" />
                <button
                  type="button"
                  onClick={() => setTrail(trail.slice(0, i + 1))}
                  className={cn(
                    "rounded-lg px-2 py-1 font-semibold transition-colors hover:bg-background",
                    i === trail.length - 1 ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {f.name}
                </button>
              </span>
            ))}
          </nav>

          {isEmpty && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <FolderOpen size={40} className="opacity-25" />
              <p className="text-sm">{trail.length === 0 ? "אין קבצים בתיקייה" : "תיקייה ריקה"}</p>
            </div>
          )}

          {current.subfolders.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle count={current.subfolders.length}>תיקיות</SectionTitle>
              <div key={`folders:${current.id}`} className={GRID}>
                {current.subfolders.map((sub, i) => (
                  <FolderCard key={sub.id} folder={sub} index={i} onOpen={() => setTrail([...trail, sub])} />
                ))}
              </div>
            </section>
          )}

          {current.files.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle count={current.files.length}>קבצים</SectionTitle>
              <div key={`files:${current.id}`} className={GRID}>
                {current.files.map((file, i) => (
                  <FileCard key={file.id} file={file} index={i} onOpen={() => setViewing(file)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
