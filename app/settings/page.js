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
import { FiLogOut, FiShield, FiPlus, FiX } from "react-icons/fi";
import { DEFAULT_FOLLOW_UP_DAYS, DEFAULT_INACTIVITY_DAYS } from "@/config/app";

export default function Settings() {
  const { user, profile, setProfile, loading } = useRequireAuth();
  const router = useRouter();
  const { collapsed } = useSidebar();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";

  const [followUpDays, setFollowUpDays] = useState(null);
  const [inactivityDays, setInactivityDays] = useState(null);
  const [savingReminders, setSavingReminders] = useState(false);
  const [savedReminders, setSavedReminders] = useState(false);

  const [milestones, setMilestones] = useState([]);
  const [newMilestone, setNewMilestone] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);

  useEffect(() => {
    if (profile) {
      setFollowUpDays(profile.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS);
      setInactivityDays(profile.inactivityCheckDays ?? DEFAULT_INACTIVITY_DAYS);
      setMilestones(profile.customMilestones || []);
    }
  }, [profile]);

  const handleSaveReminders = async () => {
    const days = Math.min(365, Math.max(1, parseInt(followUpDays) || DEFAULT_FOLLOW_UP_DAYS));
    const inDays = Math.min(365, Math.max(7, parseInt(inactivityDays) || DEFAULT_INACTIVITY_DAYS));
    setSavingReminders(true);
    await updateUserProfile(user.uid, { followUpDays: days, inactivityCheckDays: inDays });
    setSavingReminders(false);
    setSavedReminders(true);
    setTimeout(() => setSavedReminders(false), 2000);
  };

  const handleAddMilestone = async () => {
    const name = newMilestone.trim();
    if (!name || milestones.includes(name)) return;
    setAddingMilestone(true);
    const updated = [...milestones, name];
    await updateUserProfile(user.uid, { customMilestones: updated });
    setMilestones(updated);
    setNewMilestone("");
    setAddingMilestone(false);
  };

  const handleDeleteMilestone = async (name) => {
    const updated = milestones.filter((m) => m !== name);
    await updateUserProfile(user.uid, { customMilestones: updated });
    setMilestones(updated);
  };

  if (loading) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SideNav />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${ml}`}>
        {/* Hero */}
        <div className="bg-black px-5 pt-12 pb-8">
          <div className="max-w-lg mx-auto md:max-w-3xl">
            <p className="text-gray-400 text-sm font-medium">Settings</p>
            <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">{profile?.name || "—"}</h1>
          </div>
        </div>

        <main className="flex-1 pb-24 md:pb-10 -mt-4 px-4">
          <div className="max-w-lg mx-auto md:max-w-3xl space-y-3">

            {/* Account */}
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

            {/* Follow-up Reminders */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Follow-up Reminders</p>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-700">First follow-up after</p>
                <p className="text-xs text-gray-400">Remind you to contact a new client this many days after adding them.</p>
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
                <p className="text-xs text-gray-400">Flag clients you haven't contacted in this long — to check if they're still active.</p>
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

            {/* Custom Milestones */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Custom Milestones</p>
                <p className="text-xs text-gray-400 mt-1">Track specific achievements for your clients. These appear as checkboxes on each client's profile.</p>
              </div>

              {milestones.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {milestones.map((m) => (
                    <div key={m} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-xl">
                      <span className="text-sm font-semibold text-gray-800">{m}</span>
                      <button
                        onClick={() => handleDeleteMilestone(m)}
                        className="text-gray-400 hover:text-gray-700 ml-1 transition-colors"
                      >
                        <FiX size={12} />
                      </button>
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

            {/* Admin Dashboard link */}
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

            {/* Sign Out */}
            <button
              onClick={() => signOut(auth).then(() => router.push("/login"))}
              className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                <FiLogOut className="text-gray-500" size={16} />
              </div>
              <span className="flex-1 text-left font-semibold text-gray-600">Sign Out</span>
            </button>

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
