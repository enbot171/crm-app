"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getMessagingGroupsByAssignee,
  getMessageTemplatesByAssignee,
  addMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  getClient,
} from "@/lib/firestore";
import PageShell from "@/components/PageShell";
import { FiSend, FiPlus, FiX, FiCopy, FiCheck, FiTrash2 } from "react-icons/fi";

function extractVariables(body) {
  const matches = body.match(/{{(\w+)}}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

function renderTemplate(body, vars) {
  return body.replace(/{{(\w+)}}/g, (_, key) => vars[key] || `{{${key}}}`);
}

function MessagingInner() {
  const searchParams = useSearchParams();
  const { user, loading } = useRequireAuth();

  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(searchParams.get("groupId") || "");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [groupClients, setGroupClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);

  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: "", body: "" });
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState([]);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [copied, setCopied] = useState({});

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMessagingGroupsByAssignee(user.uid),
      getMessageTemplatesByAssignee(user.uid),
    ]).then(([g, t]) => {
      setGroups(g);
      setTemplates(t);
    });
  }, [user]);

  useEffect(() => {
    if (!selectedGroupId) { setGroupClients([]); return; }
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group) return;
    setLoadingClients(true);
    Promise.all((group.clientIds || []).map((id) => getClient(id)))
      .then((clients) => setGroupClients(clients.filter(Boolean)))
      .finally(() => setLoadingClients(false));
  }, [selectedGroupId, groups]);

  if (loading) return null;

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const telegramClients = groupClients.filter((c) => c.contactType === "Telegram");

  const preview = selectedTemplate
    ? telegramClients.map((c) => ({
        client: c,
        message: renderTemplate(selectedTemplate.body, { name: c.name, telegram: c.contact }),
      }))
    : [];

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.body.trim()) return;
    setSavingTemplate(true);
    const variables = extractVariables(templateForm.body);
    const id = await addMessageTemplate({
      name: templateForm.name.trim(),
      body: templateForm.body.trim(),
      variables,
      assignedTo: user.uid,
    });
    const newT = { id, name: templateForm.name.trim(), body: templateForm.body.trim(), variables };
    setTemplates((prev) => [newT, ...prev]);
    setSelectedTemplateId(id);
    setTemplateForm({ name: "", body: "" });
    setShowCreateTemplate(false);
    setSavingTemplate(false);
  };

  const handleDeleteTemplate = async (t) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    await deleteMessageTemplate(t.id);
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
    if (selectedTemplateId === t.id) setSelectedTemplateId("");
  };

  const handleSend = async () => {
    if (!selectedTemplate || preview.length === 0) return;
    setSending(true);
    setSendResults([]);
    setFallbackMode(false);

    const payload = {
      template: selectedTemplate.body,
      recipients: preview.map((p) => ({
        name: p.client.name,
        telegram: p.client.contact,
      })),
    };

    try {
      const res = await fetch("http://localhost:8080/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok || !res.body) throw new Error("BulkMessenger unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const result = JSON.parse(line);
            setSendResults((prev) => [...prev, result]);
          } catch { /* skip malformed line */ }
        }
      }
    } catch {
      setFallbackMode(true);
    } finally {
      setSending(false);
    }
  };

  const handleCopy = (idx, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied((prev) => ({ ...prev, [idx]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [idx]: false })), 2000);
    });
  };

  return (
    <PageShell title="Messaging">
      <div className="space-y-4">

        {/* Step 1: Select Group */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">1. Select Group</p>
          {groups.length === 0 ? (
            <p className="text-sm text-gray-400">No groups yet. <button onClick={() => window.location.href="/groups"} className="underline text-gray-600">Create one</button>.</p>
          ) : (
            <select
              value={selectedGroupId}
              onChange={(e) => { setSelectedGroupId(e.target.value); setSendResults([]); setFallbackMode(false); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
            >
              <option value="">Choose a group…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.clientIds?.length || 0} clients, {(g.clientIds || []).length} total)
                </option>
              ))}
            </select>
          )}
          {selectedGroupId && (
            <p className="text-xs text-gray-500">
              {loadingClients ? "Loading…" : `${telegramClients.length} Telegram-eligible client${telegramClients.length !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>

        {/* Step 2: Select/Create Template */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">2. Message Template</p>
            <button
              onClick={() => setShowCreateTemplate((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-gray-600 px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiPlus size={11} /> New
            </button>
          </div>

          {showCreateTemplate && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Template Name</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Annual Review Invite"
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Message Body</label>
                <p className="text-[11px] text-gray-400">Use {'{{name}}'} for client name, {'{{telegram}}'} for handle, or any {'{{custom_var}}'}.</p>
                <textarea
                  value={templateForm.body}
                  onChange={(e) => setTemplateForm((f) => ({ ...f, body: e.target.value }))}
                  rows={4}
                  placeholder={"Hi {{name}}, I wanted to reach out…"}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 resize-none"
                />
              </div>
              {templateForm.body && extractVariables(templateForm.body).length > 0 && (
                <p className="text-xs text-gray-500">
                  Variables: {extractVariables(templateForm.body).map((v) => (
                    <span key={v} className="mx-0.5 px-1.5 py-0.5 bg-gray-200 rounded text-gray-700">{v}</span>
                  ))}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowCreateTemplate(false)} className="flex-1 py-2 border border-gray-200 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateForm.name.trim() || !templateForm.body.trim()}
                  className="flex-1 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {savingTemplate ? "Saving…" : "Save Template"}
                </button>
              </div>
            </div>
          )}

          {templates.length === 0 ? (
            <p className="text-sm text-gray-400">No templates yet. Create one above.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id === selectedTemplateId ? "" : t.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedTemplateId === t.id ? "border-black bg-gray-50" : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors ${selectedTemplateId === t.id ? "bg-black border-black" : "border-gray-300"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{t.body}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t); }}
                    className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: Preview */}
        {preview.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">3. Preview ({preview.length} recipients)</p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {preview.map(({ client, message }) => (
                <div key={client.id} className="bg-gray-50 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-700">{client.name} · {client.contact}</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{message}</p>
                </div>
              ))}
            </div>

            {/* Send button */}
            {sendResults.length === 0 && !fallbackMode && (
              <button
                onClick={handleSend}
                disabled={sending || preview.length === 0}
                className="w-full py-3 bg-black hover:bg-gray-800 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <FiSend size={15} />
                    Send via BulkMessenger ({preview.length})
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Fallback: manual copy-paste */}
        {fallbackMode && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-1">
              <p className="text-sm font-semibold text-gray-800">BulkMessenger not running</p>
              <p className="text-xs text-gray-500">Start BulkMessenger at localhost:8080, or copy each message below manually.</p>
            </div>
            {preview.map(({ client, message }, idx) => (
              <div key={client.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">{client.name} · {client.contact}</p>
                  <button
                    onClick={() => handleCopy(idx, message)}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {copied[idx] ? <FiCheck size={11} className="text-black" /> : <FiCopy size={11} />}
                    {copied[idx] ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{message}</p>
              </div>
            ))}
            <button onClick={() => setFallbackMode(false)} className="w-full py-2 text-xs font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Try BulkMessenger again
            </button>
          </div>
        )}

        {/* Send results */}
        {sendResults.length > 0 && !fallbackMode && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Results</p>
            {sendResults.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                {r.status === "sent"
                  ? <FiCheck size={14} className="text-black shrink-0" />
                  : <FiX size={14} className="text-gray-400 shrink-0" />}
                <span className={r.status === "sent" ? "text-gray-800" : "text-gray-400"}>{r.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{r.status}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </PageShell>
  );
}

export default function Messaging() {
  return (
    <Suspense>
      <MessagingInner />
    </Suspense>
  );
}
