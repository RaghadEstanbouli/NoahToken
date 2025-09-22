import React, { useEffect, useMemo, useRef, useState } from "react";

// Kid Token Tracker – React App
// Features: 
// - Add/Subtract tokens (±1, 5, 10) with Undo
// - Milestones (positive/negative) with progress bars
// - Add/Edit/Delete milestones
// - Rename child’s name
// - Export/Import/Reset data
// - All persisted in localStorage

const STORAGE_KEY = "tokenTrackerAppV1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TokenTrackerApp() {
  const initial = loadState();
  const [childName, setChildName] = useState(initial?.childName ?? "Noah");
  const [tokens, setTokens] = useState(initial?.tokens ?? 0);
  const [milestones, setMilestones] = useState(
    initial?.milestones ?? [
      { id: uid(), title: "Choose Friday Movie Night", required: 20, kind: "positive" },
      { id: uid(), title: "Pick a Dessert", required: 10, kind: "positive" },
      { id: uid(), title: "Lose 15 min of Screen Time", required: 15, kind: "negative" },
    ]
  );
  const [history, setHistory] = useState(initial?.history ?? []);

  useEffect(() => {
    saveState({ childName, tokens, milestones, history });
  }, [childName, tokens, milestones, history]);

  const inc = (delta) => {
    setTokens((t) => {
      const newT = Math.max(0, t + delta);
      setHistory((h) => [{ type: "tokens", delta, at: Date.now() }, ...h].slice(0, 50));
      return newT;
    });
  };

  const undo = () => {
    const last = history[0];
    if (!last) return;
    if (last.type === "tokens") {
      setTokens((t) => Math.max(0, t - last.delta));
    }
    setHistory((h) => h.slice(1));
  };

  const addMilestone = (m) => setMilestones((arr) => [m, ...arr]);
  const removeMilestone = (id) => setMilestones((arr) => arr.filter((m) => m.id !== id));
  const updateMilestone = (id, patch) =>
    setMilestones((arr) => arr.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ childName, tokens, milestones }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `token-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importRef = useRef(null);
  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (typeof data.tokens === "number" && Array.isArray(data.milestones)) {
        setChildName(data.childName ?? childName);
        setTokens(Math.max(0, data.tokens));
        setMilestones(
          data.milestones.map((m) => ({
            id: m.id ?? uid(),
            title: String(m.title ?? "Untitled"),
            required: Math.max(1, Number(m.required ?? 1)),
            kind: m.kind === "negative" ? "negative" : "positive",
          }))
        );
      }
    } catch {}
    e.target.value = "";
  };

  const clearAll = () => {
    if (!confirm("Reset all data? This cannot be undone.")) return;
    setTokens(0);
    setMilestones([]);
    setHistory([]);
  };

  const totals = useMemo(() => {
    const achieved = milestones.filter((m) => tokens >= m.required).length;
    return { count: milestones.length, achieved };
  }, [milestones, tokens]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Kid Token Tracker</h1>
            <p className="text-sm text-slate-600 mt-1">
              Track tokens for rewards and consequences. Data is saved automatically on this device.
            </p>
          </div>
          <ChildNameEditor value={childName} onChange={setChildName} />
        </header>

        <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <TokenCard tokens={tokens} inc={inc} undo={undo} />
          <QuickActions exportData={exportData} importRef={importRef} onImport={onImport} clearAll={clearAll} />
          <SummaryCard totals={totals} />
        </section>

        <section className="mt-8">
          <MilestoneForm onAdd={(m) => addMilestone(m)} />
          <MilestoneList
            milestones={milestones}
            tokens={tokens}
            onRemove={removeMilestone}
            onUpdate={updateMilestone}
          />
        </section>
      </div>
      <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
    </div>
  );
}

function ChildNameEditor({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <>
          <input
            className="border rounded-xl px-3 py-2 outline-none focus:ring w-48"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onChange(draft.trim() || "Noah");
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button
            className="px-3 py-2 rounded-xl bg-slate-900 text-white"
            onClick={() => {
              onChange(draft.trim() || "Noah");
              setEditing(false);
            }}
          >
            Save
          </button>
        </>
      ) : (
        <>
          <div className="text-sm text-slate-600">Child:</div>
          <div className="font-semibold text-lg">{value}</div>
          <button className="px-3 py-1.5 rounded-xl border" onClick={() => setEditing(true)}>Edit</button>
        </>
      )}
    </div>
  );
}

function TokenCard({ tokens, inc, undo }) {
  const increments = [1, 5, 10];
  return (
    <div className="rounded-2xl shadow-sm bg-white p-4">
      <div className="text-sm text-slate-500">Current Tokens</div>
      <div className="text-5xl font-extrabold tracking-tight mt-1">{tokens}</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {increments.map((n) => (
          <button key={"add" + n} className="rounded-xl border py-2" onClick={() => inc(n)}>+{n}</button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {increments.map((n) => (
          <button key={"sub" + n} className="rounded-xl border py-2" onClick={() => inc(-n)}>−{n}</button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="rounded-xl border px-3 py-2" onClick={undo}>Undo</button>
      </div>
    </div>
  );
}

function QuickActions({ exportData, importRef, onImport, clearAll }) {
  return (
    <div className="rounded-2xl shadow-sm bg-white p-4 h-full">
      <div className="font-semibold">Data</div>
      <p className="text-sm text-slate-500">Your data is saved in this browser. You can also export a backup or import from a file.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-xl border px-3 py-2" onClick={exportData}>Export</button>
        <button className="rounded-xl border px-3 py-2" onClick={() => importRef.current?.click()}>Import</button>
        <button className="rounded-xl border px-3 py-2" onClick={clearAll}>Reset</button>
      </div>
    </div>
  );
}

function SummaryCard({ totals }) {
  return (
    <div className="rounded-2xl shadow-sm bg-white p-4">
      <div className="font-semibold">Milestones</div>
      <div className="text-sm text-slate-500">{totals.achieved} of {totals.count} achieved</div>
      <div className="mt-3 space-y-2">
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900"
            style={{ width: `${(totals.count ? (totals.achieved / totals.count) : 0) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function MilestoneForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [required, setRequired] = useState(10);
  const [kind, setKind] = useState("positive");

  return (
    <div className="rounded-2xl shadow-sm bg-white p-4">
      <div className="font-semibold text-lg">Add Milestone</div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-3">
          <label className="text-sm text-slate-600">Title</label>
          <input
            className="w-full border rounded-xl px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Choose Friday Movie Night"
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Tokens Required</label>
          <input
            type="number"
            min={1}
            className="w-full border rounded-xl px-3 py-2"
            value={required}
            onChange={(e) => setRequired(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Type</label>
          <select
            className="w-full border rounded-xl px-3 py-2"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <div className="md:col-span-1">
          <button
            className="w-full rounded-xl bg-slate-900 text-white px-3 py-2"
            onClick={() => {
              if (!title.trim()) return;
              onAdd({ id: uid(), title: title.trim(), required: Math.max(1, required), kind });
              setTitle("");
              setRequired(10);
              setKind("positive");
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function MilestoneList({ milestones, tokens, onRemove, onUpdate }) {
  if (!milestones.length) {
    return (
      <div className="mt-4 text-center text-slate-500">No milestones yet. Add one above.</div>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-1 gap-3">
      {milestones.map((m) => (
        <MilestoneItem
          key={m.id}
          milestone={m}
          tokens={tokens}
          onRemove={onRemove}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function MilestoneItem({ milestone, tokens, onRemove, onUpdate }) {
  const { id, title, required, kind } = milestone;
  const ratio = Math.min(1, tokens / required);
  const achieved = ratio >= 1;

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs px-2 py-1 rounded-full border ${
              kind === "positive" ? "border-emerald-300" : "border-rose-300"
            }`}
          >
            {kind === "positive" ? "Positive" : "Negative"}
          </span>
          <div className="font-semibold text-lg">{title}</div>
        </div>
        <div className="text-sm text-slate-600">
          Requires <b>{required}</b> tokens
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-500">
          <div>Progress</div>
          <div>{Math.floor(ratio * 100)}%</div>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full ${achieved ? "bg-emerald-600" : "bg-slate-900"}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        {achieved && (
          <div className="mt-2 text-emerald-700 text-sm">Achieved! 🎉</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-xl border px-3 py-1.5" onClick={() => onRemove(id)}>Delete</button>
        <InlineEdit label="Rename" initial={title} onSave={(v) => onUpdate(id, { title: v })} />
        <InlineNumberEdit label="Edit Required" initial={required} min={1} onSave={(v) => onUpdate(id, { required: v })} />
        <select
          className="rounded-xl border px-3 py-1.5"
          value={kind}
          onChange={(e) => onUpdate(id, { kind: e.target.value })}
        >
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
      </div>
    </div>
  );
}

function InlineEdit({ label, initial, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);

  return editing ? (
    <span className="flex items-center gap-2">
      <input
        className="border rounded-xl px-2 py-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(draft.trim() || initial);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        className="rounded-xl border px-2 py-1"
        onClick={() => {
          onSave(draft.trim() || initial);
          setEditing(false);
        }}
      >
        Save
      </button>
    </span>
  ) : (
    <button className="rounded-xl border px-3 py-1.5" onClick={() => setEditing(true)}>{label}</button>
  );
}

function InlineNumberEdit({ label, initial, min = 0, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);

  return editing ? (
    <span className="flex items-center gap-2">
      <input
        type="number"
        className="border rounded-xl px-2 py-1 w-24"
        value={draft}
        min={min}
        onChange={(e) => setDraft(Math.max(min, Number(e.target.value) || min))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(draft);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        className="rounded-xl border px-2 py-1"
        onClick={() => {
          onSave(draft);
          setEditing(false);
        }}
      >
        Save
      </button>
    </span>
  ) : (
    <button className="rounded-xl border px-3 py-1.5" onClick={() => setEditing(true)}>{label}</button>
  );
}
