"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const SUBJECTS = [
  { value: "שאלה כללית", label: "שאלה כללית" },
  { value: "בעיה טכנית", label: "בעיה טכנית" },
  { value: "אחר", label: "אחר" },
];

export function StudentContactForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject || !message.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/student/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      if (!res.ok) throw new Error();
      toast.success("הפנייה נשלחה בהצלחה");
      setSubject("");
      setMessage("");
    } catch {
      toast.error("שגיאה בשליחת הפנייה, נסה שוב");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">נושא</label>
        <Select value={subject} onValueChange={(v) => setSubject(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="בחר נושא" />
          </SelectTrigger>
          <SelectContent>
            {SUBJECTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">הודעה</label>
        <Textarea
          placeholder="כתוב את הפנייה שלך כאן..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
        />
      </div>

      <Button type="submit" disabled={loading || !subject || !message.trim()}>
        {loading ? "שולח..." : "שלח פנייה"}
      </Button>
    </form>
  );
}
