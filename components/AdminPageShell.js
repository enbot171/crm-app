"use client";

import AdminBottomNav from "./AdminBottomNav";
import { useSidebar } from "@/context/SidebarContext";

export default function AdminPageShell({ children }) {
  const { collapsed } = useSidebar();
  const ml = collapsed ? "md:ml-16" : "md:ml-60";

  return (
    <div className={`flex flex-col min-h-screen bg-gray-50 transition-all duration-200 ${ml}`}>
      {children}
      <AdminBottomNav />
    </div>
  );
}
