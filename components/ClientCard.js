"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { CLIENT_STATUSES, getStatusStyle } from "@/config/app";

export default function ClientCard({ client, onRemove, onSelect, selected }) {
  const router = useRouter();
  const { profile } = useAuth();
  const statuses = profile?.customStatuses ?? CLIENT_STATUSES;

  const handleClick = () => {
    if (onSelect) { onSelect(client); return; }
    router.push(`/client/${client.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform ${
        selected ? "border-gray-400 bg-gray-50" : "border-gray-100"
      }`}
    >
      {/* Avatar */}
      <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center shrink-0">
        <span className="text-white font-bold text-base">
          {client.name?.charAt(0).toUpperCase() || "?"}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{client.name}</p>
        <p className="text-sm text-gray-500 truncate">
          {client.contactType && <span className="text-gray-600">{client.contactType} · </span>}
          {client.contact}
        </p>
        {client.status && (
          <div className="mt-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getStatusStyle(statuses, client.status)}`}>
              {client.status}
            </span>
          </div>
        )}
      </div>

      {onSelect ? (
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          selected ? "bg-black border-black" : "border-gray-300"
        }`}>
          {selected && (
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      ) : onRemove ? (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(client); }}
          className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 hover:bg-gray-200 transition-colors"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </div>
  );
}
