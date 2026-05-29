"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getClientsByAssignee, updateClient } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";
import PageShell from "@/components/PageShell";
import { FiArchive, FiCheck } from "react-icons/fi";
import { DEFAULT_FOLLOW_UP_DAYS, DEFAULT_INACTIVITY_DAYS, STATUS_STYLES } from "@/config/app";

function daysSince(date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function getRefDate(c) {
  if (c.lastContactedAt?.toDate) return c.lastContactedAt.toDate();
  if (c.createdAt?.toDate) return c.createdAt.toDate();
  if (c.createdAt) return new Date(c.createdAt);
  return null;
}

function getScheduledDate(c) {
  if (!c.scheduledFollowUpAt) return null;
  if (c.scheduledFollowUpAt.toDate) return c.scheduledFollowUpAt.toDate();
  return new Date(c.scheduledFollowUpAt);
}

function classifyClients(clients, followUpDays, inactivityDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const type3 = [], type2 = [], type1 = [], upcoming = [];

  clients.forEach((c) => {
    const ref = getRefDate(c);
    const scheduled = getScheduledDate(c);
    const since = ref ? daysSince(ref) : null;
    const interval = c.followUpDays ?? followUpDays;

    if (scheduled && scheduled <= today) {
      type3.push({ ...c, _scheduled: scheduled });
      return;
    }

    if (since !== null && since >= inactivityDays) {
      type2.push({ ...c, _since: since });
      return;
    }

    const createdAt = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt ? new Date(c.createdAt) : null);
    const daysSinceCreated = createdAt ? daysSince(createdAt) : null;
    if (!c.lastContactedAt && daysSinceCreated !== null && daysSinceCreated >= interval) {
      type1.push({ ...c, _daysOverdue: daysSinceCreated - interval });
      return;
    }

    const dueIn = since !== null ? interval - since : null;
    const scheduledIn = scheduled ? Math.ceil((scheduled - today) / (1000 * 60 * 60 * 24)) : null;

    if ((dueIn !== null && dueIn <= 7) || (scheduledIn !== null && scheduledIn <= 7)) {
      upcoming.push({ ...c, _dueIn: dueIn, _scheduledIn: scheduledIn });
    }
  });

  type3.sort((a, b) => a._scheduled - b._scheduled);
  type2.sort((a, b) => b._since - a._since);
  type1.sort((a, b) => b._daysOverdue - a._daysOverdue);
  upcoming.sort((a, b) => {
    const aMin = Math.min(a._dueIn ?? 99, a._scheduledIn ?? 99);
    const bMin = Math.min(b._dueIn ?? 99, b._scheduledIn ?? 99);
    return aMin - bMin;
  });

  return { type1, type2, type3, upcoming };
}

export default function FollowUps() {
  const { user, profile, loading } = useRequireAuth();
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [acting, setActing] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (!user) return;
    getClientsByAssignee(user.uid).then((all) => {
      setClients(all);
      setFetching(false);
    });
  }, [user]);

  if (loading) return null;

  const followUpDays = profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;
  const inactivityDays = profile?.inactivityCheckDays ?? DEFAULT_INACTIVITY_DAYS;

  const { type1, type2, type3, upcoming } = classifyClients(clients, followUpDays, inactivityDays);
  const totalDue = type1.length + type2.length + type3.length;

  const setAct = (id, val) => setActing((prev) => ({ ...prev, [id]: val }));
  const clearAct = (id) => setActing((prev) => { const n = { ...prev }; delete n[id]; return n; });

  const handleCheck = async (client) => {
    setAct(client.id, "checking");
    await updateClient(client.id, {
      lastContactedAt: serverTimestamp(),
      ...(client.scheduledFollowUpAt ? { scheduledFollowUpAt: null } : {}),
    });
    setClients((prev) => prev.map((c) =>
      c.id === client.id
        ? { ...c, lastContactedAt: { toDate: () => new Date() }, scheduledFollowUpAt: null }
        : c
    ));
    clearAct(client.id);
  };

  const handleArchive = async (client) => {
    setAct(client.id, "archiving");
    await updateClient(client.id, { archived: true });
    setClients((prev) => prev.filter((c) => c.id !== client.id));
    clearAct(client.id);
    showToast(`${client.name} archived`);
  };

  return (
    <PageShell title="Follow-ups">
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}
      {fetching ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-black border-t-transparent animate-spin" />
        </div>
      ) : totalDue === 0 && upcoming.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-semibold text-gray-800">All caught up!</p>
          <p className="text-sm text-gray-400 mt-1">No follow-ups due in the next 7 days.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {type3.length > 0 && (
            <Section label="Scheduled" count={type3.length} accent="text-gray-700">
              {type3.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  badge={`Scheduled · ${c._scheduled.toLocaleDateString([], { month: "short", day: "numeric" })}`}
                  badgeColor="text-gray-600"
                  onNavigate={() => router.push(`/client/${c.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[c.id]}
                />
              ))}
            </Section>
          )}

          {type2.length > 0 && (
            <Section label="Check if still active" count={type2.length} accent="text-gray-500">
              <p className="text-xs text-gray-400 -mt-1">
                These clients haven't been contacted in {inactivityDays}+ days.
              </p>
              {type2.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  badge={`${c._since}d without contact`}
                  badgeColor="text-gray-500"
                  onNavigate={() => router.push(`/client/${c.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[c.id]}
                  checkLabel="Still active"
                />
              ))}
            </Section>
          )}

          {type1.length > 0 && (
            <Section label="Follow up" count={type1.length} accent="text-black">
              {type1.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  badge={c._daysOverdue === 0 ? "Due today" : `${c._daysOverdue}d overdue`}
                  badgeColor="text-black font-bold"
                  onNavigate={() => router.push(`/client/${c.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[c.id]}
                />
              ))}
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section label="Coming up" count={upcoming.length} accent="text-gray-400">
              {upcoming.map((c) => {
                const dueIn = c._dueIn !== null ? c._dueIn : c._scheduledIn;
                return (
                  <ClientRow
                    key={c.id}
                    client={c}
                    badge={dueIn === 0 ? "Due today" : `In ${dueIn}d`}
                    badgeColor="text-gray-500"
                    onNavigate={() => router.push(`/client/${c.id}`)}
                    onCheck={handleCheck}
                    onArchive={handleArchive}
                    acting={acting[c.id]}
                  />
                );
              })}
            </Section>
          )}
        </div>
      )}
    </PageShell>
  );
}

function Section({ label, count, accent, children }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-gray-800">
        {label} <span className={`font-semibold text-sm ${accent}`}>({count})</span>
      </p>
      {children}
    </div>
  );
}

function ClientRow({ client, badge, badgeColor, onNavigate, onCheck, onArchive, acting, checkLabel }) {
  const isChecking = acting === "checking";
  const isArchiving = acting === "archiving";
  const busy = !!acting;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <p className="font-semibold text-gray-900 truncate">{client.name}</p>
        <p className="text-sm text-gray-500 truncate">
          {client.contactType && <span>{client.contactType} · </span>}
          {client.contact}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {client.status && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[client.status] || "bg-gray-100 text-gray-700"}`}>
              {client.status}
            </span>
          )}
          <span className={`text-[10px] font-semibold ${badgeColor}`}>{badge}</span>
          {client.followUpDays && (
            <span className="text-[10px] text-gray-400">· every {client.followUpDays}d</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onArchive(client)}
        disabled={busy}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 transition-colors"
      >
        {isArchiving
          ? <span className="w-3 h-3 rounded-full border border-gray-400 border-t-transparent animate-spin" />
          : <FiArchive size={12} className="text-gray-500" />}
        <span className="text-xs font-semibold text-gray-500">Archive</span>
      </button>

      <button
        onClick={() => onCheck(client)}
        disabled={busy}
        title={checkLabel || "Mark as contacted"}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 ${
          isChecking ? "bg-black border-black" : "border-gray-300 hover:border-gray-500"
        }`}
      >
        {isChecking && <FiCheck size={11} className="text-white" />}
      </button>
    </div>
  );
}
