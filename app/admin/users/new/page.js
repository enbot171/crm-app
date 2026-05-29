"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase";
import { addUserProfile } from "@/lib/firestore";
import AdminBottomNav from "@/components/AdminBottomNav";
import { FiChevronLeft } from "react-icons/fi";
import { USER_ROLES } from "@/config/app";

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white transition-colors";

export default function AdminAddUser() {
  const { loading, profile } = useRequireAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "User" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && profile && profile.role !== "Admin") router.push("/");
  }, [loading, profile, router]);

  if (loading) return null;
  if (profile?.role !== "Admin") return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) return setError("All fields are required.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    setSaving(true);
    setError("");
    let secondaryApp;
    try {
      secondaryApp = initializeApp(firebaseConfig, "user-creation-" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      await addUserProfile(cred.user.uid, {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        customMilestones: [],
        followUpDays: 7,
        inactivityCheckDays: 30,
      });
      router.push("/admin/users");
    } catch (err) {
      setError(err.message || "Failed to create user.");
      setSaving(false);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-black px-5 pt-12 pb-8">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.push("/admin/users")} className="text-gray-400 hover:text-white transition-colors">
            <FiChevronLeft size={22} />
          </button>
          <div>
            <p className="text-gray-400 text-sm font-medium">Admin</p>
            <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">Add User</h1>
          </div>
        </div>
      </div>

      <main className="flex-1 pb-24 -mt-4 px-4">
        <div className="max-w-lg mx-auto">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">New User</p>

              {[
                { label: "Full Name", key: "name", type: "text", placeholder: "Jane Smith" },
                { label: "Email", key: "email", type: "email", placeholder: "jane@example.com" },
                { label: "Password", key: "password", type: "password", placeholder: "Min. 6 characters" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">{label}</label>
                  <input type={type} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} className={inputCls} />
                </div>
              ))}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Role</label>
                <div className="flex gap-2">
                  {USER_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => set("role", r)}
                      className={`flex-1 py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                        form.role === r ? "bg-black text-white border-transparent" : "bg-white text-gray-700 border-gray-200"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
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
              className="w-full py-3.5 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating…" : "Create User"}
            </button>
          </form>
        </div>
      </main>

      <AdminBottomNav />
    </div>
  );
}
