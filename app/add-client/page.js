"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { addClient } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";
import PageShell from "@/components/PageShell";
import { CLIENT_STATUSES, CONTACT_TYPES } from "@/config/app";

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors";

function AddClientForm() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    contactType: "Telegram",
    contact: "",
    status: "Prospect",
    followUpDays: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim()) {
      setError("Name and contact are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const id = await addClient({
        name: form.name.trim(),
        contactType: form.contactType,
        contact: form.contact.trim(),
        status: form.status,
        notes: form.notes.trim(),
        ...(form.followUpDays ? { followUpDays: parseInt(form.followUpDays) } : {}),
        assignedTo: user.uid,
        milestones: {},
        archived: false,
        createdAt: serverTimestamp(),
      });
      router.push(`/client/${id}`);
    } catch {
      setError("Failed to save. Try again.");
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <PageShell title="Add Client" backHref="/clients">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Client name"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Contact Type *</label>
              <select value={form.contactType} onChange={(e) => set("contactType", e.target.value)} className={inputCls}>
                {CONTACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">
              {form.contactType === "Email" ? "Email Address" : form.contactType === "Telegram" ? "Telegram Username" : "Instagram Handle"} *
            </label>
            <input
              type={form.contactType === "Email" ? "email" : "text"}
              required
              value={form.contact}
              onChange={(e) => set("contact", e.target.value)}
              placeholder={form.contactType === "Email" ? "client@email.com" : form.contactType === "Telegram" ? "@username" : "@handle"}
              className={inputCls}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Follow-up every (days)</label>
            <p className="text-[11px] text-gray-400">Leave blank to use your global default.</p>
            <input
              type="number"
              min={1}
              max={365}
              value={form.followUpDays}
              onChange={(e) => set("followUpDays", e.target.value)}
              placeholder="Use global default"
              className={inputCls}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="How you met, initial impressions…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {error && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
            <p className="text-gray-700 text-sm text-center">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-black hover:bg-gray-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
        >
          {saving ? "Saving…" : "Add Client"}
        </button>
      </form>
    </PageShell>
  );
}

export default function AddClient() {
  return (
    <Suspense>
      <AddClientForm />
    </Suspense>
  );
}
