"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { updateUserProfile } from "@/lib/firestore";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import { useSidebar } from "@/context/SidebarContext";
import { FiLogOut, FiShield, FiPlus, FiX, FiChevronUp, FiChevronDown } from "react-icons/fi";
import { DEFAULT_FOLLOW_UP_DAYS, DEFAULT_INACTIVITY_DAYS, CLIENT_STATUSES } from "@/config/app";

const TABS = ["Account", "Follow-ups", "Statuses & Milestones"];

export default function Settings() {
  const { user, profile, setProfile, loading } = useRequireAuth();
  const router = useRouter();
  const { collapsed } = useSidebar();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";
  const [tab, setTab] = useState("Account");

  const [followUpDays, setFollowUpDays] = useState(null);
  const [inactivityDays, setInactivityDays] = useState(null);
  const [savingReminders, setSavingReminders] = useState(false);
  const [savedReminders, setSavedReminders] = useState(false);

  const [statuses, setStatuses] = useState([]);
  const [newStatus, setNewStatus] = useState("");
  const [addingStatus, setAddingStatus] = useState(false);

  const [milestones, setMilestones] = useState([]);
  const [newMilestone, setNewMilestone] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);

  useEffect(() => {
    if (profile) {
      setFollowUpDays(profile.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS);
      setInactivityDays(profile.inactivityCheckDays ?? DEFAULT_INACTIVITY_DAYS);
      setStatuses(profile.customStatuses ?? CLIENT_STATUSES);
      setMilestones(profile.customMilestones || []);
    }
  }, [profile]);

  const save = async (data) => {
    await updateUserProfile(user.uid, data);
    setProfile((prev) => ({ ...prev, ...data }));
  };

  const handleSaveReminders = async () => {
    const days = Math.min(365, Math.max(1, parseInt(followUpDays) || DEFAULT_FOLLOW_UP_DAYS));
    const inDays = Math.min(365, Math.max(7, parseInt(inactivityDays) || DEFAULT_INACTIVITY_DAYS));
    setSavingReminders(true);
    await save({ followUpDays: days, inactivityCheckDays: inDays });
    setSavingReminders(false);
    setSavedReminders(true);
    setTimeout(() => setSavedReminders(false), 2000);
  };

  const handleAddStatus = async () => {
    const name = newStatus.trim();
    if (!name || statuses.includes(name)) return;
    setAddingStatus(true);
    const updated = [...statuses, name];
    await save({ customStatuses: updated });
    setStatuses(updated);
    setNewStatus("");
    setAddingStatus(false);
  };

  const handleDeleteStatus = async (name) => {
    const updated = statuses.filter((s) => s !== name);
    await save({ customStatuses: updated });
    setStatuses(updated);
  };

  const handleMoveStatus = async (idx, dir) => {
    const updated = [...statuses];
    const target = idx + dir;
    if (target < 0 || target >= updated.length) return;
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    await save({ customStatuses: updated });
    setStatuses(updated);
  };

  const handleAddMilestone = async () => {
    const name = newMilestone.trim();
    if (!name || milestones.includes(name)) return;
    setAddingMilestone(true);
    const updated = [...milestones, name];
    await save({ customMilestones: updated });
    setMilestones(updated);
    setNewMilestone("");
    setAddingMilestone(false);
  };

  const handleDeleteMilestone = async (name) => {
    const updated = milestones.filter((m) => m !== name);
    await save({ customMilestones: updated });
    setMilestones(updated);
  };

  const handleMoveMilestone = async (idx, dir) => {
    const updated = [...milestones];
    const target = idx + dir;
    if (target < 0 || target >= updated.length) return;
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    await save({ customMilestones: updated });
    setMilestones(updated);
  };

  if (loading) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SideNav />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${ml}`}>
        <div className="bg-black px-5 pt-12 pb-8">
          <div className="max-w-lg mx-auto md:max-w-3xl">
            <p className="text-gray-400 text-sm font-medium">Settings</p>
            <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">{profile?.name || "—"}</h1>
          </div>
        </div>

        <main className="flex-1 pb-24 md:pb-10 -mt-4 px-4">
          <div className="max-w-lg mx-auto md:max-w-3xl space-y-3">

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-200 p-1 rounded-xl">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* ── Account Tab ── */}
            {tab === "Account" && (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">My Account</p>
                  <div className="space-y-3">
                    <Row label="Name" value={profile?.name || "—"} />
                    <Row label="Email" value={profile?.email || "—"} />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Role</span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${profile?.role === "Admin" ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}>
                        {profile?.role || "User"}
                      </span>
                    </div>
                  </div>
                </div>

                {profile?.role === "Admin" && (
                  <button
                    onClick={() => router.push("/admin")}
                    className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center">
                      <FiShield className="text-white" size={16} />
                    </div>
                    <span className="flex-1 text-left font-semibold text-gray-800">Admin Dashboard</span>
                  </button>
                )}

                <button
                  onClick={() => signOut(auth).then(() => router.push("/login"))}
                  className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                    <FiLogOut className="text-gray-500" size={16} />
                  </div>
                  <span className="flex-1 text-left font-semibold text-gray-600">Sign Out</span>
                </button>
              </>
            )}

            {/* ── Follow-ups Tab ── */}
            {tab === "Follow-ups" && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Follow-up Reminders</p>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-700">First follow-up after</p>
                  <p className="text-xs text-gray-700">Remind you to contact a new client this many days after adding them.</p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number" min={1} max={365}
                      value={followUpDays ?? DEFAULT_FOLLOW_UP_DAYS}
                      onChange={(e) => setFollowUpDays(e.target.value)}
                      className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 bg-gray-50 text-center"
                    />
                    <span className="text-sm text-gray-500">days</span>
                  </div>
                </div>

                <div className="border-t border-gray-100" />

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-700">Inactivity check after</p>
                  <p className="text-xs text-gray-700">Flag clients you haven't contacted in this long — to check if they're still active.</p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number" min={7} max={365}
                      value={inactivityDays ?? DEFAULT_INACTIVITY_DAYS}
                      onChange={(e) => setInactivityDays(e.target.value)}
                      className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 bg-gray-50 text-center"
                    />
                    <span className="text-sm text-gray-500">days</span>
                  </div>
                </div>

                <button
                  onClick={handleSaveReminders}
                  disabled={savingReminders}
                  className="w-full py-2.5 bg-black hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {savingReminders ? "Saving…" : savedReminders ? "Saved!" : "Save"}
                </button>
              </div>
            )}

            {/* ── Statuses & Milestones Tab ── */}
            {tab === "Statuses & Milestones" && (
              <>
                {/* Pipeline Statuses */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Pipeline Statuses</p>
                    <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">
                      A status represents where a client currently sits in your sales pipeline — one stage at a time, from first contact to fully converted. Order them from earliest to most advanced. Colors automatically go from light to dark as stages progress.
                    </p>
                  </div>

                  {statuses.length > 0 && (
                    <div className="space-y-2">
                      {statuses.map((s, idx) => (
                        <div key={s} className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{s}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMoveStatus(idx, -1)}
                              disabled={idx === 0}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-20 transition-colors"
                            >
                              <FiChevronUp size={14} />
                            </button>
                            <button
                              onClick={() => handleMoveStatus(idx, 1)}
                              disabled={idx === statuses.length - 1}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-20 transition-colors"
                            >
                              <FiChevronDown size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteStatus(s)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors ml-0.5"
                            >
                              <FiX size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddStatus()}
                      placeholder="e.g. Hot Lead"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors"
                    />
                    <button
                      onClick={handleAddStatus}
                      disabled={addingStatus || !newStatus.trim()}
                      className="px-4 py-2.5 bg-black hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
                    >
                      <FiPlus size={15} />
                    </button>
                  </div>
                </div>

                {/* Custom Milestones */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Custom Milestones</p>
                    <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">
                      Milestones are specific achievements in a client's journey that you want to track — like sending a proposal or signing a policy. Unlike statuses, a client can have multiple milestones checked at the same time, and they don't follow a set order.
                    </p>
                  </div>

                  {milestones.length > 0 && (
                    <div className="space-y-2">
                      {milestones.map((m, idx) => (
                        <div key={m} className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{m}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMoveMilestone(idx, -1)}
                              disabled={idx === 0}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-20 transition-colors"
                            >
                              <FiChevronUp size={14} />
                            </button>
                            <button
                              onClick={() => handleMoveMilestone(idx, 1)}
                              disabled={idx === milestones.length - 1}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-20 transition-colors"
                            >
                              <FiChevronDown size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteMilestone(m)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors ml-0.5"
                            >
                              <FiX size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMilestone}
                      onChange={(e) => setNewMilestone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()}
                      placeholder="e.g. Sent Proposal"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors"
                    />
                    <button
                      onClick={handleAddMilestone}
                      disabled={addingMilestone || !newMilestone.trim()}
                      className="px-4 py-2.5 bg-black hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
                    >
                      <FiPlus size={15} />
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
