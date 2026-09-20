"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Input, Textarea, Label, Select } from "@/components/ui";
import { CURRENCIES } from "@/lib/currency";

export default function CompanyProfilePage() {
  const [form, setForm] = useState({ contactName: "", contactEmail: "", address: "", businessName: "", website: "", expertise: "", currency: "USD" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    fetch("/api/workspace/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setForm({ ...form, ...d.profile });
          setLogoUrl(d.profile.logoPath || "");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadLogo(file: File) {
    setUploadingLogo(true);
    setError("");
    try {
      const content = await fileToBase64(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, content, kind: "logo" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Logo upload failed.");
        return;
      }
      setLogoUrl(body.url || "");
    } finally {
      setUploadingLogo(false);
    }
  }

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
    <div className="space-y-6">
      <PageHeader
        title="Company Profile"
        description="Shared workspace-level business identity every proposal draws on."
      />
      <Card className="max-w-4xl border-border-hairline bg-surface-1 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Full name</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
          <div className="col-span-2"><Label>Business address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label>Company name</Label><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></div>
          <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          <div><Label>Deal currency</Label><Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</Select></div>
          <div className="col-span-2"><Label>Expertise & services</Label><Textarea rows={4} value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} /></div>
        </div>

        <div className="mt-4">
          <Label>Company logo</Label>
          <div className="flex items-center gap-3">
            {logoUrl && <img src={logoUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-border-hairline" />}
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-[4px] bg-accent px-4 py-2 text-sm font-medium text-surface-0 hover:bg-accent-hover transition-colors">
              <span className="material-symbols-outlined text-[18px]">
                {uploadingLogo ? "progress_activity" : "upload_file"}
              </span>
              <span>{uploadingLogo ? "Uploading…" : "Upload logo"}</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-[4px] border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger font-mono">
            {error}
          </div>
        )}
        {saved && (
          <div className="mt-4 rounded-[4px] border border-success/30 bg-success/10 px-3 py-2 text-xs text-success font-mono">
            Profile saved successfully.
          </div>
        )}
        <Button className="mt-6 flex items-center gap-1.5" onClick={save}>
          <span className="material-symbols-outlined text-[18px]">check</span>
          Save Profile
        </Button>
      </Card>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
