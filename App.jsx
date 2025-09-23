import React, { useEffect, useMemo, useRef, useState } from "react";

// Kid Token Tracker – KIDS THEME 🎈
// - Colorful, responsive UI
// - Big friendly buttons with + / − icons
// - Avatar (kid icon) next to the child's name
// - "I"-shaped progress meter (fills up as tokens increase)
// - Milestones shown on a colorful progress line (rail)
// - Data persists in localStorage; export/import/undo

const STORAGE_KEY = "tokenTrackerAppV2";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
function uid() { return Math.random().toString(36).slice(2, 10); }

export default function TokenTrackerApp() {
  const initial = loadState();
  const [childName, setChildName] = useState(initial?.childName ?? "Noah");
  const [tokens, setTokens] = useState(initial?.tokens ?? 0);
  const [milestones, setMilestones] = useState(
    initial?.milestones ?? [
      { id: uid(), title: "Pick a Dessert", required: 10, kind: "positive" },
      { id: uid(), title: "Choose Movie Night", required: 20, kind: "positive" },
      { id: uid(), title: "Lose 15 min Screen", required: 15, kind: "negative" },
    ]
  );
  const [history, setHistory] = useState(initial?.history ?? []);

  useEffect(() => { saveState({ childName, tokens, milestones, history }); }, [childName, tokens, milestones, history]);

  // Auto-scale cap to the largest positive milestone or current tokens
  const cap = useMemo(() => {
    const posMax = Math.max(10, ...milestones.filter(m=>m.kind!=="negative").map(m=>m.required||0));
    return Math.max(posMax, tokens);
  }, [milestones, tokens]);

  const inc = (delta) => {
    setTokens(t => {
      const nt = Math.max(0, t + delta);
      setHistory(h => [{ type: "tokens", delta, at: Date.now() }, ...h].slice(0, 50));
      return nt;
    });
  };
  const undo = () => {
    const last = history[0];
    if (!last) return;
    if (last.type === "tokens") setTokens(t => Math.max(0, t - last.delta));
    setHistory(h => h.slice(1));
  };

  const addMilestone = (m) => setMilestones(arr => [m, ...arr]);
  const removeMilestone = (id) => setMilestones(arr => arr.filter(m => m.id !== id));
  const updateMilestone = (id, patch) => setMilestones(arr => arr.map(m => m.id===id?{...m, ...patch}:m));

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ childName, tokens, milestones }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `token-tracker-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importRef = useRef(null);
  const onImport = async (e) => {
    const f = e.target.files?.[0]; if (!f) return; const text = await f.text();
    try {
      const data = JSON.parse(text);
      if (typeof data.tokens === "number" && Array.isArray(data.milestones)) {
        setChildName(data.childName ?? childName);
        setTokens(Math.max(0, data.tokens));
        setMilestones(data.milestones.map(m => ({ id: m.id ?? uid(), title: String(m.title ?? "Untitled"), required: Math.max(1, Number(m.required||1)), kind: m.kind === "negative"?"negative":"positive" })));
      }
    } catch {}
    e.target.value = "";
  };
  const clearAll = () => { if (confirm("Reset all data?")) { setTokens(0); setMilestones([]); setHistory([]);} };

  const totals = useMemo(() => ({
    count: milestones.length,
    achieved: milestones.filter(m => tokens >= m.required).length
  }), [milestones, tokens]);

  return (
    <div className="app">
      {/* Embedded styles for a kid‑friendly theme */}
      <style>{css}</style>

      <div className="container">
        <header className="header">
          <div className="titleRow">
            <KidAvatar />
            <div>
              <h1>Token Tracker</h1>
              <p>Colorful, simple & saved on this device.</p>
            </div>
          </div>
          <NameEditor value={childName} onChange={setChildName} />
        </header>

        <section className="grid">
          <div className="card tall">
            <div className="cardTitle">Tokens</div>
            <div className="tokensBig">{tokens}</div>
            <div className="btnGrid">
              {[1,5,10].map(n => (
                <button key={"p"+n} className="btn plus" onClick={()=>inc(n)}>
                  <span className="icon">＋</span> +{n}
                </button>
              ))}
              {[1,5,10].map(n => (
                <button key={"m"+n} className="btn minus" onClick={()=>inc(-n)}>
                  <span className="icon">−</span> −{n}
                </button>
              ))}
            </div>
            <div className="btnRow"><button className="btn ghost" onClick={undo}>Undo</button></div>
          </div>

          <div className="card tall center">
            <div className="cardTitle">Magic "I" Meter</div>
            <IMeter tokens={tokens} cap={cap} />
            <div className="meterLabel">Progress: {Math.floor(Math.min(1, tokens/cap)*100)}% (cap {cap})</div>
          </div>

          <div className="card">
            <div className="cardTitle">Data</div>
            <div className="dataButtons">
              <button className="btn ghost" onClick={exportData}>Export</button>
              <button className="btn ghost" onClick={()=>importRef.current?.click()}>Import</button>
              <button className="btn danger" onClick={clearAll}>Reset</button>
              <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
            </div>
            <div className="miniStats">Milestones: {totals.achieved}/{totals.count}</div>
          </div>
        </section>

        <MilestoneForm onAdd={(m) => addMilestone(m)} />
        <MilestoneRail milestones={milestones} tokens={tokens} cap={cap} />
        <MilestoneList milestones={milestones} tokens={tokens} onRemove={removeMilestone} onUpdate={updateMilestone} />
      </div>
    </div>
  );
}

function NameEditor({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(()=>setDraft(value), [value]);
  return (
    <div className="nameEdit">
      <span className="label">Child</span>
      {editing ? (
        <>
          <input className="input" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ onChange(draft.trim()||'Noah'); setEditing(false);} if(e.key==='Escape'){setEditing(false);} }} />
          <button className="btn" onClick={()=>{ onChange(draft.trim()||'Noah'); setEditing(false); }}>Save</button>
        </>
      ) : (
        <>
          <span className="name">{value}</span>
          <button className="btn" onClick={()=>setEditing(true)}>Edit</button>
        </>
      )}
    </div>
  );
}

function KidAvatar(){
  // Simple friendly SVG avatar
  return (
    <svg className="avatar" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="30" fill="#FFE082" stroke="#F57F17" strokeWidth="3"/>
      <circle cx="32" cy="28" r="14" fill="#FFF3E0"/>
      <circle cx="26" cy="27" r="2.5" fill="#333"/>
      <circle cx="38" cy="27" r="2.5" fill="#333"/>
      <path d="M24 34 Q32 39 40 34" stroke="#333" strokeWidth="2" fill="none"/>
      <path d="M18 20 Q32 8 46 20" fill="#6D4C41"/>
      <rect x="18" y="42" width="28" height="12" rx="6" fill="#90CAF9" stroke="#1E88E5" strokeWidth="2"/>
    </svg>
  );
}

function IMeter({ tokens, cap }){
  const ratio = Math.max(0, Math.min(1, tokens / (cap || 1)));
  const W = 180, H = 300;
  // Build an "I" from three rounded rects: top bar, stem, bottom bar
  const top = { x: 20, y: 10, w: 140, h: 40, r: 10 };
  const stem = { x: 60, y: 60, w: 60, h: 180, r: 12 };
  const bottom = { x: 20, y: 250, w: 140, h: 40, r: 10 };
  const totalHeight = (bottom.y + bottom.h) - top.y; // 280
  const fillHeight = totalHeight * ratio;
  const clipY = top.y + (totalHeight - fillHeight);

  const rectPath = (x,y,w,h,r)=>`M${x+r},${y} h${w-2*r} a${r},${r} 0 0 1 ${r},${r} v${h-2*r} a${r},${r} 0 0 1 -${r},${r} h-${w-2*r} a${r},${r} 0 0 1 -${r},-${r} v-${h-2*r} a${r},${r} 0 0 1 ${r},-${r} z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="imeter">
      <defs>
        <clipPath id="fillClip">
          <rect x="0" y={clipY} width={W} height={H} />
        </clipPath>
        <linearGradient id="grad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#81C784"/>
          <stop offset="100%" stopColor="#43A047"/>
        </linearGradient>
      </defs>

      {/* Outline */}
      <path d={rectPath(top.x, top.y, top.w, top.h, top.r)} fill="#FFF" stroke="#8D6E63" strokeWidth="3"/>
      <path d={rectPath(stem.x, stem.y, stem.w, stem.h, stem.r)} fill="#FFF" stroke="#8D6E63" strokeWidth="3"/>
      <path d={rectPath(bottom.x, bottom.y, bottom.w, bottom.h, bottom.r)} fill="#FFF" stroke="#8D6E63" strokeWidth="3"/>

      {/* Fill (clipped) */}
      <g clipPath="url(#fillClip)">
        <path d={rectPath(top.x, top.y, top.w, top.h, top.r)} fill="url(#grad)"/>
        <path d={rectPath(stem.x, stem.y, stem.w, stem.h, stem.r)} fill="url(#grad)"/>
        <path d={rectPath(bottom.x, bottom.y, bottom.w, bottom.h, bottom.r)} fill="url(#grad)"/>
      </g>

      {/* Bubbles for fun */}
      {Array.from({length:6}).map((_,i)=> (
        <circle key={i} cx={30 + i*22} cy={clipY - i*6} r={4} fill="#A5D6A7" opacity="0.6" />
      ))}
    </svg>
  );
}

function MilestoneRail({ milestones, tokens, cap }){
  const railMax = cap || 1;
  const sorted = [...milestones].sort((a,b)=>a.required-b.required);
  return (
    <div className="railCard">
      <div className="railTitle">Milestones</div>
      <div className="rail">
        <div className="railLine" />
        {/* current position */}
        <div className="current" style={{ left: `${Math.min(100, (tokens/railMax)*100)}%` }}>
          <span className="currentDot"/>
          <span className="currentLabel">{tokens}</span>
        </div>
        {/* markers */}
        {sorted.map(m => (
          <div key={m.id} className={`mark ${m.kind}`} style={{ left: `${Math.min(100, (m.required/railMax)*100)}%` }}>
            <span className="dot"/>
            <div className="tip">{m.title} <b>({m.required})</b></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MilestoneForm({ onAdd }){
  const [title, setTitle] = useState("");
  const [required, setRequired] = useState(10);
  const [kind, setKind] = useState("positive");
  return (
    <div className="card">
      <div className="cardTitle">Add Milestone</div>
      <div className="formGrid">
        <label className="label">Title
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g., Build LEGO Castle"/>
        </label>
        <label className="label">Tokens
          <input className="input" type="number" min={1} value={required} onChange={e=>setRequired(Math.max(1, Number(e.target.value)||1))}/>
        </label>
        <label className="label">Type
          <select className="input" value={kind} onChange={e=>setKind(e.target.value)}>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
          </select>
        </label>
        <div className="formActions">
          <button className="btn" onClick={()=>{ if(!title.trim()) return; onAdd({ id: uid(), title: title.trim(), required: Math.max(1, required), kind }); setTitle(""); setRequired(10); setKind("positive"); }}>Add</button>
        </div>
      </div>
    </div>
  );
}

function MilestoneList({ milestones, tokens, onRemove, onUpdate }){
  if (!milestones.length) return <div className="empty">No milestones yet — add one above 🌟</div>;
  return (
    <div className="list">
      {milestones.map(m => <MilestoneItem key={m.id} milestone={m} tokens={tokens} onRemove={onRemove} onUpdate={onUpdate}/>) }
    </div>
  );
}

function MilestoneItem({ milestone, tokens, onRemove, onUpdate }){
  const { id, title, required, kind } = milestone;
  const ratio = Math.min(1, tokens/(required||1));
  const achieved = ratio >= 1;
  return (
    <div className="milestone">
      <div className="row">
        <span className={`pill ${kind}`}>{kind === 'positive' ? 'Positive' : 'Negative'}</span>
        <div className="title">{title}</div>
        <div className="req">Needs <b>{required}</b></div>
      </div>
      <div className="bar">
        <div className="fill" style={{ width: `${ratio*100}%` }} />
      </div>
      {achieved && <div className="yay">Achieved! 🎉</div>}
      <div className="actions">
        <button className="btn ghost" onClick={()=>onRemove(id)}>Delete</button>
        <InlineEdit label="Rename" initial={title} onSave={v=>onUpdate(id,{title:v})}/>
        <InlineNumberEdit label="Edit Tokens" initial={required} min={1} onSave={v=>onUpdate(id,{required:v})}/>
        <select className="btn select" value={kind} onChange={e=>onUpdate(id, { kind: e.target.value })}>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
        </select>
      </div>
    </div>
  );
}

function InlineEdit({ label, initial, onSave }){
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  useEffect(()=>setDraft(initial),[initial]);
  return editing ? (
    <span className="inlineEdit">
      <input className="input sm" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter'){ onSave(draft.trim()||initial); setEditing(false);} if(e.key==='Escape'){ setEditing(false);} }} />
      <button className="btn mini" onClick={()=>{ onSave(draft.trim()||initial); setEditing(false); }}>Save</button>
    </span>
  ) : (
    <button className="btn ghost" onClick={()=>setEditing(true)}>{label}</button>
  );
}

function InlineNumberEdit({ label, initial, min=0, onSave }){
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  useEffect(()=>setDraft(initial),[initial]);
  return editing ? (
    <span className="inlineEdit">
      <input className="input sm" type="number" value={draft} min={min} onChange={e=>setDraft(Math.max(min, Number(e.target.value)||min))} onKeyDown={(e)=>{ if(e.key==='Enter'){ onSave(draft); setEditing(false);} if(e.key==='Escape'){ setEditing(false);} }} />
      <button className="btn mini" onClick={()=>{ onSave(draft); setEditing(false); }}>Save</button>
    </span>
  ) : (
    <button className="btn ghost" onClick={()=>setEditing(true)}>{label}</button>
  );
}

// KID-FRIENDLY CSS (embedded)
const css = `
:root{
  --bg:#FDFCF8; --card:#FFFFFF; --ink:#222; --muted:#667085;
  --brand:#7C4DFF; --brand-2:#FF6F61; --brand-3:#43A047; --brand-4:#29B6F6; --rail:#E0E7FF;
  --plus:#4CAF50; --minus:#EF5350; --warn:#EF5350;
  --radius:18px; --shadow:0 6px 20px rgba(0,0,0,0.08);
}
*{box-sizing:border-box}
body{margin:0;font-family: ui-rounded, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans", "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"; background:var(--bg); color:var(--ink)}
.app{min-height:100vh}
.container{max-width:1100px;margin:0 auto;padding:20px}
.header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
.titleRow{display:flex;align-items:center;gap:12px}
.header h1{font-size:28px;margin:0}
.header p{margin:4px 0 0;color:var(--muted)}
.avatar{width:64px;height:64px;flex:0 0 auto}

.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
@media (max-width:900px){.grid{grid-template-columns:1fr 1fr}}
@media (max-width:640px){.grid{grid-template-columns:1fr}}

.card{background:var(--card); border-radius:var(--radius); box-shadow:var(--shadow); padding:16px}
.card.tall{display:flex;flex-direction:column;justify-content:space-between}
.card.center{align-items:center;text-align:center}
.cardTitle{font-weight:700;margin-bottom:8px;color:#475467}

.tokensBig{font-size:56px;font-weight:900; letter-spacing:-1px}
.btnGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.btnRow{margin-top:8px}
.btn{appearance:none;border:0;border-radius:14px;padding:10px 14px;background:var(--brand-4);color:white;font-weight:700;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.08)}
.btn:hover{filter:brightness(.97)}
.btn:active{transform:translateY(1px)}
.btn.plus{background:var(--plus)}
.btn.minus{background:var(--minus)}
.btn.ghost{background:#F1F5FF;color:#344054}
.btn.danger{background:#FFECEF;color:#B42318}
.btn.select{padding:8px 10px}
.btn.mini{padding:6px 10px}
.icon{font-size:18px;margin-right:6px}

.nameEdit{display:flex;align-items:center;gap:8px}
.nameEdit .label{color:#475467;font-size:14px}
.nameEdit .name{font-weight:800}
.input{border:2px solid #E6E8F0; border-radius:12px; padding:10px 12px; font-size:14px; width:100%}
.input:focus{outline:3px solid #E0EAFF;border-color:#B2CCFF}
.input.sm{width:160px}
.hidden{display:none}

.dataButtons{display:flex;flex-wrap:wrap;gap:8px}
.miniStats{margin-top:8px;color:#475467;font-size:14px}

.imeter{margin-top:6px; filter: drop-shadow(0 6px 16px rgba(0,0,0,.06));}
.meterLabel{margin-top:8px;color:#475467;font-size:14px}

.railCard{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);padding:16px;margin-top:14px}
.railTitle{font-weight:800;margin-bottom:8px}
.rail{position:relative;height:64px}
.railLine{position:absolute;left:0;right:0;top:30px;height:8px;background:linear-gradient(90deg,#FEE2E2,#E9D5FF,#DBEAFE,#D1FAE5);border-radius:999px}
.current{position:absolute;top:0;transform:translateX(-50%)}
.currentDot{display:block;width:18px;height:18px;background:#111;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.currentLabel{position:absolute;top:22px;left:50%;transform:translateX(-50%);font-size:12px;color:#111}
.mark{position:absolute;top:0;transform:translateX(-50%)}
.mark .dot{width:14px;height:14px;border-radius:50%;display:block;box-shadow:0 2px 4px rgba(0,0,0,.15);border:2px solid #fff}
.mark .tip{position:absolute;top:22px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#fff;border:1px solid #E5E7EB;border-radius:999px;padding:4px 8px;font-size:12px;box-shadow:var(--shadow)}
.mark.positive .dot{background:#34D399}
.mark.negative .dot{background:#FB7185}

.list{display:grid;gap:12px;margin-top:12px}
.milestone{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);padding:14px}
.milestone .row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.pill{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:800}
.pill.positive{background:#E8FAF1;color:#0F5132}
.pill.negative{background:#FFE9EB;color:#842029}
.title{font-weight:800;flex:1;min-width:180px}
.req{color:#475467}
.bar{height:8px;background:#EEF2FF;border-radius:999px;margin:8px 0;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,#7C4DFF,#29B6F6)}
.yay{color:#16A34A;font-weight:700}
.actions{display:flex;flex-wrap:wrap;gap:8px}

.empty{margin:12px 0;color:#64748B;text-align:center}
`;