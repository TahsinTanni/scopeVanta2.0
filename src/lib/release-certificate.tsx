import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/currency";
import type { ReleaseReceipt } from "@/lib/release";

// Printable/archival document: standard black-on-white, built-in PDF fonts only.
const styles = StyleSheet.create({
  page: { padding: 56, fontFamily: "Helvetica", fontSize: 11, color: "#111111", backgroundColor: "#ffffff" },
  brand: { fontSize: 10, letterSpacing: 2, color: "#555555", textTransform: "uppercase" },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 24 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#111111", marginBottom: 20 },
  row: { marginBottom: 14 },
  label: { fontSize: 9, letterSpacing: 1, color: "#555555", textTransform: "uppercase", marginBottom: 3 },
  value: { fontSize: 12 },
  mono: { fontFamily: "Courier", fontSize: 11, lineHeight: 1.5 },
  footer: { marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#cccccc", fontSize: 10, color: "#333333", lineHeight: 1.5 },
});

function formatReleased(iso: string) {
  return (
    new Date(iso).toLocaleString("en-GB", {
      timeZone: "UTC", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    }) + " UTC"
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function ReleaseCertificate({ receipt }: { receipt: ReleaseReceipt }) {
  const released = formatReleased(receipt.releasedAt);
  const hashLines = [receipt.releaseHash.slice(0, 32), receipt.releaseHash.slice(32)];
  return (
    <Document title="Proposal Release Certificate" author="ScopeVanta">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>ScopeVanta</Text>
        <Text style={styles.title}>Proposal Release Certificate</Text>
        <View style={styles.rule} />
        <Field label="Release ID">
          <Text style={styles.mono}>{receipt.releaseId}</Text>
        </Field>
        <Field label="SHA-256 hash">
          {hashLines.map((line) => (
            <Text key={line} style={styles.mono}>{line}</Text>
          ))}
        </Field>
        <Field label="Released">
          <Text style={styles.value}>{released}</Text>
        </Field>
        <Field label="Client">
          <Text style={styles.value}>{receipt.client}</Text>
        </Field>
        <Field label="Seller">
          <Text style={styles.value}>{receipt.seller}</Text>
        </Field>
        <Field label="Proposal version">
          <Text style={styles.value}>{receipt.proposalVersion}</Text>
        </Field>
        <Field label="Deal value">
          <Text style={styles.value}>{formatCurrency(receipt.dealValue, receipt.currency)} ({receipt.currency})</Text>
        </Field>
        <Text style={styles.footer}>
          This certificate confirms the exact proposal content shared with {receipt.client} on {released}, identified by the release ID and hash above.
        </Text>
      </Page>
    </Document>
  );
}
