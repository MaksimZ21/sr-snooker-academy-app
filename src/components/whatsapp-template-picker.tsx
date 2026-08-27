"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WhatsAppTemplate } from "@/app/api/whatsapp/templates/route";

function extractPlaceholders(body: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of body.matchAll(/\{\{([^}]+)\}\}/g)) {
    const name = match[1].trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Substitutes every {{name}} marker in `body` with its value from `values`.
// Matches the marker with a regex (tolerant of whitespace inside the braces,
// e.g. "{{ תאריך }}") rather than reconstructing a literal "{{name}}" string
// — a placeholder detected via extractPlaceholders (which trims the name)
// must still match its original, untrimmed occurrence in the text.
function substitute(body: string, values: Record<string, string>): string {
  let result = body;
  for (const name of extractPlaceholders(body)) {
    const marker = new RegExp(`\\{\\{\\s*${escapeRegExp(name)}\\s*\\}\\}`, "g");
    result = result.replace(marker, values[name] ?? "");
  }
  return result;
}

export function WhatsAppTemplatePicker({ onApply }: { onApply: (text: string) => void }) {
  const { data } = useQuery({
    queryKey: ["whatsapp:templates"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/templates");
      if (!r.ok) throw new Error("fetch failed");
      const json = (await r.json()) as { templates: WhatsAppTemplate[] };
      return json.templates;
    },
    staleTime: 60_000,
  });
  const templates = data ?? [];
  const [selectedId, setSelectedId] = useState("");
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});

  const selected = templates.find((t) => t.id === selectedId);
  const placeholders = selected ? extractPlaceholders(selected.body) : [];

  function handleSelect(id: string) {
    setSelectedId(id);
    setPlaceholderValues({});
    const tpl = templates.find((t) => t.id === id);
    if (tpl) onApply(tpl.body);
  }

  function handlePlaceholderChange(name: string, value: string) {
    if (!selected) return;
    const next = { ...placeholderValues, [name]: value };
    setPlaceholderValues(next);
    onApply(substitute(selected.body, next));
  }

  if (templates.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <Select value={selectedId || "__none__"} onValueChange={(v) => handleSelect(!v || v === "__none__" ? "" : v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="טען תבנית..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">ללא תבנית</SelectItem>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {placeholders.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border/60 p-2">
          {placeholders.map((p) => (
            <div key={p}>
              <Label className="text-xs text-muted-foreground mb-1 block">{p}</Label>
              <Input
                value={placeholderValues[p] ?? ""}
                onChange={(e) => handlePlaceholderChange(p, e.target.value)}
                className="h-8 text-sm"
                dir="auto"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
