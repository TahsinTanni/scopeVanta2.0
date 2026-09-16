"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Input, Textarea, Label } from "@/components/ui";

// Replaces legacy App.tsx's company profile view (lines 6247-6358) — now
// workspace-level per CLAUDE.md's profile split.
export default function CompanyProfilePage() {
  const [form, setForm] = useState({ contactName: "", contactEmail: "", address: "", businessName: "", website: "", expertise: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspace/profile")
      .then((r) => r.json())
      .then((d) => d.profile && setForm({ ...form, ...d.profile }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setError("");
    setSaved(false);
    const res = await fetch("/api/workspace/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, onboarded: true }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Could not save company profile.");
      return;
    }
    setSaved(true);
  }

  return (
    <div>
      <PageHeader title="Company Profile" description="Shared workspace-level business identity every proposal draws on." />
      <Card className="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Full name</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
          <div className="col-span-2"><Label>Business address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label>Company name</Label><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></div>
          <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          <div className="col-span-2"><Label>Expertise & services</Label><Textarea rows={4} value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} /></div>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        {saved && <p className="mt-3 text-sm text-success">Saved.</p>}
        <Button className="mt-4" onClick={save}>Save</Button>
      </Card>
    </div>
  );
}
