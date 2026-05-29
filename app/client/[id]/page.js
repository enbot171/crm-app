"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getClient, updateClient, getMeetingsByClient, addMeeting, updateMeeting, deleteMeeting } from "@/lib/firestore";
import { serverTimestamp, Timestamp } from "firebase/firestore";
import PageShell from "@/components/PageShell";
import { FaArchive } from "react-icons/fa";
import { FiPlus, FiX, FiTrash2, FiCheck } from "react-icons/fi";
import { CLIENT_STATUSES, CONTACT_TYPES, getStatusStyle } from "@/config/app";

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors";

function toDatetimeLocal(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ClientDetail() {
  const { id } = useParams();
  const { loading: authLoading, user, profile } = useRequireAuth();
  const router = useRouter();

  const [client, setClient] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState("info");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);

  // Meetings state
  const [meetings, setMeetings] = useState([]);
  const [meetingsFetched, setMeetingsFetched] = useState(false);
  const [meetingModal, setMeetingModal] = useState(null);
  const [meetingForm, setMeetingForm] = useState({ date: "", notes: "", nextActions: "" });
  const [savingMeeting, setSavingMeeting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getClient(id).then((c) => {
      setClient(c);
      setForm(c);
      setFetching(false);
    });
  }, [id]);

  useEffect(() => {
    if (tab === "meetings" && !meetingsFetched && id) {
      getMeetingsByClient(id).then((m) => {
        setMeetings(m);
        setMeetingsFetched(true);
      });
    }
  }, [tab, meetingsFetched, id]);

  const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await updateClient(id, {
        name: form.name,
        contactType: form.contactType,
        contact: form.contact,
        status: form.status,
        notes: form.notes || "",
        milestones: form.milestones || {},
        ...(form.followUpDays != null && form.followUpDays !== "" ? { followUpDays: parseInt(form.followUpDays) } : { followUpDays: null }),
        scheduledFollowUpAt: form.scheduledFollowUpAt instanceof Date
          ? Timestamp.fromDate(form.scheduledFollowUpAt)
          : (form.scheduledFollowUpAt ?? null),
      });
      setClient((c) => ({ ...c, ...form }));
      showSaved();
    } catch { setError("Failed to save."); }
    setSaving(false);
  };

  const handleMarkContacted = async () => {
    setSaving(true);
    try {
      await updateClient(id, { lastContactedAt: serverTimestamp(), scheduledFollowUpAt: null });
      const now = { toDate: () => new Date() };
      setClient((c) => ({ ...c, lastContactedAt: now, scheduledFollowUpAt: null }));
      setForm((f) => ({ ...f, lastContactedAt: now, scheduledFollowUpAt: null }));
      showSaved();
    } catch { setError("Failed to update."); }
    setSaving(false);
  };

  const handleArchive = async () => {
    if (!confirm(`Archive ${client.name}?`)) return;
    setSaving(true);
    try {
      await updateClient(id, { archived: true });
      router.push("/clients");
    } catch { setError("Failed to archive."); }
    setSaving(false);
  };

  const handleUnarchive = async () => {
    setSaving(true);
    try {
      await updateClient(id, { archived: false });
      setClient((c) => ({ ...c, archived: false }));
      setForm((f) => ({ ...f, archived: false }));
      showSaved();
    } catch { setError("Failed to unarchive."); }
    setSaving(false);
  };

  const openAddMeeting = () => {
    setMeetingForm({ date: "", notes: "", nextActions: "" });
    setMeetingModal({ mode: "add" });
  };

  const openEditMeeting = (m) => {
    setMeetingForm({ date: toDatetimeLocal(m.date), notes: m.notes || "", nextActions: m.nextActions || "" });
    setMeetingModal({ mode: "edit", meeting: m });
  };

  const handleSaveMeeting = async () => {
    if (!meetingForm.date) return;
    setSavingMeeting(true);
    if (meetingModal.mode === "add") {
      await addMeeting({
        clientId: id,
        clientName: client.name,
        date: meetingForm.date,
        notes: meetingForm.notes,
        nextActions: meetingForm.nextActions,
        assignedTo: user.uid,
      });
    } else {
      await updateMeeting(meetingModal.meeting.id, {
        date: meetingForm.date,
        notes: meetingForm.notes,
        nextActions: meetingForm.nextActions,
      });
    }
    const updated = await getMeetingsByClient(id);
    setMeetings(updated);
    setMeetingModal(null);
    setSavingMeeting(false);
  };

  const handleDeleteMeeting = async () => {
    setSavingMeeting(true);
    await deleteMeeting(meetingModal.meeting.id);
    setMeetings((prev) => prev.filter((m) => m.id !== meetingModal.meeting.id));
    setMeetingModal(null);
    setSavingMeeting(false);
  };

  const handleConfirmMeeting = async (meeting, completed) => {
    await updateMeeting(meeting.id, { completed });
    setMeetings((prev) => prev.map((m) => m.id === meeting.id ? { ...m, completed } : m));
  };

  if (authLoading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-7 h-7 rounded-full border-2 border-black border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!client || !form) return <div className="p-8 text-center text-gray-600">Client not found.</div>;

  const now = new Date();
  const upcomingMeetings = meetings.filter((m) => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d >= now;
  });
  const pastMeetings = meetings.filter((m) => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d < now;
  }).reverse();

  const statuses = profile?.customStatuses ?? CLIENT_STATUSES;
  const milestones = profile?.customMilestones || [];

  return (
    <PageShell
      title={client.name}
      backHref="/clients"
      rightAction={
        <button
          onClick={client.archived ? handleUnarchive : handleArchive}
          disabled={saving}
          className={`flex flex-col items-center active:opacity-70 ${client.archived ? "text-gray-600" : "text-gray-400"}`}
        >
          <FaArchive size={18} />
          <span className="text-[10px] font-semibold mt-0.5">{client.archived ? "Unarchive" : "Archive"}</span>
        </button>
      }
    >
      {/* Avatar + status */}
      <div className="flex flex-col items-center mb-5 pt-2">
        <div className="w-20 h-20 rounded-2xl bg-black flex items-center justify-center shadow-md mb-3">
          <span className="text-white text-3xl font-bold">{client.name?.charAt(0).toUpperCase() || "?"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {client.status && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusStyle(statuses, client.status)}`}>
              {client.status}
            </span>
          )}
          {client.archived && (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-700">Archived</span>
          )}
        </div>
        <p className="text-gray-700 text-sm mt-1">
          {client.contactType && `${client.contactType} · `}{client.contact}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {["info", "milestones", "meetings"].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mb-4">
          <p className="text-gray-700 text-sm text-center">{error}</p>
        </div>
      )}

      {/* ── INFO TAB ── */}
      {tab === "info" && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
            <Field label="Name" value={form.name} onChange={(v) => set("name", v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact Type" value={form.contactType} onChange={(v) => set("contactType", v)} select={CONTACT_TYPES} />
              <Field label="Status" value={form.status} onChange={(v) => set("status", v)} select={statuses} />
            </div>
            <Field label="Contact" value={form.contact} onChange={(v) => set("contact", v)} />
            <Field label="Notes" value={form.notes || ""} onChange={(v) => set("notes", v)} textarea />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Custom Follow-up Interval (days)</label>
              <p className="text-[11px] text-gray-600">How often this client should appear in your follow-up list, counted from the last time you marked them as contacted. Leave blank to use your account default.</p>
              <input
                type="number"
                min={1}
                max={365}
                value={form.followUpDays ?? ""}
                onChange={(e) => set("followUpDays", e.target.value === "" ? null : e.target.value)}
                placeholder="Use account default"
                className={inputCls}
              />
            </div>

            {/* Scheduled follow-up */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Scheduled Follow-up</label>
              <p className="text-[11px] text-gray-600">Set a specific date to be reminded.</p>
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={
                    form.scheduledFollowUpAt instanceof Date
                      ? form.scheduledFollowUpAt.toISOString().split("T")[0]
                      : form.scheduledFollowUpAt?.toDate
                      ? form.scheduledFollowUpAt.toDate().toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => set("scheduledFollowUpAt", e.target.value ? new Date(e.target.value) : null)}
                  className={`flex-1 min-w-0 ${inputCls}`}
                />
                {form.scheduledFollowUpAt && (
                  <button type="button" onClick={() => set("scheduledFollowUpAt", null)} className="text-xs text-gray-400 hover:text-gray-600 font-semibold shrink-0">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Last contacted */}
            {form.lastContactedAt && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Last Contacted</label>
                <p className="text-sm text-gray-600">
                  {(form.lastContactedAt?.toDate ? form.lastContactedAt.toDate() : new Date(form.lastContactedAt))
                    .toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleMarkContacted}
              disabled={saving}
              className="w-full py-2.5 border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <FiCheck className="inline mr-1.5" size={13} />
              Mark as Contacted Today
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-4 py-3 bg-black hover:bg-gray-800 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors text-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {saved && <p className="text-center text-sm font-medium text-gray-700 mt-2">Changes saved.</p>}
        </div>
      )}

      {/* ── MILESTONES TAB ── */}
      {tab === "milestones" && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-widest">Milestones</p>
            {milestones.length === 0 ? (
              <p className="text-sm text-gray-700">
                No milestones configured. Add them in{" "}
                <button onClick={() => router.push("/settings")} className="underline font-semibold">Settings</button>.
              </p>
            ) : (
              <div className="space-y-2">
                {milestones.map((m) => {
                  const checked = !!form.milestones?.[m];
                  return (
                    <ProgressRow
                      key={m}
                      label={m}
                      checked={checked}
                      onToggle={() => set("milestones", { ...form.milestones, [m]: !checked })}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-black hover:bg-gray-800 text-white font-semibold rounded-xl disabled:opacity-50 transition-colors text-sm"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {saved && <p className="text-center text-sm font-medium text-gray-700 mt-2">Changes saved.</p>}
        </div>
      )}

      {/* ── MEETINGS TAB ── */}
      {tab === "meetings" && (
        <div className="space-y-4">
          <button
            onClick={openAddMeeting}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            <FiPlus size={16} /> Schedule Meeting
          </button>

          {!meetingsFetched ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-black border-t-transparent animate-spin" />
            </div>
          ) : meetings.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No meetings yet.</p>
          ) : (
            <>
              {upcomingMeetings.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Upcoming</p>
                  <div className="space-y-2">
                    {upcomingMeetings.map((m) => (
                      <MeetingCard key={m.id} meeting={m} onClick={() => openEditMeeting(m)} onConfirm={handleConfirmMeeting} />
                    ))}
                  </div>
                </div>
              )}
              {pastMeetings.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Past</p>
                  <div className="space-y-2">
                    {pastMeetings.map((m) => (
                      <MeetingCard key={m.id} meeting={m} onClick={() => openEditMeeting(m)} onConfirm={handleConfirmMeeting} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Meeting modal */}
      {meetingModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMeetingModal(null)} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">{meetingModal.mode === "add" ? "Schedule Meeting" : "Edit Meeting"}</p>
              <button onClick={() => setMeetingModal(null)} className="text-gray-400 hover:text-gray-600">
                <FiX size={20} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Date & Time *</label>
              <input
                type="datetime-local"
                value={meetingForm.date}
                onChange={(e) => setMeetingForm((f) => ({ ...f, date: e.target.value }))}
                className={`${inputCls} min-w-0`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Notes</label>
              <textarea
                value={meetingForm.notes}
                onChange={(e) => setMeetingForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="What to discuss…"
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Next Actions</label>
              <textarea
                value={meetingForm.nextActions}
                onChange={(e) => setMeetingForm((f) => ({ ...f, nextActions: e.target.value }))}
                rows={2}
                placeholder="What to do in next meeting…"
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="flex gap-2">
              {meetingModal.mode === "edit" && (
                <button
                  onClick={handleDeleteMeeting}
                  disabled={savingMeeting}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
                >
                  <FiTrash2 size={15} />
                </button>
              )}
              <button
                onClick={handleSaveMeeting}
                disabled={savingMeeting || !meetingForm.date}
                className="flex-1 py-3 bg-black hover:bg-gray-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {savingMeeting ? "Saving…" : meetingModal.mode === "add" ? "Schedule" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function MeetingCard({ meeting, onClick, onConfirm }) {
  const d = meeting.date?.toDate ? meeting.date.toDate() : new Date(meeting.date);
  const isPast = d < new Date();
  const needsConfirmation = isPast && meeting.completed == null;

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 space-y-2 ${needsConfirmation ? "border-gray-300" : "border-gray-100"}`}>
      <div className="flex items-start gap-3 cursor-pointer" onClick={onClick}>
        <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-white">{d.getDate()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          {meeting.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{meeting.notes}</p>}
          {meeting.nextActions && <p className="text-xs text-gray-400 truncate">Next: {meeting.nextActions}</p>}
        </div>
        {meeting.completed === true && <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">Done</span>}
        {meeting.completed === false && <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full shrink-0">Missed</span>}
      </div>
      {needsConfirmation && (
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Did this meeting happen?</p>
          <div className="flex gap-2">
            <button onClick={() => onConfirm(meeting, true)} className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-gray-900 text-white hover:bg-black transition-colors">
              ✓ Yes
            </button>
            <button onClick={() => onConfirm(meeting, false)} className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              ✗ No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", select, placeholder, textarea }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      {textarea ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder} className={`${inputCls} resize-none`} />
      ) : select ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          {select.map((o) =>
            typeof o === "string"
              ? <option key={o} value={o}>{o}</option>
              : <option key={o.value} value={o.value}>{o.label}</option>
          )}
        </select>
      ) : (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
      )}
    </div>
  );
}

function ProgressRow({ label, checked, onToggle }) {
  return (
    <div
      onClick={onToggle}
      className={`flex justify-between items-center rounded-xl px-3.5 py-3 cursor-pointer transition-all border ${
        checked ? "bg-black border-black text-white" : "bg-gray-50 border-gray-200 text-gray-700"
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className={`text-base font-bold ${checked ? "text-white" : "text-gray-400"}`}>{checked ? "✓" : "○"}</span>
    </div>
  );
}
