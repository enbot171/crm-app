"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getClientsByAssignee, getMeetingsByAssignee, updateClient } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import Spinner from "@/components/Spinner";
import { useSidebar } from "@/context/SidebarContext";
import { FiCalendar, FiBell, FiSend, FiCheck } from "react-icons/fi";
import { DEFAULT_FOLLOW_UP_DAYS, CLIENT_STATUSES } from "@/config/app";
import { requestNotificationPermission, showOverdueNotification } from "@/lib/notifications";

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
  return c.scheduledFollowUpAt.toDate ? c.scheduledFollowUpAt.toDate() : new Date(c.scheduledFollowUpAt);
}

function getOverdueClients(clients, firstFollowUpDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return clients
    .filter((c) => {
      // Scheduled date has passed
      const scheduled = getScheduledDate(c);
      if (scheduled && scheduled <= today) return true;

      // Never contacted → one-time first follow-up threshold
      if (!c.lastContactedAt) {
        const createdAt = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt ? new Date(c.createdAt) : null);
        const sinceCreated = createdAt ? daysSince(createdAt) : null;
        return sinceCreated !== null && sinceCreated >= firstFollowUpDays;
      }

      // Already contacted → only trigger if client has a custom interval set
      if (c.followUpDays) {
        const ref = getRefDate(c);
        return ref ? daysSince(ref) >= c.followUpDays : false;
      }

      return false;
    })
    .sort((a, b) => {
      const refA = getRefDate(a), refB = getRefDate(b);
      const sinceA = refA ? daysSince(refA) : 0;
      const sinceB = refB ? daysSince(refB) : 0;
      return sinceB - sinceA;
    });
}

function StatCard({ label, value, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <p className="text-gray-700 text-sm font-semibold leading-tight">{label}</p>
      <p className="text-gray-900 text-3xl font-bold mt-1">{loading ? "—" : value ?? "—"}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, loading } = useRequireAuth();
  const { collapsed } = useSidebar();
  const router = useRouter();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";

  const [myClients, setMyClients] = useState([]);
  const [allMeetings, setAllMeetings] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [texting, setTexting] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    setStatsLoading(true);
    Promise.all([
      getClientsByAssignee(user.uid),
      getMeetingsByAssignee(user.uid),
    ]).then(([clients, meetings]) => {
      setMyClients(clients);
      setAllMeetings(meetings);
    }).finally(() => setStatsLoading(false));
  }, [user]);

  useEffect(() => {
    if (statsLoading || myClients.length === 0) return;
    const followUpDays = profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;
    const overdue = getOverdueClients(myClients, followUpDays);
    if (overdue.length > 0) {
      requestNotificationPermission().then((granted) => {
        if (granted) showOverdueNotification(overdue.length);
      });
    }
  }, [statsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner fullScreen />;

  const followUpDays = profile?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS;
  const statuses = profile?.customStatuses ?? CLIENT_STATUSES;
  const overdueClients = statsLoading ? [] : getOverdueClients(myClients, followUpDays);
  const overdueCount = overdueClients.length;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const todayMeetings = allMeetings.filter((m) => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d.toISOString().split("T")[0] === todayStr;
  });

  const upcomingMeetings = allMeetings.filter((m) => {
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
    return d >= now;
  }).slice(0, 3);

  const totalMeetings = allMeetings.filter((m) => m.completed === true).length;

  const statusCounts = statuses.reduce((acc, s) => {
    acc[s] = myClients.filter((c) => c.status === s).length;
    return acc;
  }, {});

  const handleTexted = async (client) => {
    setTexting((prev) => new Set([...prev, client.id]));
    await updateClient(client.id, { lastContactedAt: serverTimestamp() });
    setMyClients((prev) => prev.map((c) =>
      c.id === client.id ? { ...c, lastContactedAt: { toDate: () => new Date() } } : c
    ));
    setTexting((prev) => { const n = new Set(prev); n.delete(client.id); return n; });
  };

  const myMetrics = [
    { label: "Total Clients", value: myClients.length },
    { label: "Total Meetings", value: totalMeetings },
    ...statuses.map((s) => ({ label: s, value: statusCounts[s] })),
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SideNav />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${ml}`}>
        {/* Hero header */}
        <div className="bg-black px-5 pt-12 pb-8">
          <div className="max-w-lg mx-auto md:max-w-3xl">
            <p className="text-gray-400 text-sm font-medium">Welcome back</p>
            <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">
              {profile?.name || "—"}
            </h1>
            <span className="inline-block mt-2 text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
              {profile?.role || "User"}
            </span>
          </div>
        </div>

        <main className="flex-1 pb-24 md:pb-10 -mt-4">
          <div className="px-4 max-w-lg mx-auto md:max-w-3xl space-y-4">

            {/* Shortcut row */}
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/calendar")}
                className="flex-1 flex items-center gap-2 px-3 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <FiCalendar className="text-gray-700" size={13} />
                </div>
                <span className="text-sm font-semibold text-gray-800">Calendar</span>
              </button>
              <button
                onClick={() => router.push("/follow-ups")}
                className="relative flex-1 flex items-center gap-2 px-3 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <FiBell className="text-gray-700" size={13} />
                </div>
                <span className="text-sm font-semibold text-gray-800">Follow-ups</span>
                {overdueCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                    {overdueCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => router.push("/messaging")}
                className="flex-1 flex items-center gap-2 px-3 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <FiSend className="text-gray-700" size={13} />
                </div>
                <span className="text-sm font-semibold text-gray-800">Message</span>
              </button>
            </div>

            {/* Overdue follow-ups */}
            {overdueClients.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-gray-800">
                    Follow-ups <span className="text-gray-500 font-semibold">({overdueCount})</span>
                  </p>
                  {overdueCount > 5 && (
                    <button onClick={() => router.push("/follow-ups")} className="text-xs font-semibold text-gray-500">
                      See all →
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {overdueClients.slice(0, 5).map((c) => {
                    const ref = getRefDate(c);
                    const scheduled = getScheduledDate(c);
                    const today2 = new Date(); today2.setHours(0, 0, 0, 0);
                    const isScheduledDue = scheduled && scheduled <= today2;
                    const interval = c.followUpDays ?? followUpDays;
                    const days = ref ? daysSince(ref) - interval : 0;
                    const isBusy = texting.has(c.id);
                    return (
                      <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => router.push(`/client/${c.id}`)}>
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                          <p className="text-xs text-gray-500 font-semibold">
                            {isScheduledDue
                              ? `Scheduled · ${scheduled.toLocaleDateString([], { month: "short", day: "numeric" })}`
                              : days <= 0 ? "Due today" : `${days}d overdue`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleTexted(c)}
                          disabled={isBusy}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 ${
                            isBusy ? "bg-black border-black" : "border-gray-300 hover:border-gray-500"
                          }`}
                        >
                          {isBusy && <FiCheck size={11} className="text-white" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Today's meetings */}
            {todayMeetings.length > 0 && (
              <div>
                <p className="text-sm font-bold text-gray-800 mb-2">Today's Meetings</p>
                <div className="space-y-2">
                  {todayMeetings.map((m) => {
                    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                    return (
                      <div key={m.id} onClick={() => router.push("/calendar")} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors">
                        <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white">{d.getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{m.clientName}</p>
                          <p className="text-xs text-gray-700">{d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming meetings (when no today meetings) */}
            {upcomingMeetings.length > 0 && todayMeetings.length === 0 && (
              <div>
                <p className="text-sm font-bold text-gray-800 mb-2">Upcoming Meetings</p>
                <div className="space-y-2">
                  {upcomingMeetings.map((m) => {
                    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date);
                    return (
                      <div key={m.id} onClick={() => router.push("/calendar")} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors">
                        <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-white">{d.getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{m.clientName}</p>
                          <p className="text-xs text-gray-700">{d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => router.push("/calendar")} className="w-full text-center text-xs font-semibold text-gray-500 py-1">See all →</button>
                </div>
              </div>
            )}

            {/* Stats grid */}
            <p className="text-lg font-bold text-gray-800">My Stats</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {myMetrics.map((m) => (
                <StatCard key={m.label} label={m.label} value={m.value} loading={statsLoading} />
              ))}
            </div>

          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
