"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Label, Card } from "@/components/ui";

const PLANS = [
  { name: "Freelancer", price: "CAD $19/mo", usage: "10 proposals / month" },
  { name: "Pro", price: "CAD $49/mo", usage: "40 proposals / month" },
  { name: "Agency", price: "CAD $99/mo", usage: "150 proposals / month" },
] as const;

type CompanyProfile = { contactName?: string | null; contactEmail?: string | null; address?: string | null; businessName?: string | null; website?: string | null; expertise?: string | null } | null;

export default function OnboardingForm({ initialProfile, isOwner }: { initialProfile: CompanyProfile; isOwner: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    contactName: initialProfile?.contactName || "",
    contactEmail: initialProfile?.contactEmail || "",
    address: initialProfile?.address || "",
    businessName: initialProfile?.businessName || "",
    website: initialProfile?.website || "",
    expertise: initialProfile?.expertise || "",
  });
  const [plan, setPlan] = useState<(typeof PLANS)[number]["name"]>("Freelancer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [referenceUploadStatus, setReferenceUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");

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

  async function uploadReference(file: File) {
    setReferenceUploadStatus("uploading");
    setError("");
    try {
      const content = await fileToBase64(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, type: file.type, content, kind: "reference" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Knowledge base upload failed.");
        setReferenceUploadStatus("error");
        return;
      }
      setReferenceUploadStatus("done");
    } catch {
      setReferenceUploadStatus("error");
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/workspace/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, onboarded: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Could not save your workspace profile.");
        return;
      }
      if (!isOwner) {
        router.push("/dashboard");
        return;
      }
      const checkout = await fetch("/api/billing/checkout-started", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const checkoutBody = await checkout.json().catch(() => ({}));
      if (checkout.ok && checkoutBody.checkoutUrl) {
        window.open(checkoutBody.checkoutUrl, "_blank", "noopener,noreferrer");
      }
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-2xl">
        <h1 className="text-lg font-semibold text-foreground">Set up your ScopeVanta workspace</h1>
        <p className="mt-1 text-sm text-foreground-muted">We use this context to make every proposal sound like your business, not a generic AI template.</p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <Label>Full name</Label>
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="you@company.com" />
          </div>
          <div className="col-span-2">
            <Label>Business address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, city, province/state, country" />
          </div>
          <div>
            <Label>Company name</Label>
            <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" />
          </div>
          <div className="col-span-2">
            <Label>Expertise & services</Label>
            <Textarea rows={4} value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} placeholder="Tell ScopeVanta what your team is great at, typical services, industries and differentiators." />
          </div>
        </div>

        {isOwner && (
          <div className="mt-4">
            <Label>Company logo (optional)</Label>
            <div className="flex items-center gap-3">
              {logoUrl && <img src={logoUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-border" />}
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
        )}

        <div className="mt-4">
          <Label>Seed your knowledge base (optional)</Label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-[4px] bg-accent px-4 py-2 text-sm font-medium text-surface-0 hover:bg-accent-hover transition-colors">
              <span className="material-symbols-outlined text-[18px]">
                {referenceUploadStatus === "uploading" ? "progress_activity" : "upload_file"}
              </span>
              <span>{referenceUploadStatus === "uploading" ? "Uploading…" : "Attach reference file"}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.md,.doc,.docx,image/*"
                onChange={(e) => e.target.files?.[0] && uploadReference(e.target.files[0])}
              />
            </label>
            {referenceUploadStatus === "done" && <span className="text-xs text-success">Added to knowledge base ✓</span>}
            {referenceUploadStatus === "error" && <span className="text-xs text-danger">Upload failed</span>}
          </div>
        </div>

        {isOwner && (
          <>
            <h2 className="mt-8 mb-3 text-sm font-semibold text-foreground">Choose your plan</h2>
            <div className="grid grid-cols-3 gap-3">
              {PLANS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setPlan(p.name)}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${plan === p.name ? "border-foreground bg-surface-raised" : "border-border hover:border-foreground-muted"}`}
                >
                  <div className="text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">{p.price}</div>
                  <div className="mt-1 text-xs text-foreground-subtle">{p.usage}</div>
                  <div className="mt-2 text-xs text-foreground-subtle">30-day introductory trial</div>
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <Button className="mt-6 w-full" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : isOwner ? "Continue to Square & activate" : "Save workspace profile"}
        </Button>
        {isOwner && (
          <p className="mt-3 text-xs text-foreground-subtle">
            Your workspace is saved before checkout. Square securely collects the payment method — ScopeVanta never receives the full card number. The introductory month is $0, then the selected monthly price begins unless cancelled.
          </p>
        )}
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
