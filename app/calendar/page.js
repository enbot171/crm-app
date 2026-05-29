"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getMeetingsByAssignee, getClientsByAssignee, addMeeting, updateMeeting, deleteMeeting } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import { FiChevronLeft, FiChevronRight, FiPlus, FiX, FiTrash2 } from "react-icons/fi";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toLocalDateStr(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split("T")[0];
}

function toDatetimeLocal(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CalendarPage() {
  const { user, profile, loading } = useRequireAuth();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [meetings, setMeetings] = useState([]);
  const [myClients, setMyClients] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ clientId: "", clientName: "", date: "", notes: "", nextActions: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMeetingsByAssignee(user.uid),
      getClientsByAssignee(user.uid),
    ]).then(([allMeetings, allClients]) => {
      setMeetings(allMeetings);
      setMyClients(allClients);
    });
  }, [user]);

  if (loading) return null;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const offset = (firstDow + 6) % 7;
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const todayStr = today.toISOString().split("T")[0];

  const meetingsByDay = {};
  meetings.forEach((m) => {
    const ds = toLocalDateStr(m.date);
    if (ds) { if (!meetingsByDay[ds]) meetingsByDay[ds] = []; meetingsByDay[ds].push(m); }
  });

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const openAdd = (dateStr) => {
    setForm({ clientId: "", clientName: "", date: dateStr ? `${dateStr}T09:00` : "", notes: "", nextActions: "" });
    setSearch("");
    setModal({ mode: "add" });
  };

  const openEdit = (meeting, e) => {
    e.stopPropagation();
    setForm({
      clientId: meeting.clientId || "",
      clientName: meeting.clientName || "",
      date: toDatetimeLocal(meeting.date),
      notes: meeting.notes || "",
      nextActions: meeting.nextActions || "",
    });
    setSearch(meeting.clientName || "");
    setModal({ mode: "edit", meeting });
  };

  const handleSave = async () => {
    if (!form.clientId || !form.date) return;
    setSaving(true);
    if (modal.mode === "add") {
      await addMeeting({ ...form, assignedTo: user.uid });
    } else {
      await updateMeeting(modal.meeting.id, { clientId: form.clientId, clientName: form.clientName, date: form.date, notes: form.notes, nextActions: form.nextActions });
    }
    const updated = await getMeetingsByAssignee(user.uid);
    setMeetings(updated);
    setModal(null);
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    await deleteMeeting(modal.meeting.id);
    setMeetings((prev) => prev.filter((m) => m.id !== modal.meeting.id));
    setModal(null);
    setSaving(false);
  };

  const filteredClients = myClients.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()));

  const needsConfirmation = meetings.filter((m) => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d < today && m.completed == null;
  });

  const upcomingMeetings = meetings.filter((m) => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d >= today;
  }).slice(0, 10);

  return (
    <PageShell
      title="Calendar"
      rightAction={
        <button
          onClick={() => openAdd("")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
        >
          <FiPlus size={14} /> Schedule
        </button>
      }
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <FiChevronLeft size={18} className="text-gray-600" />
        </button>
        <p className="font-bold text-gray-900">{MONTHS[month]} {year}</p>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <FiChevronRight size={18} className="text-gray-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <p key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</p>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100">
        {Array.from({ length: totalCells }).map((_, i) => {
          const day = i - offset + 1;
          if (day < 1 || day > daysInMonth) {
            return <div key={i} className="bg-gray-50 min-h-[64px]" />;
          }
          const pad = (n) => String(n).padStart(2, "0");
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
          const dayMeetings = meetingsByDay[dateStr] || [];
          const isToday = dateStr === todayStr;

          return (
            <div
              key={i}
              className={`bg-white min-h-[64px] p-1.5 cursor-pointer transition-colors hover:bg-gray-50 ${isToday ? "bg-gray-50 ring-1 ring-inset ring-black" : ""}`}
              onClick={() => openAdd(dateStr)}
            >
              <p className={`text-xs font-bold mb-1 ${isToday ? "text-black" : "text-gray-700"}`}>{day}</p>
              {dayMeetings.length > 0 && (
                <div className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                  <span className="text-[10px] font-semibold text-gray-700">{dayMeetings.length}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-black" />
          <span className="text-xs text-gray-500 font-medium">Meetings</span>
        </div>
      </div>

      {/* Needs confirmation */}
      {needsConfirmation.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-gray-800 mb-2">Needs Confirmation</p>
          <div className="space-y-2">
            {needsConfirmation.map((m) => {
              const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
              return (
                <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-gray-700">{d.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{m.clientName}</p>
                      <p className="text-xs text-gray-400">
                        {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {formatTime(m.date)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-gray-500">Did this meeting happen?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await updateMeeting(m.id, { completed: true });
                        setMeetings((prev) => prev.map((x) => x.id === m.id ? { ...x, completed: true } : x));
                      }}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-black text-white hover:bg-gray-800 transition-colors"
                    >
                      ✓ Yes, it happened
                    </button>
                    <button
                      onClick={async () => {
                        await updateMeeting(m.id, { completed: false });
                        setMeetings((prev) => prev.map((x) => x.id === m.id ? { ...x, completed: false } : x));
                      }}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      ✗ Didn't happen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming meetings list */}
      {upcomingMeetings.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-bold text-gray-800 mb-2">Upcoming Meetings</p>
          <div className="space-y-2">
            {upcomingMeetings.map((m) => {
              const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
              return (
                <div key={m.id} onClick={(e) => openEdit(m, e)} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">{d.getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{m.clientName}</p>
                    <p className="text-xs text-gray-400">
                      {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {formatTime(m.date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meeting modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">{modal.mode === "add" ? "Schedule Meeting" : "Edit Meeting"}</p>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <FiX size={20} />
              </button>
            </div>

            {/* Client picker */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Client *</label>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setForm((f) => ({ ...f, clientId: "", clientName: "" })); }}
                placeholder="Search clients…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white"
              />
              {search && !form.clientId && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm max-h-36 overflow-y-auto">
                  {filteredClients.slice(0, 6).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, clientId: c.id, clientName: c.name })); setSearch(c.name); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                    >
                      {c.name}
                    </button>
                  ))}
                  {filteredClients.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No matches</p>}
                </div>
              )}
              {form.clientId && <p className="text-xs text-gray-600 font-semibold">✓ {form.clientName} selected</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Date & Time *</label>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="What to discuss…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Next Actions</label>
              <textarea
                value={form.nextActions}
                onChange={(e) => setForm((f) => ({ ...f, nextActions: e.target.value }))}
                rows={2}
                placeholder="What to prepare or do next time…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white resize-none"
              />
            </div>

            <div className="flex gap-2">
              {modal.mode === "edit" && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
                >
                  <FiTrash2 size={15} />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !form.clientId || !form.date}
                className="flex-1 py-3 bg-black hover:bg-gray-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {saving ? "Saving…" : modal.mode === "add" ? "Schedule" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
