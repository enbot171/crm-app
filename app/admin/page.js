"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AdminBottomNav from "@/components/AdminBottomNav";
import SideNav from "@/components/SideNav";
import Spinner from "@/components/Spinner";
import { useSidebar } from "@/context/SidebarContext";
import { FiUsers } from "react-icons/fi";

export default function AdminDashboard() {
  const { profile, loading } = useRequireAuth();
  const router = useRouter();
  const { collapsed } = useSidebar();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";

  useEffect(() => {
    if (!loading && profile && profile.role !== "Admin") router.push("/");
  }, [loading, profile, router]);

  if (loading) return <Spinner fullScreen />;
  if (profile?.role !== "Admin") return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SideNav />

      <div className={`flex-1 flex flex-col transition-all duration-200 ${ml}`}>
        <div className="bg-black px-5 pt-12 pb-8">
          <div className="max-w-lg mx-auto md:max-w-3xl">
            <p className="text-gray-400 text-sm font-medium">Admin</p>
            <h1 className="text-white text-2xl font-bold tracking-tight mt-0.5">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Welcome, {profile?.name}</p>
          </div>
        </div>

        <main className="flex-1 pb-24 md:pb-10 -mt-4">
          <div className="px-4 max-w-lg mx-auto md:max-w-3xl space-y-3">
            <button
              onClick={() => router.push("/admin/users")}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                <FiUsers className="text-gray-700" size={22} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Users</p>
                <p className="text-xs text-gray-500 mt-0.5">Manage FA accounts</p>
              </div>
            </button>
          </div>
        </main>

        <AdminBottomNav />
      </div>
    </div>
  );
}
