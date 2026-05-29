"use client";

import { useRouter, usePathname } from "next/navigation";
import { FaUsers } from "react-icons/fa";
import { FiSettings } from "react-icons/fi";

const tabs = [
  { path: "/admin/users", icon: FaUsers,    label: "Users" },
  { path: "/settings",    icon: FiSettings, label: "Settings" },
];

export default function AdminBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden">
      <div className="flex items-end justify-around px-4 pb-2 pt-1 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = pathname.startsWith(path);
          return (
            <button
              key={path}
              onClick={() => router.push(path)}
              className="flex flex-col items-center gap-1 py-2 px-4 rounded-xl"
            >
              <Icon size={22} className={active ? "text-black" : "text-gray-400"} />
              <span className={`text-[10px] font-semibold ${active ? "text-black" : "text-gray-400"}`}>{label}</span>
              <span className={`w-1 h-1 rounded-full ${active ? "bg-black" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
