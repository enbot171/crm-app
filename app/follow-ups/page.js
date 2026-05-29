"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getClientsByAssignee, updateClient } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";
import PageShell from "@/components/PageShell";
import { FiArchive, FiCheck } from "react-icons/fi";
import { DEFAULT_FOLLOW_UP_DAYS, CLIENT_STATUSES, getStatusStyle } from "@/config/app";

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

function classifyClients(clients, firstFollowUpDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const typeScheduled = [], typeFirst = [], typeRecurring = [], upcoming = [];

  clients.forEach((c) => {
    const ref = getRefDate(c);
    const scheduledDate = getScheduledDate(c);

    // Scheduled date has passed
    if (scheduledDate && scheduledDate <= today) {
      typeScheduled.push({ ...c, _scheduled: scheduledDate });
      return;
    }

    // Never been contacted — one-time first follow-up
    if (!c.lastContactedAt) {
      const createdAt = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt ? new Date(c.createdAt) : null);
      const sinceCreated = createdAt ? daysSince(createdAt) : null;
      if (sinceCreated === null) return;

      if (sinceCreated >= firstFollowUpDays) {
        typeFirst.push({ ...c, _daysOverdue: sinceCreated - firstFollowUpDays });
      } else {
        const dueIn = firstFollowUpDays - sinceCreated;
        if (dueIn <= 7) upcoming.push({ ...c, _dueIn: dueIn });
      }
      return;
    }

    // Already contacted — only trigger if client has a custom recurring interval
    if (c.followUpDays && ref) {
      const since = daysSince(ref);
      if (since >= c.followUpDays) {
        typeRecurring.push({ ...c, _daysOverdue: since - c.followUpDays });
      } else {
        const dueIn = c.followUpDays - since;
        if (dueIn <= 7) upcoming.push({ ...c, _dueIn: dueIn });
      }
      return;
    }

    // Future scheduled date within 7 days
    if (scheduledDate) {
      const scheduledIn = Math.ceil((scheduledDate - today) / (1000 * 60 * 60 * 24));
      if (scheduledIn > 0 && scheduledIn <= 7) {
        upcoming.push({ ...c, _dueIn: scheduledIn });
      }
    }
  });

  typeScheduled.sort((a, b) => a._scheduled - b._scheduled);
  typeFirst.sort((a, b) => b._daysOverdue - a._daysOverdue);
  typeRecurring.sort((a, b) => b._daysOverdue - a._daysOverdue);
  upcoming.sort((a, b) => (a._dueIn ?? 99) - (b._dueIn ?? 99));

  return { typeScheduled, typeFirst, typeRecurring, upcoming };
}

export default function FollowUps() {
  const { user, profile, loading } = useRequireAuth();
  const statuses = profile?.customStatuses ?? CLIENT_STATUSES;
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

  const firstFollowUpDays = profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;
  const { typeScheduled, typeFirst, typeRecurring, upcoming } = classifyClients(clients, firstFollowUpDays);
  const totalDue = typeScheduled.length + typeFirst.length + typeRecurring.length;

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
          <p className="text-sm text-gray-700 mt-1">No follow-ups due in the next 7 days.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {typeScheduled.length > 0 && (
            <Section label="Scheduled" count={typeScheduled.length}>
              {typeScheduled.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  badge={`Scheduled · ${c._scheduled.toLocaleDateString([], { month: "short", day: "numeric" })}`}
                  onNavigate={() => router.push(`/client/${c.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[c.id]}
                  statuses={statuses}
                />
              ))}
            </Section>
          )}

          {typeFirst.length > 0 && (
            <Section label="First follow-up" count={typeFirst.length}>
              {typeFirst.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  badge={c._daysOverdue === 0 ? "Due today" : `${c._daysOverdue}d overdue`}
                  onNavigate={() => router.push(`/client/${c.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[c.id]}
                  statuses={statuses}
                />
              ))}
            </Section>
          )}

          {typeRecurring.length > 0 && (
            <Section label="Recurring follow-up" count={typeRecurring.length}>
              {typeRecurring.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  badge={c._daysOverdue === 0 ? "Due today" : `${c._daysOverdue}d overdue`}
                  onNavigate={() => router.push(`/client/${c.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[c.id]}
                  statuses={statuses}
                />
              ))}
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section label="Coming up" count={upcoming.length}>
              {upcoming.map((c) => (
                <ClientRow
                  key={c.id}
                  client={c}
                  badge={c._dueIn === 0 ? "Due today" : `In ${c._dueIn}d`}
                  onNavigate={() => router.push(`/client/${c.id}`)}
                  onCheck={handleCheck}
                  onArchive={handleArchive}
                  acting={acting[c.id]}
                  statuses={statuses}
                />
              ))}
            </Section>
          )}

        </div>
      )}
    </PageShell>
  );
}

function Section({ label, count, children }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-gray-800">
        {label} <span className="font-semibold text-gray-500">({count})</span>
      </p>
      {children}
    </div>
  );
}

function ClientRow({ client, badge, onNavigate, onCheck, onArchive, acting, statuses }) {
  const isChecking = acting === "checking";
  const isArchiving = acting === "archiving";
  const busy = !!acting;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <p className="font-semibold text-gray-900 truncate">{client.name}</p>
        <p className="text-sm text-gray-700 truncate">
          {client.contactType && <span>{client.contactType} · </span>}
          {client.contact}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {client.status && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getStatusStyle(statuses, client.status)}`}>
              {client.status}
            </span>
          )}
          <span className="text-[10px] font-semibold text-gray-700">{badge}</span>
          {client.followUpDays && (
            <span className="text-[10px] text-gray-600">· every {client.followUpDays}d</span>
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
        <span className="text-xs font-semibold text-gray-700">Archive</span>
      </button>

      <button
        onClick={() => onCheck(client)}
        disabled={busy}
        title="Mark as contacted"
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 ${
          isChecking ? "bg-black border-black" : "border-gray-300 hover:border-gray-500"
        }`}
      >
        {isChecking && <FiCheck size={11} className="text-white" />}
      </button>
    </div>
  );
}
