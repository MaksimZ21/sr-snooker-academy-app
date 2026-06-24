import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image as PDFImage,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "path";
import type { Assessment } from "@/lib/sheets/assessments";
import { TECHNIQUE_CRITERIA } from "@/lib/sheets/assessments";

Font.register({
  family: "Heebo",
  fonts: [
    { src: path.join(process.cwd(), "public", "fonts", "Heebo-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "public", "fonts", "Heebo-Bold.ttf"), fontWeight: 700 },
  ],
});

const GREEN       = "#0b7b50";
const LIGHT_GREEN = "#e8f5ef";
const RED         = "#cc2222";
const LIGHT_RED   = "#fff0f0";
const BORDER      = "#d0e8db";

const s = StyleSheet.create({
  page: { fontFamily: "Heebo", backgroundColor: "#fff", padding: 28, fontSize: 10 },

  /* ── Header ── */
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  logo:        { width: 44, height: 44, objectFit: "contain" },
  headerCenter: { flex: 1, alignItems: "center" },
  academyName:  { fontSize: 8, color: "#888", marginBottom: 3, textAlign: "center" },
  title:        { fontSize: 15, fontWeight: 700, color: GREEN, textAlign: "center" },
  subtitle:     { fontSize: 9, color: "#666", marginTop: 3, textAlign: "center" },

  divider: { height: 1.5, backgroundColor: GREEN, marginBottom: 14, borderRadius: 1 },

  /* ── Body ── */
  body:    { flexDirection: "row-reverse", gap: 14 },
  leftCol: { flex: 2 },
  rightCol: { flex: 1 },

  /* ── Section headers ── */
  sectionHeader: {
    color: "#fff",
    fontSize: 9,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
    textAlign: "right",
  },
  sectionHeaderGreen: { backgroundColor: GREEN },
  sectionHeaderRed:   { backgroundColor: RED },

  /* ── Attribute rows ── */
  attrRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  attrLabel: { color: "#333", textAlign: "right" },
  attrValue: { color: GREEN, fontWeight: 700, textAlign: "left" },

  /* ── Technique table ── */
  techTable: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  techRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  techRowGreen: { backgroundColor: LIGHT_GREEN },
  techRowRed:   { backgroundColor: LIGHT_RED },
  techLabel:    { flex: 1, textAlign: "right", color: "#333" },
  techMark:     { width: 20, textAlign: "center", fontWeight: 700, fontSize: 11 },
  markGreen:    { color: GREEN },
  markRed:      { color: RED },

  /* ── Score bar ── */
  scoreBar: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: LIGHT_GREEN,
    borderRadius: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  scoreLabel: { color: "#555", fontSize: 9 },
  scoreValue: { color: GREEN, fontWeight: 700, fontSize: 11 },

  /* ── Photo in notes column ── */
  playerPhoto: {
    width: "100%",
    height: 140,
    objectFit: "cover",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  photoPlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#f3f3f3",
    marginBottom: 10,
  },

  /* ── Notes ── */
  notesBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 8,
    minHeight: 80,
    backgroundColor: "#fafffe",
  },
  noteItem: {
    flexDirection: "row-reverse",
    gap: 5,
    marginBottom: 4,
    alignItems: "flex-start",
  },
  noteBullet: { color: GREEN, fontWeight: 700, fontSize: 11, lineHeight: 1.4 },
  noteText:   { flex: 1, textAlign: "right", color: "#333", lineHeight: 1.6 },

  /* ── Footer ── */
  footer: {
    marginTop: 18,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 8, color: "#aaa" },
});

function formatDate(d: string) {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

const HAND_EYE: Record<string, string> = { right: "ימין", left: "שמאל" };

function NotesWithBullets({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map((line, i) => (
        <View key={i} style={s.noteItem}>
          <Text style={s.noteBullet}>•</Text>
          <Text style={s.noteText}>{line.trim()}</Text>
        </View>
      ))}
    </>
  );
}

export function AssessmentPdfDocument({ assessment: a }: { assessment: Assessment }) {
  const logoPath = path.join(process.cwd(), "public", "logo.png");

  const strongItems = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] === true);
  const weakItems   = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] === false);

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          {/* Spacer to balance logo width */}
          <View style={{ width: 44 }} />
          <View style={s.headerCenter}>
            <Text style={s.academyName}>SHACHAR RUBERG SNOOKER ACADEMY</Text>
            <Text style={s.title}>{a.participant_name} – דוח אבחון</Text>
            <Text style={s.subtitle}>תאריך: {formatDate(a.event_date)}</Text>
          </View>
          <PDFImage src={logoPath} style={s.logo} />
        </View>

        <View style={s.divider} />

        {/* ── Body ── */}
        <View style={s.body}>

          {/* Left col — attributes + technique */}
          <View style={s.leftCol}>

            <Text style={[s.sectionHeader, s.sectionHeaderGreen]}>מאפייני השחקן</Text>
            <View style={s.attrRow}>
              <Text style={s.attrLabel}>יד חזקה</Text>
              <Text style={s.attrValue}>{a.strong_hand ? HAND_EYE[a.strong_hand] : "—"}</Text>
            </View>
            <View style={[s.attrRow, { borderBottomWidth: 0 }]}>
              <Text style={s.attrLabel}>עין חזקה</Text>
              <Text style={s.attrValue}>{a.strong_eye ? HAND_EYE[a.strong_eye] : "—"}</Text>
            </View>

            {(strongItems.length + weakItems.length) > 0 && (
              <View style={[s.scoreBar, { marginTop: 10 }]}>
                <Text style={s.scoreLabel}>ציון טכניקה</Text>
                <Text style={s.scoreValue}>
                  {strongItems.length} / {strongItems.length + weakItems.length}
                </Text>
              </View>
            )}

            {strongItems.length > 0 && (
              <>
                <Text style={[s.sectionHeader, s.sectionHeaderGreen, { marginTop: 4 }]}>
                  חוזקות ({strongItems.length})
                </Text>
                <View style={s.techTable}>
                  {strongItems.map((c, i) => (
                    <View
                      key={c.key}
                      style={[s.techRow, s.techRowGreen, i === strongItems.length - 1 ? { borderBottomWidth: 0 } : {}]}
                    >
                      <Text style={s.techLabel}>{c.label}</Text>
                      <Text style={[s.techMark, s.markGreen]}>✓</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {weakItems.length > 0 && (
              <>
                <Text style={[s.sectionHeader, s.sectionHeaderRed, { marginTop: 4 }]}>
                  נדרש שיפור ({weakItems.length})
                </Text>
                <View style={s.techTable}>
                  {weakItems.map((c, i) => (
                    <View
                      key={c.key}
                      style={[s.techRow, s.techRowRed, i === weakItems.length - 1 ? { borderBottomWidth: 0 } : {}]}
                    >
                      <Text style={s.techLabel}>{c.label}</Text>
                      <Text style={[s.techMark, s.markRed]}>✗</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* Right col — photo + notes */}
          <View style={s.rightCol}>
            {a.photo_url ? (
              <PDFImage src={a.photo_url} style={s.playerPhoto} />
            ) : (
              <View style={s.photoPlaceholder} />
            )}

            <Text style={[s.sectionHeader, s.sectionHeaderGreen]}>נקודות עיקריות לשיפור</Text>
            <View style={s.notesBox}>
              <NotesWithBullets text={a.notes ?? ""} />
            </View>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerText}>Shachar Ruberg Snooker Academy</Text>
          <Text style={s.footerText}>נוצר ב-{new Date().toLocaleDateString("he-IL")}</Text>
        </View>
      </Page>
    </Document>
  );
}
