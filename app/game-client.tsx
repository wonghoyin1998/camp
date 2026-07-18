"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AFTERNOON_TASKS,
  C5_SETTLEMENT_PER_RESOURCE,
  LUNCH_CONTRACTS,
  PROPERTY_CHALLENGE_RULE,
  PROJECTS,
  PROPERTIES,
  PUBLIC_TASKS,
  RESOURCE_KEYS,
  RESOURCES,
  ROUTE_ZONE_ORDER,
  STATIONS,
  TEAMS,
  WARMUPS,
  type PropertyDefinition,
  type PublicTaskDefinition,
  type ResourceKey,
  type TeamId,
  type TaskDefinition,
} from "../lib/game-data";
import type { GamePhase, GameState, LunchContractClaim, Trade, TradeSide } from "../lib/game-state";
import { hasTaskTool, TaskTool } from "./task-tools";

type Auth =
  | { role: "team"; teamId: TeamId; pin: string }
  | { role: "gm"; pin: string };

type ActionFn = (action: string, payload?: Record<string, unknown>) => Promise<boolean>;

const PHASES: Array<{ id: GamePhase; name: string; time: string }> = [
  { id: "warmup", name: "熱身建隊", time: "10:00" },
  { id: "morning", name: "太和佔領戰", time: "11:00" },
  { id: "lunch", name: "午膳合約", time: "12:15" },
  { id: "route", name: "航線開拓", time: "13:00" },
  { id: "final", name: "出航結算", time: "15:00" },
];

function phaseName(phase: GamePhase) {
  return PHASES.find((item) => item.id === phase)?.name ?? phase;
}

function displayTeamName(state: GameState, teamId: TeamId) {
  return state.teams[teamId]?.name ?? TEAMS[teamId].name;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-HK", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }).format(new Date(value));
}

function formatChallengeTime(milliseconds?: number) {
  if (milliseconds === undefined) return "—";
  const totalTenths = Math.max(0, Math.round(milliseconds / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function taskLocation(stationIndex: number) {
  const station = STATIONS[stationIndex];
  return station.venue === "港鐵閘內" ? `${station.name}站・${station.venue}` : `${station.name}・${station.venue}`;
}

function countAssets(side: TradeSide) {
  return side.cash + RESOURCE_KEYS.reduce((sum, key) => sum + side.resources[key], 0) + (side.propertyId ? 1 : 0);
}

function describeSide(side: TradeSide) {
  const items: string[] = [];
  if (side.cash) items.push(`$${side.cash}`);
  for (const key of RESOURCE_KEYS) if (side.resources[key]) items.push(`${RESOURCES[key].name}×${side.resources[key]}`);
  if (side.propertyId) items.push(`業權 ${side.propertyId}`);
  return items.join("＋") || "—";
}

function describeResources(resources: Partial<Record<ResourceKey, number>>) {
  return RESOURCE_KEYS.filter((key) => resources[key]).map((key) => `${RESOURCES[key].name}×${resources[key]}`).join("＋") || "—";
}

function describeTaskReward(task: TaskDefinition) {
  const items: string[] = [];
  if (task.reward.resources) {
    for (const key of RESOURCE_KEYS) if (task.reward.resources[key]) items.push(`${RESOURCES[key].name}×${task.reward.resources[key]}`);
  }
  if (task.reward.cash) items.push(`$${task.reward.cash}`);
  if (task.reward.note) items.push("特殊效果");
  return items.join("＋") || "特殊效果";
}

const RESERVED_TASK_SLOT_STATUSES: GameState["taskRuns"][number]["status"][] = ["started", "submitted", "completed"];

function taskCapacityInfo(state: GameState, task: TaskDefinition, teamId?: TeamId) {
  if (!task.capacity) return null;
  const used = state.taskRuns.filter(
    (run) => run.taskId === task.id && RESERVED_TASK_SLOT_STATUSES.includes(run.status),
  ).length;
  const ownRun = teamId
    ? [...state.taskRuns].reverse().find((run) => run.taskId === task.id && run.teamId === teamId)
    : undefined;
  const ownsSlot = Boolean(ownRun && RESERVED_TASK_SLOT_STATUSES.includes(ownRun.status));
  const remaining = Math.max(0, task.capacity - used);
  return {
    limit: task.capacity,
    used,
    remaining,
    ownsSlot,
    soldOut: remaining === 0 && !ownsSlot,
    label: ownsSlot
      ? `限量 ${task.capacity} 隊・你隊已鎖定`
      : remaining > 0
        ? `限量 ${task.capacity} 隊・剩 ${remaining} 個`
        : `限量 ${task.capacity} 隊・名額已滿`,
  };
}

function findTeamResolution(previous: GameState, current: GameState, teamId: TeamId) {
  for (const challenge of current.challenges.filter((item) => item.teamId === teamId && item.status !== "pending")) {
    const before = previous.challenges.find((item) => item.id === challenge.id);
    if (before?.status === "pending") return { tone: challenge.status === "won" ? "good" : "bad", text: challenge.status === "won" ? `GM 已確認你隊佔領 ${challenge.propertyId}` : `GM 判定 ${challenge.propertyId} 挑戰未成功` } as const;
  }
  for (const claim of (current.publicTaskClaims ?? []).filter((item) => item.teamId === teamId && ["completed", "rejected"].includes(item.status))) {
    const before = (previous.publicTaskClaims ?? []).find((item) => item.id === claim.id);
    if (before?.status === "pending") return { tone: claim.status === "completed" ? "good" : "bad", text: claim.status === "completed" ? `GM 已確認公共任務 ${claim.taskId}，資源已入帳` : `GM 退回公共任務 ${claim.taskId}，可以再試` } as const;
  }
  for (const claim of (current.lunchContractClaims ?? []).filter((item) => item.teamId === teamId)) {
    const before = (previous.lunchContractClaims ?? []).find((item) => item.id === claim.id);
    if (before?.status === "submitted" && claim.status !== "submitted") return { tone: claim.status === "completed" ? "good" : "bad", text: claim.status === "completed" ? `GM 已收取 ${claim.contractId} 午餐交貨，款項已入帳` : `GM 退回 ${claim.contractId} 交貨，請補貨再交` } as const;
  }
  for (const run of current.taskRuns.filter((item) => item.teamId === teamId)) {
    const before = previous.taskRuns.find((item) => item.id === run.id);
    if (before?.status === "submitted" && run.status !== "submitted") {
      const task = AFTERNOON_TASKS.find((item) => item.id === run.taskId);
      const completedText = run.taskId === "C5"
        ? `GM 已確認 C5「三隊拼船單」；早前扣起的資源合共 $${run.jointSettlementValue ?? 0} 將於遊戲結束時結算`
        : `GM 已確認 ${run.taskId}「${task?.title ?? "任務"}」，獎勵已入帳`;
      const rejectedText = run.taskId === "C5"
        ? "GM 退回 C5，扣起資源已退回隊伍庫存，可以重新提交"
        : run.status === "started"
          ? `GM 退回 ${run.taskId}，並已使用重試機會`
          : `GM 退回 ${run.taskId}，可以重新挑戰`;
      return { tone: run.status === "completed" ? "good" : "bad", text: run.status === "completed" ? completedText : rejectedText } as const;
    }
  }
  if (previous.tasksOpen && !current.tasksOpen && current.phase === "route") return { tone: "bad", text: "GM 已停止下午任務；未提交挑戰不能再交" } as const;
  return null;
}

export default function GameClient() {
  const [state, setState] = useState<GameState | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "good" | "bad"; gm?: boolean } | null>(null);
  const observedState = useRef<GameState | null>(null);

  const fetchState = useCallback(async (quiet = false) => {
    try {
      const response = await fetch("/api/game", { cache: "no-store" });
      const data = (await response.json()) as { state?: GameState; error?: string };
      if (!response.ok || !data.state) throw new Error(data.error ?? "連線失敗");
      setState(data.state);
    } catch (error) {
      if (!quiet) setToast({ text: error instanceof Error ? error.message : "連線失敗", tone: "bad" });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchState(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchState]);

  useEffect(() => {
    if (!auth) return;
    const timer = window.setInterval(() => void fetchState(true), 4500);
    return () => window.clearInterval(timer);
  }, [auth, fetchState]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.gm ? 7200 : 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const previous = observedState.current;
    observedState.current = state;
    if (!previous || !state || !auth || auth.role !== "team") return;
    const resolution = findTeamResolution(previous, state, auth.teamId);
    if (!resolution) return;
    setToast({ ...resolution, text: `GM 通知｜${resolution.text}`, gm: true });
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([180, 90, 180]);
  }, [state, auth]);

  const login = async (nextAuth: Auth) => {
    setBusy(true);
    try {
      const payload = nextAuth.role === "gm" ? { role: "gm" } : { role: "team", teamId: nextAuth.teamId };
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auth", pin: nextAuth.pin, payload }),
      });
      const data = (await response.json()) as { state?: GameState; error?: string };
      if (!response.ok || !data.state) throw new Error(data.error ?? "登入失敗");
      setState(data.state);
      setAuth(nextAuth);
      setToast({ text: "已連接遊戲房間", tone: "good" });
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : "登入失敗", tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  const act: ActionFn = useCallback(async (action, payload = {}) => {
    if (!auth) return false;
    setBusy(true);
    try {
      const actorPayload = auth.role === "team" ? { ...payload, teamId: auth.teamId } : payload;
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, pin: auth.pin, payload: actorPayload }),
      });
      const data = (await response.json()) as { state?: GameState; error?: string };
      if (!response.ok || !data.state) throw new Error(data.error ?? "操作失敗");
      setState(data.state);
      if (action !== "sendChatMessage") setToast({ text: "操作完成", tone: "good" });
      return true;
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : "操作失敗", tone: "bad" });
      return false;
    } finally {
      setBusy(false);
    }
  }, [auth]);

  if (loading || !state) {
    return <div className="loading-screen"><span className="loader" />正在連接指揮中心…</div>;
  }

  return (
    <>
      {!auth ? (
        <LoginScreen state={state} busy={busy} onLogin={login} />
      ) : auth.role === "gm" ? (
        <GMDashboard state={state} busy={busy} act={act} gmPin={auth.pin} onLogout={() => setAuth(null)} />
      ) : (
        <TeamDashboard state={state} teamId={auth.teamId} busy={busy} act={act} onLogout={() => setAuth(null)} />
      )}
      {toast && <div className={`toast ${toast.tone} ${toast.gm ? "gm-alert" : ""}`} role="status" aria-live="assertive">{toast.tone === "good" ? "✓" : "!"} {toast.text}</div>}
    </>
  );
}

function LoginScreen({ state, busy, onLogin }: { state: GameState; busy: boolean; onLogin: (auth: Auth) => void }) {
  const [role, setRole] = useState<"team" | "gm">("team");
  const [teamId, setTeamId] = useState<TeamId>("red");
  const [pin, setPin] = useState("");

  return (
    <main className="login-screen">
      <div className="login-grid" aria-hidden="true" />
      <section className="login-brand">
        <div className="academy-mark"><span>BG</span><i>導師局</i></div>
        <p className="eyebrow">BOARD GAME FACILITATOR FIELD LAB</p>
        <h1>棋航者<span>最後登船令</span></h1>
        <p className="login-lede">唔係做題目拎分。你要讀局、談判、管理資源，帶隊由太和推進到中環。</p>
        <div className="route-ribbon">
          {STATIONS.filter((_, index) => [0, 4, 5, 12, 13, 17].includes(index)).map((station, index, list) => (
            <div className="route-stop" key={station.id}><b>{station.name}</b>{index < list.length - 1 && <span />}</div>
          ))}
        </div>
        <div className="mission-specs">
          <span><b>3</b> 隊</span><span><b>18</b> 個路線任務</span><span><b>14:45</b> 截止</span><span><b>15:30</b> 開船</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="live-pill"><span /> LIVE ROOM・{state.roomCode}</div>
        <h2>進入任務台</h2>
        <p>{state.camp}</p>
        <div className="role-switch">
          <button className={role === "team" ? "active" : ""} onClick={() => { setRole("team"); setPin(""); }}>玩家隊伍</button>
          <button className={role === "gm" ? "active" : ""} onClick={() => { setRole("gm"); setPin(""); }}>GM 控場</button>
        </div>
        {role === "team" && (
          <div className="team-picker">
            {(Object.keys(TEAMS) as TeamId[]).map((id) => (
              <button key={id} className={teamId === id ? "selected" : ""} style={{ "--team": TEAMS[id].color } as React.CSSProperties} onClick={() => setTeamId(id)}>
                <span className="team-flag">⚑</span>{displayTeamName(state, id)}
              </button>
            ))}
          </div>
        )}
        <label className="input-label">
          {role === "gm" ? "GM 控場碼" : `${displayTeamName(state, teamId)}登入碼`}
          <input inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value.slice(0, 6))} placeholder="輸入 4 位數字" onKeyDown={(event) => { if (event.key === "Enter" && pin) void onLogin(role === "gm" ? { role, pin } : { role, teamId, pin }); }} />
        </label>
        <button className="primary-button login-button" disabled={!pin || busy} onClick={() => void onLogin(role === "gm" ? { role, pin } : { role, teamId, pin })}>
          {busy ? "連接中…" : "進入指揮中心 →"}
        </button>
        <p className="login-code-note">登入碼由 GM 現場派發</p>
      </section>
    </main>
  );
}

const TEAM_NAV = [
  { id: "map", label: "地圖", icon: "◫" },
  { id: "tasks", label: "任務", icon: "☑" },
  { id: "market", label: "市場", icon: "▾" },
  { id: "trades", label: "交易", icon: "⇄" },
  { id: "projects", label: "項目", icon: "▣" },
  { id: "chat", label: "聊天室", icon: "✉" },
] as const;

function TeamDashboard({ state, teamId, busy, act, onLogout }: { state: GameState; teamId: TeamId; busy: boolean; act: ActionFn; onLogout: () => void }) {
  const [view, setView] = useState<(typeof TEAM_NAV)[number]["id"]>("map");
  const [selectedTask, setSelectedTask] = useState<TaskDefinition | null>(null);
  const [editingName, setEditingName] = useState(false);
  const chatMessages = state.chatMessages ?? [];
  const latestChatId = chatMessages[chatMessages.length - 1]?.id ?? "";
  const [lastReadChatId, setLastReadChatId] = useState(latestChatId);
  const lastReadChatIndex = chatMessages.findIndex((message) => message.id === lastReadChatId);
  const unreadChatCount = view === "chat" ? 0 : chatMessages
    .slice(lastReadChatIndex >= 0 ? lastReadChatIndex + 1 : 0)
    .filter((message) => message.senderRole === "gm" || message.senderTeamId !== teamId)
    .length;
  const team = state.teams[teamId];
  const selectView = (nextView: (typeof TEAM_NAV)[number]["id"]) => {
    if (view === "chat" || nextView === "chat") setLastReadChatId(latestChatId);
    setView(nextView);
  };

  return (
    <main className="app-shell" style={{ "--team": TEAMS[teamId].color } as React.CSSProperties}>
      <aside className="sidebar">
        <div className="side-brand"><span className="train-mark">➤</span><b>棋航者</b><small>最後登船令</small></div>
        <nav>
          {TEAM_NAV.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => selectView(item.id)}><span>{item.icon}</span>{item.label}{item.id === "chat" && unreadChatCount > 0 && <i>{Math.min(unreadChatCount, 99)}</i>}</button>)}
        </nav>
        <div className="one-way-note"><b>⟳ 跨區鎖定</b><span>同區可回頭；進入下一區後不可返回上一區</span></div>
        <button className="logout-link" onClick={onLogout}>切換登入</button>
      </aside>

      <header className="topbar">
        <div className="room-chip"><span>♟</span> 房間 <b>{state.roomCode}</b></div>
        <div className="live-pill compact"><span /> LIVE</div>
        <button className="top-team team-name-button" style={{ color: TEAMS[teamId].color }} onClick={() => setEditingName(true)} aria-label={`修改組名，目前是 ${team.name}`}>⚑ {team.name}<span>✎</span></button>
        <div className="cash-chip">▰ <b>${team.cash}</b></div>
      </header>

      <section className="app-content">
        {view === "map" && <PhaseMap state={state} teamId={teamId} busy={busy} act={act} onTask={setSelectedTask} />}
        {view === "tasks" && <TasksView state={state} teamId={teamId} onTask={setSelectedTask} />}
        {view === "market" && <MarketView state={state} teamId={teamId} busy={busy} act={act} />}
        {view === "trades" && <TradesView state={state} teamId={teamId} busy={busy} act={act} />}
        {view === "projects" && <ProjectsView state={state} teamId={teamId} busy={busy} act={act} />}
        {view === "chat" && <ChatRoom state={state} actor={{ role: "team", teamId }} busy={busy} act={act} />}
      </section>

      <nav className="mobile-nav">
        {TEAM_NAV.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => selectView(item.id)}><span>{item.icon}</span>{item.label}{item.id === "chat" && unreadChatCount > 0 && <i>{Math.min(unreadChatCount, 99)}</i>}</button>)}
      </nav>

      {selectedTask && <TaskModal task={selectedTask} state={state} teamId={teamId} busy={busy} act={act} onClose={() => setSelectedTask(null)} />}
      {editingName && <TeamNameEditor state={state} teamId={teamId} busy={busy} act={act} onClose={() => setEditingName(false)} />}
    </main>
  );
}

function TeamNameEditor({ state, teamId, busy, act, onClose }: { state: GameState; teamId: TeamId; busy: boolean; act: ActionFn; onClose: () => void }) {
  const currentName = state.teams[teamId].name;
  const [name, setName] = useState(currentName);
  const trimmedName = name.trim().replace(/\s+/g, " ");
  const length = Array.from(trimmedName).length;
  const save = async () => {
    const ok = await act("renameTeam", { name: trimmedName });
    if (ok) onClose();
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="team-name-editor" role="dialog" aria-modal="true" aria-labelledby="team-name-title">
      <button className="modal-close" onClick={onClose} aria-label="關閉">×</button>
      <span className="team-name-flag" style={{ color: TEAMS[teamId].color }}>⚑</span>
      <div><small>TEAM IDENTITY</small><h1 id="team-name-title">修改組名</h1><p>只會改顯示名稱；隊色及登入碼保持不變。</p></div>
      <label>新組名<input autoFocus value={name} onChange={(event) => setName(Array.from(event.target.value).slice(0, 12).join(""))} onKeyDown={(event) => { if (event.key === "Enter" && length > 0 && trimmedName !== currentName && !busy) void save(); }} placeholder="輸入 1–12 個字" /></label>
      <div className="team-name-actions"><span>{length}/12</span><button onClick={onClose}>取消</button><button className="save" disabled={busy || length < 1 || length > 12 || trimmedName === currentName} onClick={() => void save()}>{busy ? "儲存中…" : "確認改名"}</button></div>
    </section>
  </div>;
}

function ChatRoom({ state, actor, busy, act }: {
  state: GameState;
  actor: { role: "gm" } | { role: "team"; teamId: TeamId };
  busy: boolean;
  act: ActionFn;
}) {
  const [draft, setDraft] = useState("");
  const streamRef = useRef<HTMLDivElement>(null);
  const messages = state.chatMessages ?? [];
  const latestMessageId = messages[messages.length - 1]?.id ?? "";
  const draftLength = Array.from(draft).length;

  useEffect(() => {
    const stream = streamRef.current;
    if (stream) stream.scrollTop = stream.scrollHeight;
  }, [latestMessageId]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const ok = await act("sendChatMessage", { text });
    if (ok) setDraft("");
  };

  return <div className="content-stack chat-view">
    <PageTitle eyebrow="PUBLIC CHANNEL" title="全場聊天室" text="紅、藍、金三隊同 GM 共用；所有登入參加者都會見到訊息。" action={<div className="live-pill"><span /> 全場同步</div>} />
    <section className="chat-panel">
      <header className="chat-channel-header"><div><b># 全部組＆GM</b><small>公開頻道・最多保留最近 200 則訊息</small></div><span>{messages.length} 則</span></header>
      <div className="chat-stream" ref={streamRef} role="log" aria-live="polite" aria-label="全場聊天訊息">
        {messages.length === 0 && <div className="chat-empty"><span>✉</span><b>未有訊息</b><small>可以先向全部隊伍同 GM 打個招呼。</small></div>}
        {messages.map((message) => {
          const senderTeamId = message.senderTeamId;
          const senderName = message.senderRole === "gm"
            ? "GM"
            : senderTeamId
              ? displayTeamName(state, senderTeamId)
              : "隊伍";
          const senderColor = message.senderRole === "gm"
            ? "var(--cyan)"
            : senderTeamId
              ? TEAMS[senderTeamId].color
              : "var(--muted)";
          const own = message.senderRole === actor.role &&
            (actor.role === "gm" || message.senderTeamId === actor.teamId);
          return <article className={`chat-message ${own ? "own" : ""} ${message.senderRole}`} style={{ "--chat-color": senderColor } as React.CSSProperties} key={message.id}>
            <div className="chat-message-meta"><b>{message.senderRole === "gm" ? "◆" : "⚑"} {senderName}</b><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div>
            <p>{message.text}</p>
          </article>;
        })}
      </div>
      <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <label>
          <span className="sr-only">輸入公開訊息</span>
          <textarea rows={2} value={draft} onChange={(event) => setDraft(Array.from(event.target.value).slice(0, 280).join(""))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder="輸入訊息俾全部組同 GM…（Enter 發送）" />
        </label>
        <div><small>{draftLength}/280</small><button type="submit" disabled={busy || !draft.trim()}>{busy ? "發送中…" : "發送"}</button></div>
      </form>
    </section>
  </div>;
}

function ResourceStrip({ state, teamId }: { state: GameState; teamId: TeamId }) {
  const team = state.teams[teamId];
  return (
    <div className="resource-strip">
      {RESOURCE_KEYS.map((key) => (
        <div className={`resource-card ${key}`} key={key} style={{ "--resource": RESOURCES[key].color } as React.CSSProperties}>
          <span className="resource-icon">{RESOURCES[key].icon}</span>
          <div><small>{RESOURCES[key].name}</small><b>{team.resources[key]}</b></div>
        </div>
      ))}
    </div>
  );
}

function PhaseMap({ state, teamId, busy, act, onTask }: { state: GameState; teamId: TeamId; busy: boolean; act: ActionFn; onTask: (task: TaskDefinition) => void }) {
  if (state.phase === "warmup") return <WarmupView />;
  if (state.phase === "morning") return <PropertyView state={state} teamId={teamId} busy={busy} act={act} />;
  if (state.phase === "lunch") return <LunchView state={state} teamId={teamId} busy={busy} act={act} />;
  return <RouteView state={state} teamId={teamId} busy={busy} act={act} onTask={onTask} />;
}

function WarmupView() {
  return (
    <div className="content-stack">
      <PageTitle eyebrow="10:00–11:00・太和" title="導師團隊校準" text="三個短局由建立共同訊號開始，最後用系統完成第一宗市場操作。" />
      <div className="card-grid three">
        {WARMUPS.map((item, index) => <article className="mission-card" key={item.id}><span className="card-code">{item.id}</span><span className="card-index">0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p><div className="status-line">建議 {index === 0 ? 15 : index === 1 ? 25 : 12} 分鐘</div></article>)}
      </div>
      <section className="training-note"><b>導師觀察點</b><p>留意團隊如何建立規則、處理不同意見，以及在時間壓力下修正方法。遊戲後 GM 會用 8 分鐘 debrief。</p></section>
    </div>
  );
}

function PageTitle({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <header className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>{action}</header>;
}

function PropertyView({ state, teamId, busy, act }: { state: GameState; teamId: TeamId; busy: boolean; act: ActionFn }) {
  const [resourceByProperty, setResourceByProperty] = useState<Record<string, ResourceKey>>({});
  const [abandonByProperty, setAbandonByProperty] = useState<Record<string, string>>({});
  const [selectedPublicTask, setSelectedPublicTask] = useState<PublicTaskDefinition | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<PropertyDefinition | null>(null);
  const owned = state.properties.filter((item) => item.owner === teamId);
  const pending = state.challenges.find((item) => item.teamId === teamId && item.status === "pending");
  const publicClaims = state.publicTaskClaims ?? [];
  const propertyAttempts = state.propertyAttempts ?? [];
  const myActivePublic = publicClaims.find((item) => item.teamId === teamId && ["started", "pending"].includes(item.status));

  return (
    <div className="content-stack">
      <PageTitle eyebrow="11:00–12:15・太和" title="生產點佔領戰" text="先查看 P1–P6 玩法並到現場完成實體挑戰，再選擇該點生產的資源。每隊最多持有 2 個業權。" action={<div className="rule-chip">第 {state.productionTick} 輪生產</div>} />
      <ResourceStrip state={state} teamId={teamId} />
      <div className="rule-banner record-rule"><b>⏱ 破紀錄先成功</b><span>{PROPERTY_CHALLENGE_RULE} 開始前先向工作員確認現場最快時間。</span></div>
      <div className="rule-banner"><b>持有上限規則</b><span>已有 2 個仍可挑戰；挑戰前指定一個現有業權，只有勝出先放棄。每種資源最多同時 3 個生產點。</span></div>
      {pending && <div className="pending-banner">⌛ 你隊正挑戰 {pending.propertyId}，等待 GM 裁決；期間不可出售預先指定放棄的業權。</div>}
      <div className="property-grid">
        {state.properties.map((property) => {
          const definition = PROPERTIES.find((item) => item.id === property.id);
          const owner = property.owner ? TEAMS[property.owner] : null;
          const ownerName = property.owner ? displayTeamName(state, property.owner) : null;
          const chosen = resourceByProperty[property.id] ?? property.resource ?? "energy";
          const successfulTimes = propertyAttempts.filter((attempt) => attempt.propertyId === property.id && attempt.status === "completed" && attempt.success && attempt.elapsedMs).map((attempt) => attempt.elapsedMs as number);
          const bestTime = successfulTimes.length > 0 ? Math.min(...successfulTimes) : undefined;
          const readyAttempt = [...propertyAttempts].reverse().find((attempt) => attempt.propertyId === property.id && attempt.teamId === teamId && attempt.status === "completed" && attempt.success && !attempt.claimedAt);
          const canChallenge = property.owner !== teamId && !pending && Boolean(readyAttempt);
          return (
            <article className={`property-card ${property.owner === teamId ? "mine" : ""}`} key={property.id} style={{ "--owner": owner?.color ?? "#5d7890" } as React.CSSProperties}>
              <div className="property-head"><span className="card-code">{property.id}</span><span className={`owner-badge ${owner ? "owned" : ""}`}>{ownerName ?? "中立"}</span></div>
              <h3>{property.title}</h3><p>{definition?.game ?? property.game}</p>
              {definition && <button className="property-rules-button" onClick={() => setSelectedProperty(definition)}>查看玩法及物資</button>}
              <div className="property-time-to-beat"><small>TIME TO BEAT</small><b>{bestTime === undefined ? "首隊完成即可" : formatChallengeTime(bestTime)}</b>{readyAttempt && <span>✓ 你隊已取得挑戰資格</span>}</div>
              <div className="production-status">
                {property.resource ? <><span style={{ color: RESOURCES[property.resource].color }}>{RESOURCES[property.resource].icon}</span><b>生產 {RESOURCES[property.resource].name}</b>{property.skipNext && <small>下輪停產</small>}</> : <span className="muted">尚未設定生產</span>}
              </div>
              <label className="mini-select">目標資源<select value={chosen} onChange={(event) => setResourceByProperty({ ...resourceByProperty, [property.id]: event.target.value as ResourceKey })}>{RESOURCE_KEYS.map((key) => <option key={key} value={key}>{RESOURCES[key].name}</option>)}</select></label>
              {property.owner === teamId ? (
                <button className="secondary-button" disabled={busy || property.resource === chosen} onClick={() => void act("retool", { propertyId: property.id, resource: chosen })}>轉產{property.id === "P3" ? "（免費）" : "（$2）"}</button>
              ) : (
                <>
                  {owned.length >= 2 && <label className="mini-select danger">勝出後放棄<select value={abandonByProperty[property.id] ?? ""} onChange={(event) => setAbandonByProperty({ ...abandonByProperty, [property.id]: event.target.value })}><option value="">必須預先指定</option>{owned.map((item) => <option key={item.id} value={item.id}>{item.id} {item.title}</option>)}</select></label>}
                  <button className="primary-button small" disabled={busy || !canChallenge || (owned.length >= 2 && !abandonByProperty[property.id])} onClick={() => void act("requestChallenge", { propertyId: property.id, resource: chosen, abandonPropertyId: abandonByProperty[property.id] })}>{readyAttempt ? "提交佔領申請" : "先完成計時挑戰"}</button>
                </>
              )}
            </article>
          );
        })}
      </div>
      <section>
        <div className="section-heading"><div><span>每隊獨立</span><h2>太和公共任務</h2></div><small>每組每項最多完成一次・不佔業權</small></div>
        <div className="compact-grid">{PUBLIC_TASKS.map((task) => {
          const claim = [...publicClaims].reverse().find((item) => item.taskId === task.id && item.teamId === teamId && item.status !== "rejected");
          const completedCount = publicClaims.filter((item) => item.taskId === task.id && item.status === "completed").length;
          const rejected = publicClaims.some((item) => item.taskId === task.id && item.teamId === teamId && item.status === "rejected");
          const status = claim?.status === "completed" ? "你隊已完成" : claim?.status === "pending" ? "等待 GM 確認" : claim?.status === "started" ? "返回本隊題目" : rejected ? "睇玩法・再試" : "睇玩法";
          return <article className={`compact-task public-task ${claim?.status ?? "available"}`} key={task.id}>
            <span>{task.id}</span><div><b>{task.title}</b><p>{task.summary}</p><strong style={{ color: RESOURCES[task.reward].color }}>{RESOURCES[task.reward].icon} 一次性生產{RESOURCES[task.reward].name} ×1・{completedCount}/3 隊完成</strong></div>
            <button disabled={busy || claim?.status === "completed"} onClick={() => setSelectedPublicTask(task)}>{status}</button>
          </article>;
        })}</div>
      </section>
      {selectedProperty && <PropertyRulesModal property={selectedProperty} state={state} teamId={teamId} busy={busy} act={act} onClose={() => setSelectedProperty(null)} />}
      {selectedPublicTask && <PublicTaskModal key={selectedPublicTask.id} task={selectedPublicTask} state={state} teamId={teamId} busy={busy} act={act} blockedBy={myActivePublic?.taskId !== selectedPublicTask.id ? myActivePublic?.taskId : undefined} onClose={() => setSelectedPublicTask(null)} />}
    </div>
  );
}

function PropertyRulesModal({ property, state, teamId, busy, act, onClose }: {
  property: PropertyDefinition;
  state: GameState;
  teamId: TeamId;
  busy: boolean;
  act: ActionFn;
  onClose: () => void;
}) {
  const attempts = state.propertyAttempts ?? [];
  const propertyAttempts = attempts.filter((attempt) => attempt.propertyId === property.id);
  const successfulTimes = propertyAttempts.filter((attempt) => attempt.status === "completed" && attempt.success && attempt.elapsedMs).map((attempt) => attempt.elapsedMs as number);
  const bestTime = successfulTimes.length > 0 ? Math.min(...successfulTimes) : undefined;
  const latestAttempt = [...propertyAttempts].reverse().find((attempt) => attempt.teamId === teamId);
  const running = latestAttempt?.status === "running" ? latestAttempt : undefined;
  const pendingChallenge = state.challenges.find((challenge) => challenge.teamId === teamId && challenge.status === "pending");
  const isOwner = state.properties.find((item) => item.id === property.id)?.owner === teamId;
  const hasReadyResult = latestAttempt?.status === "completed" && latestAttempt.success && !latestAttempt.claimedAt;
  const canStart = !running && !pendingChallenge && !isOwner && !hasReadyResult;
  const [now, setNow] = useState(0);
  const runningId = running?.id ?? "";
  const runningStartedAt = running?.startedAt ?? "";

  useEffect(() => {
    if (!runningId) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [runningId]);

  const elapsed = running ? Math.max(0, now - new Date(runningStartedAt).getTime()) : latestAttempt?.elapsedMs;
  const resultText = latestAttempt?.status === "completed" && latestAttempt.elapsedMs !== undefined
    ? latestAttempt.success
      ? latestAttempt.benchmarkMs === undefined
        ? `完成時間 ${formatChallengeTime(latestAttempt.elapsedMs)}，成功建立首個紀錄。`
        : `完成時間 ${formatChallengeTime(latestAttempt.elapsedMs)}，成功快過 ${formatChallengeTime(latestAttempt.benchmarkMs)}。`
      : `完成時間 ${formatChallengeTime(latestAttempt.elapsedMs)}，未能快過 ${formatChallengeTime(latestAttempt.benchmarkMs)}。`
    : "";

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="property-rules-modal" role="dialog" aria-modal="true" aria-labelledby="property-rules-title">
      <button className="modal-close" onClick={onClose} aria-label="關閉">×</button>
      <header><span className="card-code">{property.id}</span><div><small>PHYSICAL CHECKPOINT</small><h1 id="property-rules-title">{property.title}</h1><p>{property.game}</p></div></header>
      <div className="property-record-rule"><b>⏱ 計時挑戰規則</b><p>{PROPERTY_CHALLENGE_RULE}</p><small>Web App 會用伺服器時間自動判定；工作員同步將隊名及時間寫入實體表作現場後備。</small></div>
      <section className="property-materials"><h2>物資</h2><div>{property.materials.map((item) => <span key={item}>▣ {item}</span>)}</div></section>
      <section className="rules-box"><h2>點玩</h2><ol>{property.rules.map((rule, index) => <li key={rule}><span>{index + 1}</span>{rule}</li>)}</ol><div className="success-rule"><b>成功條件</b>{property.success}</div></section>
      <section className={`property-timer ${running ? "running" : latestAttempt?.success ? "passed" : latestAttempt?.status === "completed" ? "failed" : ""}`} aria-live="polite">
        <div className="time-target"><small>TIME TO BEAT</small><b>{bestTime === undefined ? "首隊完成即可" : formatChallengeTime(bestTime)}</b></div>
        <div className="live-time"><small>{running ? "計時中" : latestAttempt?.elapsedMs !== undefined ? "你隊最近時間" : "準備好先開始"}</small><strong>{elapsed === undefined ? "0:00.0" : formatChallengeTime(elapsed)}</strong></div>
        {resultText && <p>{latestAttempt?.success ? "✓" : "×"} {resultText}</p>}
        {hasReadyResult && <div className="timer-next-step">✓ 已取得資格：返回挑戰頁選擇資源，再按「提交佔領申請」。</div>}
        {pendingChallenge && <div className="timer-next-step">⌛ 你隊已有 {pendingChallenge.propertyId} 等待 GM 確認。</div>}
        {isOwner && <div className="timer-next-step">✓ 這個生產點已屬於你隊。</div>}
        {running ? <button className="timer-stop" disabled={busy} onClick={() => void act("finishPropertyTimer", { propertyId: property.id })}>完成挑戰・停止計時</button> : <button className="timer-start" disabled={busy || !canStart} onClick={() => void act("startPropertyTimer", { propertyId: property.id })}>{latestAttempt?.status === "completed" && !latestAttempt.success ? "重新開始計時" : "全隊準備好・開始計時"}</button>}
      </section>
      <button className="challenge-button property-modal-close" onClick={onClose}>明白玩法・返回挑戰頁</button>
    </section>
  </div>;
}

function publicPromptIndex(seed: string, length: number) {
  return Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0) % length;
}

function PublicTaskModal({ task, state, teamId, busy, act, blockedBy, onClose }: { task: PublicTaskDefinition; state: GameState; teamId: TeamId; busy: boolean; act: ActionFn; blockedBy?: string; onClose: () => void }) {
  const claims = state.publicTaskClaims ?? [];
  const claim = [...claims].reverse().find((item) => item.taskId === task.id && item.teamId === teamId && item.status !== "rejected");
  const prompt = claim ? task.prompts[claim.promptIndex ?? publicPromptIndex(claim.id, task.prompts.length)] : null;
  const [showPattern, setShowPattern] = useState(false);
  const start = () => void act("claimPublicTask", { taskId: task.id });
  const submit = () => { if (claim) void act("submitPublicTask", { claimId: claim.id }); };
  const fail = () => {
    if (claim && window.confirm("確定今次公共任務失敗？重新挑戰時系統會改用另一題。")) void act("failPublicTask", { claimId: claim.id });
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="task-modal public-task-modal" role="dialog" aria-modal="true" aria-labelledby="public-task-title">
      <button className="modal-close" onClick={onClose} aria-label="關閉">×</button>
      <header><div><span className="card-code">{task.id}</span><span className="mode-tag physical">太和公共任務</span></div><h1 id="public-task-title">{task.title}</h1><p>{task.summary}</p></header>
      <div className="task-modal-meta"><span>● 太和活動範圍</span><span>▣ {task.materials}</span><span style={{ color: RESOURCES[task.reward].color }}>{RESOURCES[task.reward].icon} 獎勵 {RESOURCES[task.reward].name}×1</span></div>
      <section className="rules-box"><h2>點玩</h2><ol>{task.rules.map((rule, index) => <li key={rule}><span>{index + 1}</span>{rule}</li>)}</ol><div className="success-rule"><b>成功條件</b>{task.success}</div></section>

      {!claim && <section className="briefing-lock public-prompt-lock"><span>?</span><div><small>RANDOM PROMPT LOCKED</small><h2>本隊題目未抽出</h2><p>睇清楚玩法後按確認開始，系統先會抽出本隊條件／題卡。</p></div></section>}
      {claim?.status === "started" && prompt && <section className="public-prompt"><small>本隊抽中題目</small><h2>{prompt.title}</h2><p>{prompt.detail}</p>{prompt.pattern && (!showPattern ? <button className="private-reveal" onClick={() => setShowPattern(true)}>只由隊尾按下・查看點陣圖</button> : <><div className="dot-pattern">{prompt.pattern.map((row) => <b key={row}>{row}</b>)}</div><button className="ghost tool-wide" onClick={() => setShowPattern(false)}>隊尾已記住・收起題卡</button></>)}</section>}
      {claim?.status === "pending" && <div className="pending-banner">⌛ 題目已完成並提交，等待 GM 現場核對。GM 確認後你隊會收到彈出通知。</div>}
      {claim?.status === "completed" && <div className="complete-banner">✓ GM 已確認，{RESOURCES[task.reward].name}×1 已入帳。</div>}

      {!claim ? <button className="challenge-button modal-start" disabled={busy || Boolean(blockedBy)} onClick={start}>{blockedBy ? `先完成進行中的 ${blockedBy}` : "我哋已睇完玩法・確認開始並抽題"}</button> : claim.status === "started" ? <div className="task-outcome-actions"><button className="task-fail-button" disabled={busy} onClick={fail}>任務失敗・換題</button><button className="challenge-button modal-start" disabled={busy} onClick={submit}>已完成本隊題目・提交 GM 核對</button></div> : null}
    </section>
  </div>;
}

function LunchView({ state, teamId, busy, act }: { state: GameState; teamId: TeamId; busy: boolean; act: ActionFn }) {
  const claims = state.lunchContractClaims ?? [];
  const myClaim = claims.find((item) => item.teamId === teamId);
  return (
    <div className="content-stack">
      <PageTitle eyebrow="12:15–13:00・午膳仍在局內" title="補給合約桌" text="每隊最多接一份，三份公開合約先到先得。合約價按生產貨設計；直接去官方市場買齊再交，最多只會打和，一般會蝕錢。" />
      <ResourceStrip state={state} teamId={teamId} />
      <div className="card-grid three">
        {LUNCH_CONTRACTS.map((contract) => <LunchContractCard key={contract.id} contract={contract} claim={claims.find((item) => item.contractId === contract.id)} myClaim={myClaim} state={state} teamId={teamId} busy={busy} act={act} />)}
      </div>
      <div className="training-note"><b>合約唔再係市場套利</b><p>固定兩貨單只收 $10、三貨單收 $15；官方買價最低亦是每份 $5，而且每次買入會加價。最抵的做法是交出生產所得，或與其他隊談一個比官方價更好的交換。</p></div>
    </div>
  );
}

function LunchContractCard({ contract, claim, myClaim, state, teamId, busy, act }: {
  contract: (typeof LUNCH_CONTRACTS)[number];
  claim?: LunchContractClaim;
  myClaim?: LunchContractClaim;
  state: GameState;
  teamId: TeamId;
  busy: boolean;
  act: ActionFn;
}) {
  const team = state.teams[teamId];
  const [basket, setBasket] = useState<Record<ResourceKey, number>>(() => claim?.resources ?? { energy: 0, intel: 0, gear: 0, network: 0 });
  const fixedCost = contract.cost as Partial<Record<ResourceKey, number>> | null;
  const delivery = fixedCost ?? basket;
  const total = RESOURCE_KEYS.reduce((sum, key) => sum + (delivery[key] ?? 0), 0);
  const affordable = RESOURCE_KEYS.every((key) => team.resources[key] >= (delivery[key] ?? 0));
  const mine = claim?.teamId === teamId;

  const changeBasket = (key: ResourceKey, delta: number) => {
    setBasket((current) => {
      const currentTotal = RESOURCE_KEYS.reduce((sum, item) => sum + current[item], 0);
      if (delta > 0 && (currentTotal >= 3 || current[key] >= team.resources[key])) return current;
      return { ...current, [key]: Math.max(0, current[key] + delta) };
    });
  };

  return <article className={`contract-card interactive ${contract.id === "L3" ? "featured" : ""} ${claim?.status ?? "available"}`}>
    <div className="contract-head"><span>合約 {contract.id}</span>{claim && <b className={`contract-status ${claim.status}`}>{claim.status === "claimed" ? "已接取" : claim.status === "submitted" ? "交貨待收" : "已完成"}</b>}</div>
    <h3>{contract.title}</h3>
    <div className="contract-cost">
      {fixedCost ? RESOURCE_KEYS.map((key) => fixedCost[key] ? <span key={key} style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name} ×{fixedCost[key]}</span> : null) : <span className="mixed">任意資源合共 ×3</span>}
    </div>
    <div className="contract-payout">交貨得 <strong>${contract.cash}</strong><small>直接市場買貨不會有正利潤</small></div>

    {!claim && <button className="contract-primary" disabled={busy || Boolean(myClaim)} onClick={() => void act("claimLunchContract", { contractId: contract.id })}>{myClaim ? "每隊只可接一份" : "先到先得・接取合約"}</button>}
    {claim && !mine && <div className="contract-owner">⚑ 由 <b>{displayTeamName(state, claim.teamId)}</b> {claim.status === "claimed" ? "備貨中" : claim.status === "submitted" ? "等待 GM 收貨" : "完成"}</div>}
    {mine && claim.status === "claimed" && <div className="contract-fulfil">
      {!fixedCost && <><small>選擇今次交出邊 3 份（{total}/3）</small><div className="basket-grid lunch-basket">{RESOURCE_KEYS.map((key) => <div className="basket-item" key={key}><span style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name}<small>有 {team.resources[key]}</small></span><div><button disabled={busy || basket[key] === 0} onClick={() => changeBasket(key, -1)}>−</button><b>{basket[key]}</b><button disabled={busy || total >= 3 || basket[key] >= team.resources[key]} onClick={() => changeBasket(key, 1)}>＋</button></div></div>)}</div></>}
      {!affordable && <p className="contract-warning">現有資源未夠，可以先去交易所或官方市場補貨。</p>}
      <div className="contract-actions"><button className="ghost" disabled={busy} onClick={() => void act("releaseLunchContract", { claimId: claim.id })}>放棄合約</button><button className="contract-primary" disabled={busy || !affordable || (!fixedCost && total !== 3)} onClick={() => void act("submitLunchContract", { claimId: claim.id, resources: basket })}>{!affordable ? "資源未齊" : !fixedCost && total !== 3 ? `尚欠 ${3 - total} 份` : "提交交貨"}</button></div>
    </div>}
    {mine && claim.status === "submitted" && <div className="pending-banner contract-pending">⌛ 已鎖定交貨內容，等待 GM 確認收貨。確認前資源仍在隊伍庫存。</div>}
    {mine && claim.status === "completed" && <div className="complete-banner contract-complete">✓ 合約完成，交貨已扣除，現金已入帳。</div>}
  </article>;
}

function RouteView({ state, teamId, busy, act, onTask }: { state: GameState; teamId: TeamId; busy: boolean; act: ActionFn; onTask: (task: TaskDefinition) => void }) {
  const team = state.teams[teamId];
  const routeActive = state.phase === "route";
  const challengesOpen = routeActive && state.tasksOpen;
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const current = STATIONS[team.stationIndex];
  const currentZoneRank = ROUTE_ZONE_ORDER[current.zone];
  const canSelectStation = (index: number) => index >= 0 && index < STATIONS.length && index !== team.stationIndex && ROUTE_ZONE_ORDER[STATIONS[index].zone] >= currentZoneRank;
  const currentTasks = AFTERNOON_TASKS.filter((task) => task.station === team.stationIndex);
  const effectiveStation = selectedStation !== team.stationIndex ? selectedStation : null;
  const target = effectiveStation !== null ? STATIONS[effectiveStation] : null;

  const confirmArrival = () => {
    if (busy || !routeActive || effectiveStation === null || !canSelectStation(effectiveStation)) return;
    const targetIndex = effectiveStation;
    if (!state.gpsStrict) {
      void act("arrive", { stationIndex: targetIndex }).then((ok) => { if (ok) setSelectedStation(null); });
      return;
    }
    if (!navigator.geolocation) { window.alert("此瀏覽器未提供 GPS。請開啟定位權限後再試。"); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => void act("arrive", { stationIndex: targetIndex, lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }).then((ok) => { if (ok) setSelectedStation(null); }),
      () => window.alert("未能取得位置。請在瀏覽器設定中允許 GPS，再試一次。"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    );
  };

  return (
    <div className="route-layout">
      <div className="route-main content-stack">
        <section className="route-hero">
          <div className="route-phase"><span>⚑</span><div><small>{phaseName(state.phase)}</small><h1><b>{state.deadline}</b> 任務截止</h1></div></div>
          <div className="location-row location-self-select"><div><span className="location-pin">✓</span><small>系統已驗證位置</small><b>{current.name}</b></div><i /><div className={target ? "chosen" : ""}><span className="next-arrow">⌖</span><small>你話而家身處</small><b>{target?.name ?? "請在下方選站"}</b></div></div>
          <button className="gps-button" disabled={busy || !routeActive || effectiveStation === null} onClick={confirmArrival}><span>●</span>{!routeActive ? "航線階段已結束" : effectiveStation === null ? "先選擇你而家身處位置" : state.gpsStrict ? `GPS 驗證我在${target?.name}` : `示範確認我在${target?.name}`}</button>
          {!state.gpsStrict && <span className="demo-mode">GM 尚未啟用實地 GPS</span>}
        </section>

        <ResourceStrip state={state} teamId={teamId} />

        <section className="station-panel location-picker">
          <header><div><small>STEP 1・自行選擇現時位置</small><h2>你而家身處邊一站？</h2></div><p>同區可任意前後移動；一旦驗證進入下一區，上一區會立即鎖定。</p></header>
          <div className="station-zone-groups">{(["A", "B", "C"] as const).map((zone) => <section key={zone} className={ROUTE_ZONE_ORDER[zone] < currentZoneRank ? "locked" : ""}><div className="zone-label"><b>{zone}區</b><span>{ROUTE_ZONE_ORDER[zone] < currentZoneRank ? "已離開・不能返回" : zone === current.zone ? "目前區域・可回頭" : "下一區・進入後鎖上一區"}</span></div><div className="location-options">{STATIONS.map((station, index) => {
            if (station.zone !== zone) return null;
            const locked = ROUTE_ZONE_ORDER[station.zone] < currentZoneRank;
            const isCurrent = index === team.stationIndex;
            const selected = index === effectiveStation;
            const task = AFTERNOON_TASKS.find((item) => item.station === index);
            const capacity = task ? taskCapacityInfo(state, task, teamId) : null;
            return <button key={station.id} className={`location-option ${locked ? "locked" : ""} ${isCurrent ? "current" : ""} ${selected ? "selected" : ""} ${capacity?.soldOut ? "sold-out" : ""}`} disabled={locked || isCurrent} onClick={() => setSelectedStation(index)}><span className="location-radio">{isCurrent ? "✓" : selected ? "●" : "○"}</span><div><b>{station.name}</b><small>{station.venue}</small>{task && <em>{task.id} {task.title}・獎勵 {describeTaskReward(task)}{capacity ? `・${capacity.label}` : ""}</em>}</div><i>{locked ? "鎖定" : isCurrent ? "已驗證" : capacity?.soldOut ? "已滿" : "選擇"}</i></button>;
          })}</div></section>)}</div>
          <footer><b>STEP 2</b><span>{effectiveStation === null ? "揀站後按上方按鈕做 GPS 驗證。" : `已選 ${target?.name}；請先停定在站內／指定點，再按 GPS 驗證。`}</span></footer>
        </section>
      </div>

      <aside className="route-rail">
        <div className="rail-heading"><div><span>資源</span><b>{RESOURCE_KEYS.reduce((sum, key) => sum + team.resources[key], 0)} 件</b></div><span className={`open-status ${challengesOpen ? "" : "closed"}`}>{challengesOpen ? "任務開放" : "已截止"}</span></div>
        {currentTasks.length ? currentTasks.map((task) => <TaskSpotlight key={task.id} task={task} state={state} teamId={teamId} onOpen={() => onTask(task)} />) : <div className="empty-rail"><span>⌁</span><b>此站沒有任務</b><p>可以選擇同區其他站，或進入下一區繼續；跨區後不能返回。</p></div>}
      </aside>
    </div>
  );
}

function TaskSpotlight({ task, state, teamId, onOpen }: { task: TaskDefinition; state: GameState; teamId: TeamId; onOpen: () => void }) {
  const run = [...state.taskRuns].reverse().find((item) => item.taskId === task.id && item.teamId === teamId);
  const capacity = taskCapacityInfo(state, task, teamId);
  const label = run?.status === "completed" ? "已完成" : run?.status === "submitted" ? "等候確認" : run?.status === "started" ? "挑戰中" : capacity?.soldOut ? "名額已滿" : run?.status === "rejected" ? "可重新搶額" : state.phase !== "route" ? "13:00 開放" : "可挑戰";
  return (
    <article className={`task-spotlight ${run?.status ?? ""} ${capacity?.soldOut ? "sold-out" : ""}`}>
      <div className="task-status">★ {label}</div><span className="task-art">✊✌✋</span>
      <h2>{task.id} {task.title}</h2><p>{run ? task.tagline : "任務內容已鎖定；確認開始挑戰後先會顯示完整玩法。"}</p>
      <div className="reward-row"><span>獎勵</span>{task.reward.resources && RESOURCE_KEYS.map((key) => task.reward.resources?.[key] ? <b key={key} style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name}×{task.reward.resources[key]}</b> : null)}{task.reward.cash ? <b className="money">▰ ${task.reward.cash}</b> : null}{!task.reward.cash && !task.reward.resources && <b>特殊效果</b>}</div>
      <div className="task-meta"><span>● {taskLocation(task.station)}</span><span>◷ 約 {task.duration} 分鐘</span>{capacity && <span className={capacity.soldOut ? "capacity-full" : "capacity-open"}>⚑ {capacity.label}</span>}</div>
      <button className="challenge-button" onClick={onOpen}>{run?.status === "completed" ? "查看任務" : run?.status === "submitted" ? "查看狀態" : run?.status === "started" ? "返回任務" : capacity?.soldOut ? "查看已滿任務" : run?.status === "rejected" ? "重新搶額挑戰" : "查看並確認開始"} ›</button>
    </article>
  );
}

function TasksView({ state, teamId, onTask }: { state: GameState; teamId: TeamId; onTask: (task: TaskDefinition) => void }) {
  const team = state.teams[teamId];
  const routeActive = state.phase === "route";
  const challengesOpen = routeActive && state.tasksOpen;
  const currentZone = STATIONS[team.stationIndex].zone;
  const currentZoneRank = ROUTE_ZONE_ORDER[currentZone];
  return (
    <div className="content-stack">
      <PageTitle eyebrow="13:00–14:45・港鐵站及指定站外點" title="Checkpoint 任務庫" text="A、B、C 各區內可以前後移動；一旦進入下一區，上一區所有未完成任務會永久失去。" action={<div className={`open-status big ${challengesOpen ? "" : "closed"}`}>{challengesOpen ? "● 接受挑戰" : routeActive ? "任務截止" : "13:00 尚未開放"}</div>} />
      <div className="task-list">
        {[...AFTERNOON_TASKS].sort((a, b) => a.station - b.station).map((task) => {
          const run = [...state.taskRuns].reverse().find((item) => item.taskId === task.id && item.teamId === teamId);
          const current = task.station === team.stationIndex;
          const taskZoneRank = ROUTE_ZONE_ORDER[STATIONS[task.station].zone];
          const locked = taskZoneRank < currentZoneRank;
          const sameZone = taskZoneRank === currentZoneRank;
          const capacity = taskCapacityInfo(state, task, teamId);
          return (
            <article className={`task-row ${current ? "available" : ""} ${locked ? "missed" : ""} ${capacity?.soldOut ? "sold-out" : ""}`} key={task.id}>
              <div className="task-code">{task.id}</div>
              <div className="task-copy"><small>{taskLocation(task.station)}・{task.mode === "phone" ? "手機互動" : task.mode === "cross-team" ? "跨隊" : "實體"}・約 {task.duration} 分鐘</small><h3>{task.title}</h3><strong className="task-visible-reward">獎勵公開：{describeTaskReward(task)}</strong>{capacity && <strong className={`task-capacity ${capacity.soldOut ? "full" : ""}`}>{capacity.label}</strong>}<p>{run ? task.tagline : "玩法及題目仍然鎖定；到站確認開始、睇完規則再按一次，先會出題。"}</p></div>
              <div className="task-row-status">{run?.status === "completed" ? "✓ 完成" : run?.status === "submitted" ? "⌛ 審批" : run?.status === "started" ? "挑戰中" : !routeActive ? "13:00 開放" : locked ? "已離開此區" : capacity?.soldOut ? "名額已滿" : current ? run?.status === "rejected" ? "可重新搶額" : "可挑戰" : sameZone ? "同區可到" : "未到區"}</div>
              <button disabled={!current && !run} onClick={() => onTask(task)}>查看</button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MarketView({ state, teamId, busy, act }: { state: GameState; teamId: TeamId; busy: boolean; act: ActionFn }) {
  const team = state.teams[teamId];
  const [target, setTarget] = useState<ResourceKey>("energy");
  const [basket, setBasket] = useState<Record<ResourceKey, number>>({ energy: 0, intel: 0, gear: 0, network: 0 });
  const required = team.twoForOne > 0 ? 2 : 3;
  const basketTotal = RESOURCE_KEYS.reduce((sum, key) => sum + basket[key], 0);

  return (
    <div className="content-stack">
      <PageTitle eyebrow="價格會因每次官方買賣而變動" title="官方市場" text="買入後該資源加 $1，賣出後減 $1；買價保持在 $5–$8，賣價永遠是買價減 $3。" action={<div className="cash-total">可用現金 <b>${team.cash}</b></div>} />
      <div className="market-grid">
        {RESOURCE_KEYS.map((key) => {
          const price = state.prices[key];
          return <article className="market-card" key={key} style={{ "--resource": RESOURCES[key].color } as React.CSSProperties}>
            <div className="market-icon">{RESOURCES[key].icon}</div><div><small>{RESOURCES[key].name}</small><h2>${price}</h2><span>持有 {team.resources[key]}・賣出 ${price - 3}</span></div>
            <div className="market-actions"><button disabled={busy || team.resources[key] < 1} onClick={() => void act("market", { operation: "sell", resource: key })}>賣 1</button><button className="buy" disabled={busy || team.cash < price} onClick={() => void act("market", { operation: "buy", resource: key })}>買 1</button></div>
          </article>;
        })}
      </div>

      <section className="convert-panel">
        <div><p className="eyebrow">OFFICIAL EXCHANGE</p><h2>{required} 換 1 資源重組</h2><p>交出混合資源亦可以。碼頭協調認證可令一次 3 換 1 變成 2 換 1。</p></div>
        <div className="basket-grid">
          {RESOURCE_KEYS.map((key) => <div className="basket-item" key={key}><span style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name}</span><div><button onClick={() => setBasket({ ...basket, [key]: Math.max(0, basket[key] - 1) })}>−</button><b>{basket[key]}</b><button disabled={basket[key] >= team.resources[key] || basketTotal >= required} onClick={() => setBasket({ ...basket, [key]: basket[key] + 1 })}>＋</button></div></div>)}
        </div>
        <label className="target-select">換取<select value={target} onChange={(event) => setTarget(event.target.value as ResourceKey)}>{RESOURCE_KEYS.map((key) => <option key={key} value={key}>{RESOURCES[key].name}</option>)}</select></label>
        <button className="primary-button" disabled={busy || basketTotal !== required} onClick={async () => { const ok = await act("convert", { resources: basket, targetResource: target }); if (ok) setBasket({ energy: 0, intel: 0, gear: 0, network: 0 }); }}>確認重組（{basketTotal}/{required}）</button>
      </section>
    </div>
  );
}

function blankTradeSide(): TradeSide {
  return { cash: 0, resources: { energy: 0, intel: 0, gear: 0, network: 0 } };
}

function TradesView({ state, teamId, busy, act }: { state: GameState; teamId: TeamId; busy: boolean; act: ActionFn }) {
  const [to, setTo] = useState<TeamId>(teamId === "red" ? "blue" : "red");
  const [give, setGive] = useState<TradeSide>(blankTradeSide());
  const [receive, setReceive] = useState<TradeSide>(blankTradeSide());
  const [note, setNote] = useState("");
  const properties = state.properties.filter((item) => item.owner === teamId);
  const otherProperties = state.properties.filter((item) => item.owner === to);
  const relevantTrades = state.trades.filter((trade) => trade.from === teamId || trade.to === teamId);

  const setSideResource = (side: TradeSide, setter: (value: TradeSide) => void, key: ResourceKey, value: number) => setter({ ...side, resources: { ...side.resources, [key]: Math.max(0, value) } });

  return (
    <div className="content-stack">
      <PageTitle eyebrow="資源・業權・現金都可交換" title="玩家交易所" text="報價不會鎖起資產；對方接受的一刻，伺服器會再次核對雙方資產並一次過交換。" />
      <section className="trade-builder">
        <div className="trade-party from"><span style={{ background: TEAMS[teamId].color }} />我方提供</div>
        <div className="trade-arrow">⇄</div>
        <label className="trade-party to">向 <select value={to} onChange={(event) => { setTo(event.target.value as TeamId); setReceive(blankTradeSide()); }}>{(Object.keys(TEAMS) as TeamId[]).filter((id) => id !== teamId).map((id) => <option value={id} key={id}>{displayTeamName(state, id)}</option>)}</select> 索取</label>
        <TradeSideEditor label="我方交出" side={give} setSide={setGive} properties={properties} maxResources={state.teams[teamId].resources} setResource={setSideResource} />
        <TradeSideEditor label={`${displayTeamName(state, to)}交出`} side={receive} setSide={setReceive} properties={otherProperties} maxResources={state.teams[to].resources} setResource={setSideResource} />
        <label className="trade-note">留言（選填）<input value={note} maxLength={80} onChange={(event) => setNote(event.target.value)} placeholder="例如：裝備而家對你哋更值錢" /></label>
        <button className="primary-button trade-submit" disabled={busy || countAssets(give) === 0 || countAssets(receive) === 0} onClick={async () => { const ok = await act("createTrade", { to, give, receive, note }); if (ok) { setGive(blankTradeSide()); setReceive(blankTradeSide()); setNote(""); } }}>發出原子報價</button>
      </section>

      <section>
        <div className="section-heading"><div><span>LIVE OFFERS</span><h2>交易板</h2></div><small>每 4.5 秒自動同步</small></div>
        <div className="offer-list">
          {relevantTrades.length === 0 && <div className="empty-state">暫時未有報價。用上面的交易器向另一隊開價。</div>}
          {relevantTrades.map((trade) => <TradeCard key={trade.id} trade={trade} state={state} teamId={teamId} busy={busy} act={act} />)}
        </div>
      </section>
    </div>
  );
}

function TradeSideEditor({ label, side, setSide, properties, maxResources, setResource }: { label: string; side: TradeSide; setSide: (side: TradeSide) => void; properties: GameState["properties"]; maxResources: Record<ResourceKey, number>; setResource: (side: TradeSide, setter: (value: TradeSide) => void, key: ResourceKey, value: number) => void }) {
  return (
    <div className="side-editor"><h3>{label}</h3>
      <label>現金<input type="number" min="0" inputMode="numeric" value={side.cash || ""} onChange={(event) => setSide({ ...side, cash: Math.max(0, Number(event.target.value)) })} placeholder="$0" /></label>
      <div className="resource-inputs">{RESOURCE_KEYS.map((key) => <label key={key}><span style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon}</span>{RESOURCES[key].name}<input type="number" min="0" max={maxResources[key]} inputMode="numeric" value={side.resources[key] || ""} onChange={(event) => setResource(side, setSide, key, Number(event.target.value))} /></label>)}</div>
      <label>業權<select value={side.propertyId ?? ""} onChange={(event) => setSide({ ...side, propertyId: event.target.value || undefined })}><option value="">不包含業權</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.id} {item.title}</option>)}</select></label>
    </div>
  );
}

function TradeCard({ trade, state, teamId, busy, act }: { trade: Trade; state: GameState; teamId: TeamId; busy: boolean; act: ActionFn }) {
  return <article className={`offer-card ${trade.status}`}>
    <div className="offer-meta"><span className={`status-dot ${trade.status}`} />{displayTeamName(state, trade.from)} → {displayTeamName(state, trade.to)}<small>{formatTime(trade.createdAt)}</small></div>
    <div className="offer-exchange"><div><small>{displayTeamName(state, trade.from)}交出</small><b>{describeSide(trade.give)}</b></div><span>⇄</span><div><small>{displayTeamName(state, trade.to)}交出</small><b>{describeSide(trade.receive)}</b></div></div>
    {trade.note && <p>「{trade.note}」</p>}
    <div className="offer-actions"><span>{trade.status === "open" ? "等待回覆" : trade.status === "completed" ? "✓ 已完成" : "已取消"}</span>{trade.status === "open" && trade.to === teamId && <button disabled={busy} onClick={() => void act("acceptTrade", { tradeId: trade.id })}>接受並交換</button>}{trade.status === "open" && trade.from === teamId && <button className="ghost" disabled={busy} onClick={() => void act("cancelTrade", { tradeId: trade.id })}>取消</button>}</div>
  </article>;
}

function ProjectsView({ state, teamId, busy, act }: { state: GameState; teamId: TeamId; busy: boolean; act: ActionFn }) {
  const team = state.teams[teamId];
  return (
    <div className="content-stack">
      <PageTitle eyebrow="15:00 前完成全部四項" title="出航認證項目" text="四項採用不同配方：成本由 3 至 6 份資源。留意 A 區能源及 B 區裝備，跨區後不能回頭補做。" action={<div className="project-total"><b>{team.projects.length}</b>/4 完成</div>} />
      <ResourceStrip state={state} teamId={teamId} />
      <div className="project-grid">
        {PROJECTS.map((project) => {
          const done = team.projects.includes(project.id);
          const affordable = RESOURCE_KEYS.every((key) => team.resources[key] >= ((project.cost as Partial<Record<ResourceKey, number>>)[key] ?? 0));
          const totalCost = RESOURCE_KEYS.reduce((sum, key) => sum + ((project.cost as Partial<Record<ResourceKey, number>>)[key] ?? 0), 0);
          return <article className={`project-card ${done ? "done" : ""}`} key={project.id}>
            <div className="project-icon">{project.icon}</div><div className="project-title"><span>{done ? "✓ 已認證" : `待完成・成本 ${totalCost}`}</span><h2>{project.title}</h2></div>
            <div className="project-cost">{RESOURCE_KEYS.map((key) => { const amount = (project.cost as Partial<Record<ResourceKey, number>>)[key]; return amount ? <span key={key} style={{ borderColor: RESOURCES[key].color, color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name}×{amount}</span> : null; })}</div>
            <p>{project.perk}</p><button disabled={busy || done || !affordable} onClick={() => void act("craftProject", { projectId: project.id })}>{done ? "認證完成" : affordable ? "投入資源認證" : "資源不足"}</button>
          </article>;
        })}
      </div>
      <section className="settlement-rule"><div><span>01</span><b>先完成四項</b><p>15:00 前完成全部才取得出航資格。</p></div><div><span>02</span><b>資產自動清算</b><p>剩餘資源按官方賣價、C5 已確認資源每份 ${C5_SETTLEMENT_PER_RESOURCE}、業權每個 $4 計算。</p></div><div><span>03</span><b>最高現金勝出</b><p>合資格隊伍以清算後現金決勝。</p></div></section>
      {state.settled && <section className="leaderboard"><div className="section-heading"><div><span>FINAL RESULT</span><h2>出航排名</h2></div></div>{state.finalScores.map((score) => <div key={score.teamId} className={score.teamId === teamId ? "mine" : ""}><b>#{score.rank}</b><span style={{ color: TEAMS[score.teamId].color }}>⚑ {displayTeamName(state, score.teamId)}</span><small>{score.qualified ? "四項認證完成" : `${score.projects}/4 認證`}</small><strong>${score.cash}</strong></div>)}</section>}
    </div>
  );
}

function TaskModal({ task, state, teamId, busy, act, onClose }: { task: TaskDefinition; state: GameState; teamId: TeamId; busy: boolean; act: ActionFn; onClose: () => void }) {
  const runs = state.taskRuns.filter((item) => item.taskId === task.id && item.teamId === teamId);
  const run = runs[runs.length - 1];
  const [seconds, setSeconds] = useState(task.duration * 60);
  const [timing, setTiming] = useState(false);
  const [toolReady, setToolReady] = useState(false);
  const [note, setNote] = useState("");
  const [miniComplete, setMiniComplete] = useState(!hasTaskTool(task.id));
  const [toolEvidence, setToolEvidence] = useState("");
  const [toolPayload, setToolPayload] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!timing || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [timing, seconds]);

  const start = async () => {
    const ok = await act("startTask", { taskId: task.id });
    if (ok) {
      setTiming(false);
      setToolReady(false);
      setSeconds(task.duration * 60);
      setMiniComplete(false);
      setToolEvidence("");
      setToolPayload({});
    }
  };

  const beginTool = () => {
    setToolReady(true);
    setTiming(true);
    setSeconds(task.duration * 60);
    setMiniComplete(!hasTaskTool(task.id));
  };

  const fail = () => {
    if (!window.confirm("確定今次任務失敗？今次進度會結束；重新挑戰時系統會改用另一組題目。")) return;
    void act("failTask", { taskId: task.id });
  };

  const submitted = run?.status === "submitted";
  const complete = run?.status === "completed";
  const active = run?.status === "started";
  const revealed = Boolean(run);
  const routeActive = state.phase === "route";
  const capacity = taskCapacityInfo(state, task, teamId);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-title">
        <button className="modal-close" onClick={onClose} aria-label="關閉">×</button>
        <header><div><span className="card-code">{task.id}</span><span className={`mode-tag ${task.mode}`}>{task.mode === "phone" ? "手機互動" : task.mode === "market" ? "市場策略" : task.mode === "cross-team" ? "跨隊協作" : "實體團隊"}</span></div><h1 id="task-title">{task.title}</h1><p>{revealed ? task.tagline : "完整玩法會在你確認開始後解鎖。"}</p></header>
        <div className="task-modal-meta"><span>● {taskLocation(task.station)}</span><span>◷ 約 {task.duration} 分鐘</span>{run && <span>▦ 題組 #{(run.questionSet ?? 0) + 1}</span>}{capacity && <span className={capacity.soldOut ? "capacity-full" : "capacity-open"}>⚑ {capacity.label}</span>}<span>↔ 同區可回頭・跨區不可返</span></div>
        {revealed ? <section className="rules-box"><h2>點玩</h2><ol>{task.rules.map((rule, index) => <li key={rule}><span>{index + 1}</span>{rule}</li>)}</ol><div className="success-rule"><b>成功條件</b>{task.success}</div></section> : <section className="briefing-lock"><span>⌁</span><div><small>CONTENT LOCKED</small><h2>玩法尚未解鎖</h2><p>按下「確認開始」後，系統會記錄挑戰並立即顯示玩法及成功條件。</p></div></section>}

        {capacity?.soldOut && !active && !submitted && !complete && <div className="capacity-alert">限量名額已由其他隊伍搶完。若有隊伍挑戰失敗或被 GM 退回，名額會即時重新開放。</div>}

        {active && state.tasksOpen && !toolReady && <section className="question-gate"><span>?</span><div><small>QUESTION / TOOL STILL LOCKED</small><h2>玩法睇清楚未？</h2><p>確認後先會出題／開遊戲工具，同時計時。未確認前可以慢慢問清楚 GM。</p></div><button className="challenge-button" onClick={beginTool}>我哋已睇完玩法・確認出題</button></section>}
        {active && state.tasksOpen && toolReady && <TaskTool key={`${run?.id}-${run?.questionSet ?? 0}`} taskId={task.id} state={state} teamId={teamId} startedAt={run?.startedAt} questionSet={run?.questionSet} onComplete={(evidence, payload = {}) => { setMiniComplete(true); setToolEvidence(evidence); setToolPayload(payload); }} />}
        {active && !state.tasksOpen && <div className="pending-banner">14:45 任務已全面停止，呢次挑戰不能再提交。</div>}

        <section className="task-reward"><div><small>完成獎勵</small><div>{task.reward.resources && RESOURCE_KEYS.map((key) => task.reward.resources?.[key] ? <span key={key} style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name}×{task.reward.resources[key]}</span> : null)}{task.reward.cash ? <span>▰ 現金 ${task.reward.cash}</span> : null}{task.reward.note ? <span>{task.reward.note}</span> : null}</div></div>{(active || submitted) && <div className={`task-timer ${seconds < 30 ? "urgent" : ""}`}><small>{timing ? "任務計時" : "準備完成"}</small><b>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</b></div>}</section>

        {complete ? <div className="complete-banner">✓ GM 已確認完成，獎勵已存入隊伍庫存。</div> : submitted ? <div className="pending-banner">⌛ 已提交，等待 GM 在控場台確認。</div> : active ? (
          <div className="submit-area">
            {toolEvidence && <div className="tool-evidence">✓ 工具紀錄：{toolEvidence}</div>}
            <label>給 GM 的完成備註（選填）<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：18 次內完成／交易編號" /></label>
            <div className="task-outcome-actions"><button className="task-fail-button" disabled={busy} onClick={fail}>任務失敗</button><button className="challenge-button" disabled={busy || !toolReady || !miniComplete || !routeActive || !state.tasksOpen} onClick={() => void act("submitTask", { taskId: task.id, note: [toolEvidence, note.trim()].filter(Boolean).join("・"), ...toolPayload })}>{!routeActive ? "13:00 航線開拓後先可提交" : !state.tasksOpen ? "14:45 任務已全面停止" : !toolReady ? "睇完玩法後先確認出題" : !miniComplete ? "先完成上面的遊戲工具" : task.id === "C5" ? "提交並即時扣起資源" : "提交完成，等 GM 確認"}</button></div>
          </div>
        ) : (
          <button className="challenge-button modal-start" disabled={busy || !routeActive || !state.tasksOpen || state.teams[teamId].stationIndex !== task.station || Boolean(capacity?.soldOut)} onClick={start}>{!routeActive ? "13:00 航線開拓後先開放" : !state.tasksOpen ? "任務已截止" : state.teams[teamId].stationIndex !== task.station ? "必須先到達此站" : capacity?.soldOut ? "限量名額已搶完" : run?.status === "rejected" ? "重新搶額・先睇玩法" : capacity ? `搶限量名額・剩 ${capacity.remaining} 個` : "確認開始・先解鎖玩法"}</button>
        )}
      </section>
    </div>
  );
}

const GM_NAV = [
  { id: "control", label: "控場", icon: "◉" },
  { id: "approvals", label: "審批", icon: "☑" },
  { id: "assets", label: "資產", icon: "▣" },
  { id: "log", label: "紀錄", icon: "≡" },
  { id: "chat", label: "聊天室", icon: "✉" },
] as const;

function GMDashboard({ state, busy, act, gmPin, onLogout }: { state: GameState; busy: boolean; act: ActionFn; gmPin: string; onLogout: () => void }) {
  const [view, setView] = useState<(typeof GM_NAV)[number]["id"]>("control");
  const pendingCount = state.challenges.filter((item) => item.status === "pending").length + (state.publicTaskClaims ?? []).filter((item) => item.status === "pending").length + (state.lunchContractClaims ?? []).filter((item) => item.status === "submitted").length + state.taskRuns.filter((item) => item.status === "submitted").length;
  const chatMessages = state.chatMessages ?? [];
  const latestChatId = chatMessages[chatMessages.length - 1]?.id ?? "";
  const [lastReadChatId, setLastReadChatId] = useState(latestChatId);
  const lastReadChatIndex = chatMessages.findIndex((message) => message.id === lastReadChatId);
  const unreadChatCount = view === "chat" ? 0 : chatMessages
    .slice(lastReadChatIndex >= 0 ? lastReadChatIndex + 1 : 0)
    .filter((message) => message.senderRole === "team")
    .length;
  const selectView = (nextView: (typeof GM_NAV)[number]["id"]) => {
    if (view === "chat" || nextView === "chat") setLastReadChatId(latestChatId);
    setView(nextView);
  };

  return (
    <main className="app-shell gm-shell">
      <aside className="sidebar">
        <div className="side-brand"><span className="train-mark">➤</span><b>棋航者</b><small>最後登船令・GM</small></div>
        <nav>{GM_NAV.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => selectView(item.id)}><span>{item.icon}</span>{item.label}{item.id === "approvals" && pendingCount > 0 && <i>{pendingCount}</i>}{item.id === "chat" && unreadChatCount > 0 && <i>{Math.min(unreadChatCount, 99)}</i>}</button>)}</nav>
        <div className="one-way-note"><b>GM 權限</b><span>所有操作即時同步三隊</span></div><button className="logout-link" onClick={onLogout}>退出 GM</button>
      </aside>
      <header className="topbar"><div className="room-chip"><span>♟</span> 房間 <b>{state.roomCode}</b></div><div className="live-pill compact"><span /> GM LIVE</div><div className="top-team">當前：{phaseName(state.phase)}</div><div className="cash-chip">⌁ <b>{pendingCount}</b> 待處理</div></header>
      <section className="app-content">
        {view === "control" && <GMControl state={state} busy={busy} act={act} gmPin={gmPin} />}
        {view === "approvals" && <GMApprovals state={state} busy={busy} act={act} />}
        {view === "assets" && <GMAssets state={state} busy={busy} act={act} />}
        {view === "log" && <GMLog state={state} busy={busy} act={act} />}
        {view === "chat" && <ChatRoom state={state} actor={{ role: "gm" }} busy={busy} act={act} />}
      </section>
      <nav className="mobile-nav gm">{GM_NAV.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => selectView(item.id)}><span>{item.icon}</span>{item.label}{item.id === "approvals" && pendingCount > 0 && <i>{pendingCount}</i>}{item.id === "chat" && unreadChatCount > 0 && <i>{Math.min(unreadChatCount, 99)}</i>}</button>)}</nav>
    </main>
  );
}

function GMControl({ state, busy, act, gmPin }: { state: GameState; busy: boolean; act: ActionFn; gmPin: string }) {
  const routeActive = state.phase === "route";
  const challengesOpen = routeActive && state.tasksOpen;
  return <div className="content-stack">
    <PageTitle eyebrow="GAME MASTER COMMAND" title="全局控場" text="由呢度切換 session、結算生產同在 14:45 一鍵停止所有新任務。" action={<div className="live-pill"><span /> 三隊同步中</div>} />
    <section className="gm-phase-panel"><div className="phase-timeline">{PHASES.map((phase, index) => <button key={phase.id} className={state.phase === phase.id ? "current" : PHASES.findIndex((item) => item.id === state.phase) > index ? "done" : ""} disabled={busy} onClick={() => void act("setPhase", { phase: phase.id })}><span>{state.phase === phase.id ? "●" : PHASES.findIndex((item) => item.id === state.phase) > index ? "✓" : index + 1}</span><small>{phase.time}</small><b>{phase.name}</b></button>)}</div></section>
    <div className="gm-action-grid">
      <article className="gm-action-card production"><span className="gm-card-icon">⚙</span><div><small>PRODUCTION TICK</small><h2>第 {state.productionTick + 1} 次生產</h2><p>自動為所有有效業權生產 1 份指定資源；停產標記會同時清除。</p></div><button disabled={busy} onClick={() => void act("runProduction")}>結算生產</button></article>
      <article className={`gm-action-card cutoff ${challengesOpen ? "" : "closed"}`}><span className="gm-card-icon">◷</span><div><small>13:00 START・14:45 CUTOFF</small><h2>{!routeActive ? "下午任務尚未開始" : challengesOpen ? "任務仍然開放" : "所有任務已截止"}</h2><p>{!routeActive ? "切換至「航線開拓」後，系統先會開放到站及 A、B、C 任務。" : "14:45 關閉後，未提交的進行中任務亦會停止。"}</p></div><button disabled={busy || !routeActive} onClick={() => void act("setTasksOpen", { open: !state.tasksOpen })}>{!routeActive ? "等待航線開拓" : challengesOpen ? "停止全部任務" : "重新開放任務"}</button></article>
      <article className={`gm-action-card gps ${state.gpsStrict ? "active" : ""}`}><span className="gm-card-icon">⌖</span><div><small>LOCATION MODE</small><h2>{state.gpsStrict ? "GPS 實地驗證" : "示範到站模式"}</h2><p>實地模式會核對玩家與所選車站距離；測試時可先關閉。</p></div><button disabled={busy} onClick={() => void act("setGpsStrict", { strict: !state.gpsStrict })}>{state.gpsStrict ? "改用示範模式" : "啟用 GPS"}</button></article>
      <article className={`gm-action-card settlement ${state.settled ? "closed" : ""}`}><span className="gm-card-icon">🏁</span><div><small>15:00 SETTLEMENT</small><h2>{state.settled ? "最終排名已鎖定" : "出航資格與資產清算"}</h2><p>先判斷四項認證，再將剩餘資源按賣價、C5 已確認資源每份 ${C5_SETTLEMENT_PER_RESOURCE}、業權每個 $4 轉成現金排名；未確認 C5 會先退回扣起資源。</p></div><button disabled={busy || state.settled} onClick={() => { if (window.confirm("確定進行 15:00 最終結算？剩餘資源及 C5 合約價值會轉成現金；未確認的 C5 扣起資源會先退回。")) void act("settleGame"); }}>{state.settled ? "結算完成" : "進行最終結算"}</button></article>
    </div>
    <TeamPinManager state={state} gmPin={gmPin} />
    <section><div className="section-heading"><div><span>TEAM PULSE</span><h2>三隊即時狀態</h2></div><small>站點、現金及四項認證</small></div><div className="gm-team-grid">{(Object.keys(TEAMS) as TeamId[]).map((id) => <GMTeamSummary key={id} state={state} teamId={id} />)}</div></section>
  </div>;
}

function TeamPinManager({ state, gmPin }: { state: GameState; gmPin: string }) {
  const [pins, setPins] = useState<Record<TeamId, string>>({ red: "", blue: "", gold: "" });
  const [savedPins, setSavedPins] = useState<Record<TeamId, string> | null>(null);
  const [loadingPins, setLoadingPins] = useState(true);
  const [savingPins, setSavingPins] = useState(false);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);

  const request = useCallback(async (action: "getTeamPins" | "setTeamPins", nextPins?: Record<TeamId, string>) => {
    const response = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, pin: gmPin, payload: nextPins ? { teamPins: nextPins } : {} }),
    });
    const data = (await response.json()) as { teamPins?: Record<TeamId, string>; error?: string };
    if (!response.ok || !data.teamPins) throw new Error(data.error ?? "未能讀取隊伍登入碼。");
    return data.teamPins;
  }, [gmPin]);

  useEffect(() => {
    let active = true;
    void request("getTeamPins")
      .then((loaded) => { if (active) { setPins(loaded); setSavedPins(loaded); } })
      .catch((error) => { if (active) setMessage({ text: error instanceof Error ? error.message : "讀取失敗。", good: false }); })
      .finally(() => { if (active) setLoadingPins(false); });
    return () => { active = false; };
  }, [request]);

  const valid = (Object.keys(TEAMS) as TeamId[]).every((id) => /^\d{4}$/.test(pins[id])) && new Set(Object.values(pins)).size === 3 && !Object.values(pins).includes(gmPin);
  const changed = savedPins !== null && (Object.keys(TEAMS) as TeamId[]).some((id) => pins[id] !== savedPins[id]);
  const save = async () => {
    setSavingPins(true);
    setMessage(null);
    try {
      const updated = await request("setTeamPins", pins);
      setPins(updated);
      setSavedPins(updated);
      setMessage({ text: "三隊登入碼已即時更新；已登入隊伍下次操作時需要使用新碼重新登入。", good: true });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "更新失敗。", good: false });
    } finally {
      setSavingPins(false);
    }
  };

  return <section className="gm-pin-panel">
    <div className="section-heading"><div><span>ACCESS CONTROL</span><h2>隊伍登入碼</h2></div><small>GM 可隨時修改・每隊必須不同</small></div>
    <div className="gm-pin-editor">
      {(Object.keys(TEAMS) as TeamId[]).map((id) => <label key={id} style={{ "--team": TEAMS[id].color } as React.CSSProperties}><span>⚑ {displayTeamName(state, id)}</span><input aria-label={`${displayTeamName(state, id)}登入碼`} inputMode="numeric" autoComplete="off" maxLength={4} value={pins[id]} disabled={loadingPins || savingPins} onChange={(event) => setPins((current) => ({ ...current, [id]: event.target.value.replace(/\D/g, "").slice(0, 4) }))} /></label>)}
      <button disabled={loadingPins || savingPins || !valid || !changed} onClick={() => void save()}>{savingPins ? "更新中…" : "更新三隊登入碼"}</button>
    </div>
    <p className="gm-pin-note">只可使用 4 位數字；三隊不可相同，亦不可與 GM 登入碼相同。</p>
    {message && <div className={`gm-pin-message ${message.good ? "good" : "bad"}`}>{message.good ? "✓" : "!"} {message.text}</div>}
  </section>;
}

function GMTeamSummary({ state, teamId }: { state: GameState; teamId: TeamId }) {
  const team = state.teams[teamId];
  return <article className="gm-team-summary" style={{ "--team": TEAMS[teamId].color } as React.CSSProperties}><header><span>⚑ {team.name}</span><b>${team.cash}</b></header><div className="gm-team-location"><small>目前位置</small><b>{STATIONS[team.stationIndex].name}</b><span>{team.stationIndex + 1}/{STATIONS.length}</span></div><div className="mini-resources">{RESOURCE_KEYS.map((key) => <span key={key} style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon}<b>{team.resources[key]}</b></span>)}</div><div className="project-progress"><span style={{ width: `${team.projects.length * 25}%` }} /><b>{team.projects.length}/4 認證</b></div></article>;
}

function GMApprovals({ state, busy, act }: { state: GameState; busy: boolean; act: ActionFn }) {
  const challenges = state.challenges.filter((item) => item.status === "pending");
  const publicClaims = (state.publicTaskClaims ?? []).filter((item) => item.status === "pending");
  const lunchSubmissions = (state.lunchContractClaims ?? []).filter((item) => item.status === "submitted");
  const auctionSubmissions = state.taskRuns.filter((item) => item.status === "submitted" && item.taskId === "C2");
  const jointSubmissions = state.taskRuns.filter((item) => item.status === "submitted" && item.taskId === "C5");
  const submissions = state.taskRuns.filter((item) => item.status === "submitted" && !["C2", "C5"].includes(item.taskId));
  const taskPending = auctionSubmissions.length + jointSubmissions.length + submissions.length;
  return <div className="content-stack">
    <PageTitle eyebrow="GM ADJUDICATION" title="挑戰與任務審批" text="只按現場觀察裁決；業權放棄、交貨扣款、競投、聯合合約及任務獎勵會由系統原子處理。" action={<div className="pending-total">{challenges.length + publicClaims.length + lunchSubmissions.length + taskPending} 待處理</div>} />
    <section><div className="section-heading"><div><span>MORNING CLAIMS</span><h2>生產點挑戰</h2></div></div><div className="approval-list">{challenges.length === 0 && <div className="empty-state">未有等待裁決的佔領挑戰。</div>}{challenges.map((challenge) => { const property = state.properties.find((item) => item.id === challenge.propertyId); return <article className="approval-card" key={challenge.id}><div className="approval-code">{challenge.propertyId}</div><div><small>{formatTime(challenge.createdAt)}・{property?.owner ? `目前由 ${displayTeamName(state, property.owner)} 持有` : "中立生產點"}{challenge.elapsedMs !== undefined ? `・成績 ${formatChallengeTime(challenge.elapsedMs)}` : ""}</small><h3>{displayTeamName(state, challenge.teamId)} 挑戰「{property?.title}」</h3><p>{challenge.elapsedMs !== undefined && <><b>{challenge.benchmarkMs === undefined ? "首隊建立紀錄" : `快過當時紀錄 ${formatChallengeTime(challenge.benchmarkMs)}`}</b>・</>}勝出後生產 <b style={{ color: RESOURCES[challenge.resource].color }}>{RESOURCES[challenge.resource].name}</b>{challenge.abandonPropertyId ? `，並放棄 ${challenge.abandonPropertyId}` : ""}</p></div><div className="approval-actions"><button className="reject" disabled={busy} onClick={() => void act("resolveChallenge", { challengeId: challenge.id, won: false })}>挑戰失敗</button><button className="approve" disabled={busy} onClick={() => void act("resolveChallenge", { challengeId: challenge.id, won: true })}>確認佔領</button></div></article>; })}</div></section>
    <section><div className="section-heading"><div><span>PUBLIC TASKS</span><h2>公共任務審批</h2></div><small>每組每項最多完成一次</small></div><div className="approval-list">{publicClaims.length === 0 && <div className="empty-state">未有公共任務等待裁決。</div>}{publicClaims.map((claim) => { const task = PUBLIC_TASKS.find((item) => item.id === claim.taskId); const prompt = task ? task.prompts[claim.promptIndex ?? publicPromptIndex(claim.id, task.prompts.length)] : null; return <article className="approval-card" key={claim.id}><div className="approval-code">{claim.taskId}</div><div><small>{formatTime(claim.createdAt)}・各隊獨立完成</small><h3>{displayTeamName(state, claim.teamId)}：{task?.title}</h3><p>本隊題目：<b>{prompt?.title ?? "—"}</b><br />通過後一次性生產 <b style={{ color: task ? RESOURCES[task.reward].color : undefined }}>{task ? `${RESOURCES[task.reward].name} ×1` : "資源"}</b></p></div><div className="approval-actions"><button className="reject" disabled={busy} onClick={() => void act("resolvePublicTask", { claimId: claim.id, approved: false })}>未完成・可重做</button><button className="approve" disabled={busy} onClick={() => void act("resolvePublicTask", { claimId: claim.id, approved: true })}>通過＋生產</button></div></article>; })}</div></section>
    <section><div className="section-heading"><div><span>LUNCH DELIVERIES</span><h2>午餐合約收貨</h2></div><small>確認時先扣資源及付款</small></div><div className="approval-list">{lunchSubmissions.length === 0 && <div className="empty-state">未有午餐合約等待收貨。</div>}{lunchSubmissions.map((claim) => { const contract = LUNCH_CONTRACTS.find((item) => item.id === claim.contractId); return <article className="approval-card" key={claim.id}><div className="approval-code">{claim.contractId}</div><div><small>{claim.submittedAt ? formatTime(claim.submittedAt) : ""}・先到先得合約</small><h3>{displayTeamName(state, claim.teamId)}：{contract?.title}</h3><p>交貨 <b>{describeResources(claim.resources)}</b>・應付 <b className="money">${contract?.cash ?? 0}</b></p></div><div className="approval-actions"><button className="reject" disabled={busy} onClick={() => void act("resolveLunchContract", { claimId: claim.id, approved: false })}>退回補貨</button><button className="approve" disabled={busy} onClick={() => void act("resolveLunchContract", { claimId: claim.id, approved: true })}>確認收貨＋付款</button></div></article>; })}</div></section>
    <section><div className="section-heading"><div><span>SEALED AUCTION</span><h2>C2 泊位密封競投</h2></div><button className="small-action" disabled={busy || auctionSubmissions.length === 0} onClick={() => { if (window.confirm(`確定揭開 ${auctionSubmissions.length} 份出價並立即結算？`)) void act("resolveAuction"); }}>揭標結算</button></div><div className="approval-list">{auctionSubmissions.length === 0 && <div className="empty-state">未有密封出價。</div>}{auctionSubmissions.map((run) => <article className="approval-card" key={run.id}><div className="approval-code">C2</div><div><small>{run.submittedAt ? formatTime(run.submittedAt) : ""}・密封至GM揭標</small><h3>{displayTeamName(state, run.teamId)} 出價 <span className="money">${run.bid ?? 0}</span></h3><p>勝出預選：{run.auctionReward ? describeResources(run.auctionReward) : "—"}</p></div><div className="approval-actions"><button className="reject" disabled={busy} onClick={() => void act("resolveTask", { runId: run.id, approved: false })}>退回改價</button></div></article>)}</div></section>
    <section><div className="section-heading"><div><span>JOINT CONTRACT</span><h2>C5 三隊拼船單</h2></div><button className="small-action" disabled={busy || jointSubmissions.length < 3} onClick={() => { if (window.confirm(`確定核對三隊合約碼？各隊資源已在提交時扣起；每份會於遊戲結束時按 $${C5_SETTLEMENT_PER_RESOURCE} 結算。`)) void act("resolveJointContract"); }}>確認三隊交貨</button></div><div className="approval-list">{jointSubmissions.length === 0 && <div className="empty-state">等待三隊使用同一合約碼提交；提交資源會即時扣起，合計須涵蓋最少3種資源。</div>}{jointSubmissions.map((run) => { const units = run.contribution ? RESOURCE_KEYS.reduce((sum, key) => sum + run.contribution![key], 0) : 0; return <article className="approval-card" key={run.id}><div className="approval-code">C5</div><div><small>{run.submittedAt ? formatTime(run.submittedAt) : ""}・合約碼 {run.contractCode ?? "—"}</small><h3>{displayTeamName(state, run.teamId)} 貢獻（已扣起）</h3><p>{run.contribution ? describeResources(run.contribution) : "—"}・終局結算值 <b className="money">${units * C5_SETTLEMENT_PER_RESOURCE}</b></p></div><div className="approval-actions"><button className="reject" disabled={busy} onClick={() => void act("resolveTask", { runId: run.id, approved: false })}>退回資源更正</button></div></article>; })}</div></section>
    <section><div className="section-heading"><div><span>MISSION SUBMISSIONS</span><h2>下午任務提交</h2></div></div><div className="approval-list">{submissions.length === 0 && <div className="empty-state">未有等待確認的任務。</div>}{submissions.map((run) => { const task = AFTERNOON_TASKS.find((item) => item.id === run.taskId); return <article className="approval-card" key={run.id}><div className="approval-code">{run.taskId}</div><div><small>{run.submittedAt ? formatTime(run.submittedAt) : ""}・{task ? STATIONS[task.station].name : ""}</small><h3>{displayTeamName(state, run.teamId)}：{task?.title}</h3><p>{run.note || "玩家沒有附加備註。"}{run.stakeReward ? `・補貨 ${describeResources(run.stakeReward)}` : run.rewardResource ? `・自選 ${RESOURCES[run.rewardResource].name}` : ""}</p></div><div className="approval-actions"><button className="reject" disabled={busy} onClick={() => void act("resolveTask", { runId: run.id, approved: false })}>退回重做</button>{state.teams[run.teamId].retries > 0 && <button disabled={busy} onClick={() => void act("resolveTask", { runId: run.id, approved: false, useRetry: true })}>用重試</button>}<button className="approve" disabled={busy} onClick={() => void act("resolveTask", { runId: run.id, approved: true })}>通過＋發獎</button></div></article>; })}</div></section>
  </div>;
}

function GMAssets({ state, busy, act }: { state: GameState; busy: boolean; act: ActionFn }) {
  const [adjustTeam, setAdjustTeam] = useState<TeamId>("red");
  const [target, setTarget] = useState<"cash" | ResourceKey>("cash");
  const [delta, setDelta] = useState(1);
  return <div className="content-stack">
    <PageTitle eyebrow="ECONOMY CONTROL" title="資產與市場" text="處理午膳合約、特殊獎勵或現場更正。所有手動調整都會寫入活動紀錄。" />
    <section className="manual-adjust"><label>隊伍<select value={adjustTeam} onChange={(event) => setAdjustTeam(event.target.value as TeamId)}>{(Object.keys(TEAMS) as TeamId[]).map((id) => <option key={id} value={id}>{displayTeamName(state, id)}</option>)}</select></label><label>資產<select value={target} onChange={(event) => setTarget(event.target.value as "cash" | ResourceKey)}><option value="cash">現金</option>{RESOURCE_KEYS.map((key) => <option key={key} value={key}>{RESOURCES[key].name}</option>)}</select></label><label>數量<input type="number" min="-20" max="20" value={delta} onChange={(event) => setDelta(Number(event.target.value))} /></label><button disabled={busy || delta === 0} onClick={() => void act("adjustTeam", { teamId: adjustTeam, target, delta })}>確認調整</button></section>
    <section><div className="section-heading"><div><span>TEAM INVENTORY</span><h2>公開資產表</h2></div></div><div className="asset-table"><div className="asset-row header"><span>隊伍</span><span>現金</span>{RESOURCE_KEYS.map((key) => <span key={key}>{RESOURCES[key].name}</span>)}<span>業權</span><span>認證</span></div>{(Object.keys(TEAMS) as TeamId[]).map((id) => <div className="asset-row" key={id}><b style={{ color: TEAMS[id].color }}>⚑ {displayTeamName(state, id)}</b><strong>${state.teams[id].cash}</strong>{RESOURCE_KEYS.map((key) => <span key={key} style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {state.teams[id].resources[key]}</span>)}<span>{state.properties.filter((item) => item.owner === id).map((item) => item.id).join(", ") || "—"}</span><span>{state.teams[id].projects.length}/4</span></div>)}</div></section>
    <section><div className="section-heading"><div><span>PROPERTIES</span><h2>六個生產點</h2></div><div className="section-actions"><a className="small-action" href="/p1-p6-challenge-record.pdf" target="_blank" rel="noreferrer">列印實體紀錄表</a><button className="small-action" disabled={busy} onClick={() => void act("runProduction")}>結算下一輪</button></div></div><div className="property-status-grid">{state.properties.map((property) => <article key={property.id}><span>{property.id}</span><div><b>{property.title}</b><small>{property.owner ? displayTeamName(state, property.owner) : "中立"}</small></div><strong style={{ color: property.resource ? RESOURCES[property.resource].color : "#71869a" }}>{property.resource ? `${RESOURCES[property.resource].icon} ${RESOURCES[property.resource].name}` : "不生產"}</strong>{property.skipNext && <i>下輪停產</i>}</article>)}</div></section>
    <section><div className="section-heading"><div><span>OFFICIAL PRICES</span><h2>市場價格</h2></div></div><div className="price-controls">{RESOURCE_KEYS.map((key) => <div key={key}><span style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name}</span><button disabled={busy || state.prices[key] <= 5} onClick={() => void act("adjustPrice", { resource: key, delta: -1 })}>−</button><b>${state.prices[key]}</b><button disabled={busy || state.prices[key] >= 8} onClick={() => void act("adjustPrice", { resource: key, delta: 1 })}>＋</button></div>)}</div></section>
  </div>;
}

function GMLog({ state, busy, act }: { state: GameState; busy: boolean; act: ActionFn }) {
  const reset = (mode: "demo" | "live") => {
    const message = mode === "live" ? "確定清除所有示範資料並正式開局？" : "確定重設為示範狀態？";
    if (window.confirm(message)) void act("reset", { mode });
  };
  return <div className="content-stack"><PageTitle eyebrow="AUDIT TRAIL" title="活動紀錄與重設" text="最近 80 項重要操作，方便 GM 追查交易、生產與裁決。" /><div className="log-list">{state.log.map((entry) => <div key={entry.id} className={entry.tone}><span>{formatTime(entry.time)}</span><i /> <p>{entry.text}</p></div>)}</div><section className="danger-zone"><div><small>DANGER ZONE</small><h2>重設遊戲房間</h2><p>正式開局會清除示範資產，三隊回復 $20、零資源、零業權及太和起點。</p></div><button disabled={busy} onClick={() => reset("demo")}>重載示範</button><button className="danger" disabled={busy} onClick={() => reset("live")}>正式開局</button></section></div>;
}
