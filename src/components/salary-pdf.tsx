import React from "react";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";
import path from "path";
import type { CoachSalary } from "@/app/api/admin/salary/route";

Font.register({
  family: "Heebo",
  fonts: [
    { src: path.join(process.cwd(), "public", "fonts", "Heebo-Regular.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "public", "fonts", "Heebo-Bold.ttf"), fontWeight: 700 },
  ],
});

const GREEN = "#0b7b50";
const LIGHT_GREEN = "#e8f5ef";
const RED = "#cc2222";
const BORDER = "#d0e8db";

const s = StyleSheet.create({
  page: { fontFamily: "Heebo", backgroundColor: "#fff", padding: 28, fontSize: 10 },

  header: { alignItems: "center", marginBottom: 10 },
  academyName: { fontSize: 8, color: "#888", marginBottom: 3, textAlign: "center" },
  title: { fontSize: 15, fontWeight: 700, color: GREEN, textAlign: "center" },
  subtitle: { fontSize: 9, color: "#666", marginTop: 3, textAlign: "center" },

  divider: { height: 1.5, backgroundColor: GREEN, marginBottom: 14, borderRadius: 1 },

  sectionHeader: {
    color: "#fff",
    fontSize: 9,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
    textAlign: "right",
    backgroundColor: GREEN,
  },

  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: "hidden", marginBottom: 12 },
  tableHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: LIGHT_GREEN,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRow: {
    flexDirection: "row-reverse",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  colDate: { width: 75, textAlign: "right", color: "#333" },
  colTime: { width: 40, textAlign: "right", color: "#333" },
  colType: { flex: 1, textAlign: "right", color: "#333" },
  colPrice: { width: 60, textAlign: "left", color: GREEN, fontWeight: 700 },
  headerCell: { fontWeight: 700, color: "#555" },

  offsetRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  offsetDesc: { flex: 1, textAlign: "right", color: "#333" },
  offsetAmount: { color: RED, fontWeight: 700 },

  totalsBox: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#fafffe",
  },
  totalsRow: { flexDirection: "row-reverse", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: "#555" },
  totalsValue: { fontWeight: 700, color: "#333" },
  netRow: { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 4, paddingTop: 6 },
  netValue: { fontWeight: 700, color: GREEN, fontSize: 12 },

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

export function SalaryPdfDocument({
  coach,
  coachName,
  period,
}: {
  coach: CoachSalary;
  coachName: string;
  period: string;
}) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.academyName}>SHACHAR RUBERG SNOOKER ACADEMY</Text>
          <Text style={s.title}>{coachName} – סיכום אימונים</Text>
          <Text style={s.subtitle}>תקופה: {period}</Text>
        </View>

        <View style={s.divider} />

        <Text style={s.sectionHeader}>אימונים ({coach.sessions.length})</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.colDate, s.headerCell]}>תאריך</Text>
            <Text style={[s.colTime, s.headerCell]}>שעה</Text>
            <Text style={[s.colType, s.headerCell]}>אימון</Text>
            <Text style={[s.colPrice, s.headerCell]}>סכום</Text>
          </View>
          {coach.sessions.map((sess, i) => (
            <View
              key={sess.id}
              style={[s.tableRow, i === coach.sessions.length - 1 ? { borderBottomWidth: 0 } : {}]}
            >
              <Text style={s.colDate}>{formatDate(sess.date)}</Text>
              <Text style={s.colTime}>{sess.start_time || "—"}</Text>
              <Text style={s.colType}>{sess.name || "—"}</Text>
              <Text style={s.colPrice}>{sess.price_nis.toLocaleString("he-IL")} ₪</Text>
            </View>
          ))}
        </View>

        {coach.offsets.length > 0 && (
          <>
            <Text style={s.sectionHeader}>קיזוזים ({coach.offsets.length})</Text>
            <View style={s.table}>
              {coach.offsets.map((o, i) => (
                <View
                  key={o.id}
                  style={[s.offsetRow, i === coach.offsets.length - 1 ? { borderBottomWidth: 0 } : {}]}
                >
                  <Text style={s.offsetDesc}>{o.description}</Text>
                  <Text style={s.offsetAmount}>-{o.amount.toLocaleString("he-IL")} ₪</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={s.totalsBox}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>סה״כ אימונים</Text>
            <Text style={s.totalsValue}>{coach.sessions_total}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>סה״כ</Text>
            <Text style={s.totalsValue}>{coach.amount_total.toLocaleString("he-IL")} ₪</Text>
          </View>
          {coach.offsets_total > 0 && (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>קיזוזים</Text>
              <Text style={[s.totalsValue, { color: RED }]}>
                -{coach.offsets_total.toLocaleString("he-IL")} ₪
              </Text>
            </View>
          )}
          <View style={[s.totalsRow, s.netRow]}>
            <Text style={s.totalsLabel}>לתשלום</Text>
            <Text style={s.netValue}>{coach.net_total.toLocaleString("he-IL")} ₪</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Shachar Ruberg Snooker Academy</Text>
          <Text style={s.footerText}>נוצר ב-{new Date().toLocaleDateString("he-IL")}</Text>
        </View>
      </Page>
    </Document>
  );
}
