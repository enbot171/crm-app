"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getMessagingGroupsByAssignee,
  addMessagingGroup,
  updateMessagingGroup,
  deleteMessagingGroup,
  getClient,
  getClientsByAssignee,
} from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import ClientCard from "@/components/ClientCard";
import SearchBar from "@/components/SearchBar";
import { FiPlus, FiX, FiTrash2, FiSend, FiUsers } from "react-icons/fi";

const GROUP_COLORS = ["bg-gray-900", "bg-gray-700", "bg-gray-500", "bg-gray-400"];

export default function Groups() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();

  const [groups, setGroups] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupClients, setGroupClients] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Create group modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);

  // Add clients picker
  const [showAddClients, setShowAddClients] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [addingClientId, setAddingClientId] = useState(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMessagingGroupsByAssignee(user.uid),
      getClientsByAssignee(user.uid),
    ]).then(([g, c]) => {
      setGroups(g);
      setAllClients(c);
      setFetching(false);
    });
  }, [user]);

  const openGroup = async (group) => {
    setSelectedGroup(group);
    setLoadingClients(true);
    const clients = await Promise.all(
      (group.clientIds || []).map((id) => getClient(id))
    );
    setGroupClients(clients.filter(Boolean));
    setLoadingClients(false);
  };

  const handleCreateGroup = async () => {
    if (!createForm.name.trim()) return;
    setCreating(true);
    const id = await addMessagingGroup({
      name: createForm.name.trim(),
      description: createForm.description.trim(),
      clientIds: [],
      assignedTo: user.uid,
    });
    const newGroup = { id, name: createForm.name.trim(), description: createForm.description.trim(), clientIds: [], assignedTo: user.uid };
    setGroups((prev) => [newGroup, ...prev]);
    setCreateForm({ name: "", description: "" });
    setShowCreate(false);
    setCreating(false);
  };

  const handleDeleteGroup = async () => {
    if (!confirm(`Delete group "${selectedGroup.name}"?`)) return;
    await deleteMessagingGroup(selectedGroup.id);
    setGroups((prev) => prev.filter((g) => g.id !== selectedGroup.id));
    setSelectedGroup(null);
    setGroupClients([]);
  };

  const handleRemoveClient = async (client) => {
    const newIds = (selectedGroup.clientIds || []).filter((id) => id !== client.id);
    await updateMessagingGroup(selectedGroup.id, { clientIds: newIds });
    const updated = { ...selectedGroup, clientIds: newIds };
    setSelectedGroup(updated);
    setGroups((prev) => prev.map((g) => g.id === selectedGroup.id ? updated : g));
    setGroupClients((prev) => prev.filter((c) => c.id !== client.id));
  };

  const handleAddClient = async (client) => {
    if ((selectedGroup.clientIds || []).includes(client.id)) return;
    setAddingClientId(client.id);
    const newIds = [...new Set([...(selectedGroup.clientIds || []), client.id])];
    await updateMessagingGroup(selectedGroup.id, { clientIds: newIds });
    const updated = { ...selectedGroup, clientIds: newIds };
    setSelectedGroup(updated);
    setGroups((prev) => prev.map((g) => g.id === selectedGroup.id ? updated : g));
    setGroupClients((prev) => [...prev, client]);
    setAddingClientId(null);
  };

  if (loading) return null;

  const availableToAdd = allClients.filter(
    (c) => !(selectedGroup?.clientIds || []).includes(c.id) &&
      c.name?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Drill-down view
  if (selectedGroup) {
    return (
      <PageShell
        title={selectedGroup.name}
        backHref={null}
        rightAction={
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/messaging?groupId=${selectedGroup.id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <FiSend size={13} /> Message
            </button>
            <button onClick={handleDeleteGroup} className="text-gray-400 hover:text-gray-600">
              <FiTrash2 size={17} />
            </button>
          </div>
        }
      >
        <button
          onClick={() => { setSelectedGroup(null); setGroupClients([]); }}
          className="flex items-center gap-1 text-sm font-semibold text-gray-500 mb-4 hover:text-gray-800"
        >
          ← All Groups
        </button>

        {selectedGroup.description && (
          <p className="text-sm text-gray-700 mb-4">{selectedGroup.description}</p>
        )}

        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-800">
            Members <span className="text-gray-400">({selectedGroup.clientIds?.length || 0})</span>
          </p>
          <button
            onClick={() => { setShowAddClients(true); setClientSearch(""); }}
            className="flex items-center gap-1 text-xs font-semibold text-gray-600 px-3 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <FiPlus size={12} /> Add Clients
          </button>
        </div>

        {loadingClients ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-black border-t-transparent animate-spin" />
          </div>
        ) : groupClients.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <FiUsers size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-700">No clients in this group yet.</p>
            <button
              onClick={() => { setShowAddClients(true); setClientSearch(""); }}
              className="mt-3 text-xs font-semibold text-gray-700 underline"
            >
              Add your first client
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {groupClients.map((c) => (
              <ClientCard key={c.id} client={c} onRemove={handleRemoveClient} />
            ))}
          </div>
        )}

        {/* Add clients picker modal */}
        {showAddClients && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddClients(false)} />
            <div className="relative bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl p-6 space-y-4 shadow-xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between">
                <p className="font-bold text-gray-900">Add Clients</p>
                <button onClick={() => setShowAddClients(false)} className="text-gray-400 hover:text-gray-600">
                  <FiX size={20} />
                </button>
              </div>
              <SearchBar value={clientSearch} onChange={setClientSearch} />
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {availableToAdd.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {clientSearch ? "No matches" : "All clients already added"}
                  </p>
                ) : (
                  availableToAdd.slice(0, 20).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleAddClient(c)}
                      disabled={addingClientId === c.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-left transition-colors disabled:opacity-50"
                    >
                      <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0">
                        <span className="text-white font-bold text-sm">{c.name?.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.contactType} · {c.contact}</p>
                      </div>
                      {addingClientId === c.id && (
                        <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </PageShell>
    );
  }

  // Groups list view
  return (
    <PageShell
      title="Groups"
      rightAction={
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
        >
          <FiPlus size={14} /> New Group
        </button>
      }
    >
      {fetching ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-black border-t-transparent animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <FiUsers size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-gray-700">No groups yet</p>
          <p className="text-sm text-gray-700 mt-1">Create a group to send bulk messages to your clients.</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors">
            Create Group
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((g, i) => (
            <div
              key={g.id}
              onClick={() => openGroup(g)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform hover:bg-gray-50"
            >
              <div className={`w-11 h-11 rounded-xl ${GROUP_COLORS[i % GROUP_COLORS.length]} flex items-center justify-center shrink-0`}>
                <FiUsers size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{g.name}</p>
                <p className="text-sm text-gray-700">{g.clientIds?.length || 0} clients</p>
                {g.description && <p className="text-xs text-gray-400 truncate">{g.description}</p>}
              </div>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Create group modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl md:rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">New Group</p>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={20} />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Group Name *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Q1 Prospects"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Description</label>
              <input
                type="text"
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white"
              />
            </div>
            <button
              onClick={handleCreateGroup}
              disabled={creating || !createForm.name.trim()}
              className="w-full py-3 bg-black hover:bg-gray-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              {creating ? "Creating…" : "Create Group"}
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
