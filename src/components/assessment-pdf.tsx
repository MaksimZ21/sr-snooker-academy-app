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

const GREEN = "#0b7b50";
const LIGHT_GREEN = "#e8f5ef";
const BORDER = "#d0e8db";

const s = StyleSheet.create({
  page: { fontFamily: "Heebo", backgroundColor: "#fff", padding: 28, fontSize: 10 },

  header: { flexDirection: "row-reverse", alignItems: "center", marginBottom: 14, gap: 12 },
  logo: { width: 44, height: 44, objectFit: "contain" },
  headerText: { flex: 1, textAlign: "right" },
  academyName: { fontSize: 8, color: "#666", marginBottom: 2 },
  title: { fontSize: 14, fontWeight: 700, color: GREEN },
  subtitle: { fontSize: 9, color: "#555", marginTop: 2 },

  divider: { height: 1.5, backgroundColor: GREEN, marginBottom: 14, borderRadius: 1 },

  body: { flexDirection: "row-reverse", gap: 14 },
  leftCol: { flex: 2 },
  rightCol: { flex: 1 },

  sectionHeader: {
    backgroundColor: GREEN,
    color: "#fff",
    fontSize: 9,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
    textAlign: "right",
  },

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

  techTable: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden", marginTop: 8 },
  techRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
  },
  techRowEven: { backgroundColor: LIGHT_GREEN },
  techLabel: { flex: 1, textAlign: "right", color: "#333" },
  techCheck: { width: 24, textAlign: "center", fontWeight: 700 },
  checkTrue: { color: GREEN },
  checkFalse: { color: "#cc2222" },
  checkEmpty: { color: "#bbb" },

  notesBox: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 8,
    minHeight: 120,
    textAlign: "right",
    color: "#333",
    lineHeight: 1.6,
    backgroundColor: "#fafffe",
  },

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

export function AssessmentPdfDocument({ assessment: a }: { assessment: Assessment }) {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const passCount = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] === true).length;
  const totalRated = TECHNIQUE_CRITERIA.filter((c) => a.technique[c.key] !== undefined).length;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <PDFImage src={logoPath} style={s.logo} />
          <View style={s.headerText}>
            <Text style={s.academyName}>SHACHAR RUBERG SNOOKER ACADEMY</Text>
            <Text style={s.title}>סיווג דירוג שחקן עבור: {a.participant_name}</Text>
            <Text style={s.subtitle}>
              {a.participant_phone ? `טלפון: ${a.participant_phone}  |  ` : ""}
              תאריך: {formatDate(a.event_date)}
            </Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Body */}
        <View style={s.body}>
          {/* Left column — criteria */}
          <View style={s.leftCol}>
            {/* Player attributes */}
            <Text style={s.sectionHeader}>מאפייני השחקן</Text>
            <View style={s.attrRow}>
              <Text style={s.attrLabel}>יד חזקה</Text>
              <Text style={s.attrValue}>{a.strong_hand ? HAND_EYE[a.strong_hand] : "—"}</Text>
            </View>
            <View style={[s.attrRow, { borderBottomWidth: 0 }]}>
              <Text style={s.attrLabel}>עין חזקה</Text>
              <Text style={s.attrValue}>{a.strong_eye ? HAND_EYE[a.strong_eye] : "—"}</Text>
            </View>

            {/* Technique table */}
            <Text style={[s.sectionHeader, { marginTop: 12 }]}>
              טכניקה ({passCount}/{totalRated})
            </Text>
            <View style={s.techTable}>
              {TECHNIQUE_CRITERIA.map((c, i) => {
                const val = a.technique[c.key];
                return (
                  <View
                    key={c.key}
                    style={[s.techRow, i % 2 === 1 ? s.techRowEven : {}]}
                  >
                    <Text style={s.techLabel}>{c.label}</Text>
                    <Text
                      style={[
                        s.techCheck,
                        val === true ? s.checkTrue : val === false ? s.checkFalse : s.checkEmpty,
                      ]}
                    >
                      {val === true ? "✓" : val === false ? "✗" : "—"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Right column — notes */}
          <View style={s.rightCol}>
            <Text style={s.sectionHeader}>נקודות עיקריות לשיפור</Text>
            <Text style={s.notesBox}>{a.notes ?? ""}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Shachar Ruberg Snooker Academy</Text>
          <Text style={s.footerText}>
            נוצר ב-{new Date().toLocaleDateString("he-IL")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
