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

export function WhatsAppTemplatePicker({ onApply }: { onApply: (text: string) => void }) {
  const { data } = useQuery({
    queryKey: ["whatsapp:templates"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp/templates");
      if (!r.ok) throw new Error("fetch failed");
      const json = (await r.json()) as { templates: WhatsAppTemplate[] };
      return json.templates;
    },
  });
  const templates = data ?? [];
  const [selectedId, setSelectedId] = useState("");
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});

  const selected = templates.find((t) => t.id === selectedId);
  const placeholders = selected ? extractPlaceholders(selected.body) : [];

  function handleSelect(id: string) {
    setSelectedId(id);
    setPlaceholderValues({});
    const t = templates.find((t) => t.id === id);
    if (t) onApply(t.body);
  }

  function handlePlaceholderChange(name: string, value: string) {
    if (!selected) return;
    const next = { ...placeholderValues, [name]: value };
    setPlaceholderValues(next);
    let result = selected.body;
    for (const p of extractPlaceholders(selected.body)) {
      result = result.replaceAll(`{{${p}}}`, next[p] ?? "");
    }
    onApply(result);
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
