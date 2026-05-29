"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getClientsByAssignee, getArchivedClientsByAssignee, updateClient } from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import ClientCard from "@/components/ClientCard";
import SearchBar from "@/components/SearchBar";
import { CLIENT_STATUSES, CONTACT_TYPES } from "@/config/app";
import { FiSliders, FiCheckSquare } from "react-icons/fi";

const STATUS_COLORS = {
  Prospect: "bg-gray-400",
  "Warm Lead": "bg-gray-500",
  "Strong Client": "bg-gray-700",
  Client: "bg-black",
};

const EMPTY_FILTERS = { contactType: "", status: "" };

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function Clients() {
  const { user, loading } = useRequireAuth();
  const [clients, setClients] = useState([]);
  const [archived, setArchived] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    Promise.all([getClientsByAssignee(user.uid), getArchivedClientsByAssignee(user.uid)])
      .then(([active, arch]) => { setClients(active); setArchived(arch); })
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return null;

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const toggleSelect = (client) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(client.id) ? next.delete(client.id) : next.add(client.id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    setArchiving(true);
    await Promise.all([...selectedIds].map((id) => updateClient(id, { archived: true })));
    const [active, arch] = await Promise.all([getClientsByAssignee(user.uid), getArchivedClientsByAssignee(user.uid)]);
    setClients(active);
    setArchived(arch);
    setSelectedIds(new Set());
    setSelectMode(false);
    setArchiving(false);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const pool = showArchived ? archived : clients;

  const filtered = pool.filter((c) => {
    if (activeStatus && c.status !== activeStatus) return false;
    if (filters.contactType && c.contactType !== filters.contactType) return false;
    if (filters.status && c.status !== filters.status) return false;
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <PageShell
      title="Clients"
      rightAction={
        <div className="flex items-center gap-3">
          {selectMode ? (
            <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} className="text-xs font-semibold text-gray-500">
              Cancel
            </button>
          ) : (
            <button onClick={() => setSelectMode(true)} className="flex flex-col items-center text-gray-600 active:opacity-70">
              <FiCheckSquare size={18} />
              <span className="text-[10px] font-semibold mt-0.5">Select</span>
            </button>
          )}
        </div>
      }
    >
      {/* Search + filter toggle */}
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`relative shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center transition-colors mb-4 ${
            showFilters || activeFilterCount > 0
              ? "bg-gray-900 border-gray-900 text-white"
              : "bg-white border-gray-200 text-gray-600"
          }`}
        >
          <FiSliders size={17} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FilterSelect
              label="Contact Type"
              value={filters.contactType}
              onChange={(v) => setFilter("contactType", v)}
              options={[{ value: "", label: "All" }, ...CONTACT_TYPES.map((t) => ({ value: t, label: t }))]}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(v) => setFilter("status", v)}
              options={[{ value: "", label: "All" }, ...CLIENT_STATUSES.map((s) => ({ value: s, label: s }))]}
            />
          </div>
          {activeFilterCount > 0 && (
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-semibold text-gray-500">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Status chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
            showArchived ? "bg-gray-700 text-white border-transparent" : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          Archived
        </button>
        {!showArchived && CLIENT_STATUSES.map((s) => {
          const active = activeStatus === s;
          return (
            <button
              key={s}
              onClick={() => setActiveStatus(active ? "" : s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
                active
                  ? `${STATUS_COLORS[s] || "bg-black"} text-white border-transparent`
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {fetching ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-black border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-12">
          {showArchived ? "No archived clients." : "No clients found. Tap + to add one."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              onSelect={selectMode ? toggleSelect : undefined}
              selected={selectedIds.has(c.id)}
            />
          ))}
        </div>
      )}

      {/* Bulk archive bar */}
      {selectMode && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={handleBulkArchive}
            disabled={selectedIds.size === 0 || archiving}
            className="flex items-center gap-2 px-6 py-3 bg-black disabled:opacity-40 text-white text-sm font-semibold rounded-2xl shadow-xl"
          >
            {archiving ? "Archiving…" : `Archive${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
          </button>
        </div>
      )}
    </PageShell>
  );
}
