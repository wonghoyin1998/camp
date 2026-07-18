import {
  AFTERNOON_TASKS,
  LUNCH_CONTRACTS,
  PUBLIC_TASKS,
  PROJECTS,
  PROPERTIES,
  RESOURCE_KEYS,
  RESOURCES,
  ROUTE_ZONE_ORDER,
  STATIONS,
  TEAMS,
  type ResourceKey,
  type TeamId,
} from "./game-data";

export type Resources = Record<ResourceKey, number>;
export type GamePhase = "warmup" | "morning" | "lunch" | "route" | "final";

export type TeamPins = Record<TeamId, string>;

export type TeamState = {
  id: TeamId;
  name: string;
  cash: number;
  resources: Resources;
  stationIndex: number;
  projects: string[];
  retries: number;
  twoForOne: number;
};

export type PropertyState = {
  id: string;
  title: string;
  game: string;
  owner: TeamId | null;
  resource: ResourceKey | null;
  skipNext: boolean;
};

export type Challenge = {
  id: string;
  teamId: TeamId;
  propertyId: string;
  resource: ResourceKey;
  abandonPropertyId?: string;
  status: "pending" | "won" | "lost";
  createdAt: string;
};

export type TaskRun = {
  id: string;
  taskId: string;
  teamId: TeamId;
  status: "started" | "submitted" | "completed" | "rejected";
  startedAt: string;
  /** Sequential server-assigned set; every fresh attempt receives a new set. */
  questionSet?: number;
  failedAt?: string;
  submittedAt?: string;
  note?: string;
  /** Kept for backwards compatibility with runs created before the basket upgrade. */
  rewardResource?: ResourceKey;
  marketResource?: ResourceKey;
  marketDirection?: 1 | -1;
  bid?: number;
  auctionReward?: Resources;
  contractCode?: string;
  contribution?: Resources;
  stakeType?: "cash" | "property";
  stakePropertyId?: string;
  stakeReward?: Resources;
};

export type PublicTaskClaim = {
  id: string;
  taskId: string;
  teamId: TeamId;
  status: "started" | "pending" | "completed" | "rejected";
  createdAt: string;
  promptIndex?: number;
  resolvedAt?: string;
};

export type LunchContractClaim = {
  id: string;
  contractId: string;
  teamId: TeamId;
  status: "claimed" | "submitted" | "completed";
  resources: Resources;
  createdAt: string;
  submittedAt?: string;
  resolvedAt?: string;
};

export type TradeSide = {
  cash: number;
  resources: Resources;
  propertyId?: string;
};

export type Trade = {
  id: string;
  from: TeamId;
  to: TeamId;
  give: TradeSide;
  receive: TradeSide;
  note: string;
  status: "open" | "completed" | "cancelled";
  createdAt: string;
  completedAt?: string;
};

export type LogEntry = {
  id: string;
  time: string;
  text: string;
  tone: "info" | "good" | "warn";
};

export type FinalScore = {
  teamId: TeamId;
  qualified: boolean;
  projects: number;
  cash: number;
  rank: number;
};

export type GameState = {
  title: string;
  camp: string;
  roomCode: string;
  phase: GamePhase;
  tasksOpen: boolean;
  gpsStrict: boolean;
  deadline: string;
  productionTick: number;
  prices: Resources;
  teams: Record<TeamId, TeamState>;
  properties: PropertyState[];
  challenges: Challenge[];
  publicTaskClaims: PublicTaskClaim[];
  lunchContractClaims: LunchContractClaim[];
  taskRuns: TaskRun[];
  trades: Trade[];
  log: LogEntry[];
  settled: boolean;
  finalScores: FinalScore[];
  updatedAt: string;
};

const emptyResources = (): Resources => ({ energy: 0, intel: 0, gear: 0, network: 0 });

function team(id: TeamId, demo: boolean): TeamState {
  const demoResources: Record<TeamId, Resources> = {
    red: { energy: 3, intel: 2, gear: 1, network: 4 },
    blue: { energy: 2, intel: 4, gear: 2, network: 1 },
    gold: { energy: 4, intel: 1, gear: 3, network: 2 },
  };
  return {
    id,
    name: TEAMS[id].name,
    cash: demo ? (id === "red" ? 20 : id === "blue" ? 18 : 23) : 20,
    resources: demo ? demoResources[id] : emptyResources(),
    stationIndex: demo ? 5 : 0,
    projects: [],
    retries: 0,
    twoForOne: 0,
  };
}

export function makeInitialState(mode: "demo" | "live" = "demo"): GameState {
  const demo = mode === "demo";
  const demoOwners: Array<[TeamId, ResourceKey]> = [
    ["red", "energy"],
    ["blue", "intel"],
    ["gold", "gear"],
    ["red", "network"],
    ["blue", "energy"],
    ["gold", "intel"],
  ];

  return {
    title: "棋航者：最後登船令",
    camp: "Board Game 導師訓練計劃・訓練營會",
    roomCode: "HH1530",
    phase: demo ? "route" : "warmup",
    tasksOpen: demo,
    gpsStrict: false,
    deadline: "14:45",
    productionTick: demo ? 3 : 0,
    prices: { energy: 6, intel: 6, gear: 6, network: 6 },
    teams: {
      red: team("red", demo),
      blue: team("blue", demo),
      gold: team("gold", demo),
    },
    properties: PROPERTIES.map((property, index) => ({
      ...property,
      owner: demo ? demoOwners[index][0] : null,
      resource: demo ? demoOwners[index][1] : null,
      skipNext: false,
    })),
    challenges: [],
    publicTaskClaims: [],
    lunchContractClaims: [],
    taskRuns: [],
    trades: [],
    settled: false,
    finalScores: [],
    log: [
      {
        id: crypto.randomUUID(),
        time: new Date().toISOString(),
        text: demo ? "示範房間已建立，GPS 驗證暫時關閉。" : "正式遊戲已建立。",
        tone: "info",
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function isTeamId(value: unknown): value is TeamId {
  return value === "red" || value === "blue" || value === "gold";
}

function isResource(value: unknown): value is ResourceKey {
  return RESOURCE_KEYS.includes(value as ResourceKey);
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function log(state: GameState, text: string, tone: LogEntry["tone"] = "info") {
  state.log.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), text, tone });
  state.log = state.log.slice(0, 80);
  state.updatedAt = new Date().toISOString();
}

function teamName(state: GameState, id: TeamId) {
  return state.teams[id]?.name ?? TEAMS[id].name;
}

function ownedProperties(state: GameState, teamId: TeamId) {
  return state.properties.filter((property) => property.owner === teamId);
}

function requireTeam(payload: Record<string, unknown>) {
  if (!isTeamId(payload.teamId)) throw new Error("隊伍資料無效。請重新登入。");
  return payload.teamId;
}

function requireResource(value: unknown) {
  if (!isResource(value)) throw new Error("請選擇有效資源。");
  return value;
}

function hasResources(teamState: TeamState, cost: Partial<Resources>) {
  return RESOURCE_KEYS.every((key) => teamState.resources[key] >= (cost[key] ?? 0));
}

function subtractResources(teamState: TeamState, cost: Partial<Resources>) {
  for (const key of RESOURCE_KEYS) teamState.resources[key] -= cost[key] ?? 0;
}

function addResources(teamState: TeamState, reward: Partial<Resources>) {
  for (const key of RESOURCE_KEYS) teamState.resources[key] += reward[key] ?? 0;
}

function nextQuestionSet(state: GameState, taskId: string) {
  return state.taskRuns
    .filter((run) => run.taskId === taskId)
    .reduce((highest, run) => Math.max(highest, run.questionSet ?? -1), -1) + 1;
}

const RESERVED_TASK_SLOT_STATUSES: TaskRun["status"][] = ["started", "submitted", "completed"];

function occupiedTaskSlots(state: GameState, taskId: string) {
  return state.taskRuns.filter(
    (run) => run.taskId === taskId && RESERVED_TASK_SLOT_STATUSES.includes(run.status),
  ).length;
}

function legacyPromptIndex(seed: string, length: number) {
  return Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0) % length;
}

function parseSide(value: unknown): TradeSide {
  const raw = (value ?? {}) as Record<string, unknown>;
  const rawResources = (raw.resources ?? {}) as Record<string, unknown>;
  const side: TradeSide = {
    cash: number(raw.cash),
    resources: {
      energy: number(rawResources.energy),
      intel: number(rawResources.intel),
      gear: number(rawResources.gear),
      network: number(rawResources.network),
    },
  };
  if (typeof raw.propertyId === "string" && raw.propertyId) side.propertyId = raw.propertyId;
  return side;
}

function sideHasValue(side: TradeSide) {
  return side.cash > 0 || RESOURCE_KEYS.some((key) => side.resources[key] > 0) || Boolean(side.propertyId);
}

function tradeAssetTypeCount(give: TradeSide, receive: TradeSide) {
  let count = 0;
  if (give.cash > 0 || receive.cash > 0) count += 1;
  if (RESOURCE_KEYS.some((key) => give.resources[key] > 0 || receive.resources[key] > 0)) count += 1;
  if (give.propertyId || receive.propertyId) count += 1;
  return count;
}

function teamOwnsSide(state: GameState, teamId: TeamId, side: TradeSide) {
  const teamState = state.teams[teamId];
  if (teamState.cash < side.cash || !hasResources(teamState, side.resources)) return false;
  if (side.propertyId) {
    const property = state.properties.find((item) => item.id === side.propertyId);
    if (!property || property.owner !== teamId) return false;
  }
  return true;
}

function transferSide(state: GameState, from: TeamId, to: TeamId, side: TradeSide) {
  state.teams[from].cash -= side.cash;
  state.teams[to].cash += side.cash;
  subtractResources(state.teams[from], side.resources);
  addResources(state.teams[to], side.resources);
  if (side.propertyId) {
    const property = state.properties.find((item) => item.id === side.propertyId);
    if (property) property.owner = to;
  }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371000;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

export function mutateGame(state: GameState, action: string, payload: Record<string, unknown>) {
  if (action === "reset") {
    return makeInitialState(payload.mode === "live" ? "live" : "demo");
  }

  // Older rooms could retain an accidentally opened route flag after returning
  // to morning or lunch. Normalize it on the next successful mutation.
  if (state.phase !== "route" && state.tasksOpen) state.tasksOpen = false;

  if (action === "setPhase") {
    const phase = payload.phase;
    if (!["warmup", "morning", "lunch", "route", "final"].includes(String(phase))) {
      throw new Error("遊戲階段無效。");
    }
    const previousPhase = state.phase;
    state.phase = phase as GamePhase;
    if (state.phase !== "route") state.tasksOpen = false;
    else if (previousPhase !== "route") state.tasksOpen = true;
    log(state, `GM 將遊戲切換至「${phase}」階段。`);
    return state;
  }

  if (action === "setTasksOpen") {
    const open = Boolean(payload.open);
    if (open && state.phase !== "route") throw new Error("必須先切換至 13:00「航線開拓」階段，才可開放下午任務。");
    state.tasksOpen = open;
    log(state, state.tasksOpen ? "下午任務已開放。" : "14:45 任務全面截止，未提交挑戰亦停止。", state.tasksOpen ? "good" : "warn");
    return state;
  }

  if (action === "setGpsStrict") {
    state.gpsStrict = Boolean(payload.strict);
    log(state, `GPS 實地驗證已${state.gpsStrict ? "啟用" : "切換為示範模式"}。`);
    return state;
  }

  if (action === "runProduction") {
    let produced = 0;
    for (const property of state.properties) {
      if (!property.owner || !property.resource) continue;
      if (property.skipNext) {
        property.skipNext = false;
        continue;
      }
      state.teams[property.owner].resources[property.resource] += 1;
      produced += 1;
    }
    state.productionTick += 1;
    log(state, `第 ${state.productionTick} 次生產結算：共生產 ${produced} 份資源。`, "good");
    return state;
  }

  if (action === "adjustTeam") {
    const teamId = requireTeam(payload);
    const target = String(payload.target ?? "cash");
    const delta = Math.trunc(Number(payload.delta ?? 0));
    if (!Number.isFinite(delta) || Math.abs(delta) > 20) throw new Error("調整數值無效。");
    if (target === "cash") state.teams[teamId].cash = Math.max(0, state.teams[teamId].cash + delta);
    else {
      const resource = requireResource(target);
      state.teams[teamId].resources[resource] = Math.max(0, state.teams[teamId].resources[resource] + delta);
    }
    log(state, `GM 調整了${teamName(state, teamId)}的${target}（${delta >= 0 ? "+" : ""}${delta}）。`);
    return state;
  }

  if (action === "renameTeam") {
    const teamId = requireTeam(payload);
    const rawName = String(payload.name ?? "").trim().replace(/\s+/g, " ");
    const name = Array.from(rawName).slice(0, 12).join("");
    if (!name) throw new Error("組名不可留空。");
    if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error("組名包含無效字元。");
    if (Object.values(state.teams).some((item) => item.id !== teamId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error("這個組名已被另一組使用。");
    }
    const previousName = state.teams[teamId].name;
    if (previousName === name) throw new Error("請輸入一個新組名。");
    state.teams[teamId].name = name;
    log(state, `${previousName} 已改名為「${name}」。`, "good");
    return state;
  }

  if (action === "claimPublicTask") {
    const teamId = requireTeam(payload);
    const taskId = String(payload.taskId ?? "");
    const task = PUBLIC_TASKS.find((item) => item.id === taskId);
    if (!task) throw new Error("公共任務不存在。");
    if (state.phase !== "morning") throw new Error("公共任務只在太和佔領戰期間開放。");
    const claims = state.publicTaskClaims ?? (state.publicTaskClaims = []);
    if (claims.some((item) => item.taskId === taskId && item.teamId === teamId && ["started", "pending", "completed"].includes(item.status))) {
      throw new Error("你隊已經挑戰或完成過這項公共任務。");
    }
    if (claims.some((item) => item.teamId === teamId && ["started", "pending"].includes(item.status))) {
      throw new Error("你隊已有一項公共任務進行中，完成後再搶下一項。");
    }
    const promptIndexFor = (item: PublicTaskClaim) => item.promptIndex ?? legacyPromptIndex(item.id, task.prompts.length);
    const usedByEveryone = new Set(claims.filter((item) => item.taskId === taskId).map(promptIndexFor));
    const usedByTeam = new Set(claims.filter((item) => item.taskId === taskId && item.teamId === teamId).map(promptIndexFor));
    const promptIndexes = task.prompts.map((_, index) => index);
    const promptIndex = promptIndexes.find((index) => !usedByEveryone.has(index))
      ?? promptIndexes.find((index) => !usedByTeam.has(index))
      ?? (claims.filter((item) => item.taskId === taskId).length % task.prompts.length);
    claims.push({
      id: crypto.randomUUID(),
      taskId,
      teamId,
      status: "started",
      promptIndex,
      createdAt: new Date().toISOString(),
    });
    log(state, `${teamName(state, teamId)}開始公共任務 ${taskId}「${task.title}」。`, "warn");
    return state;
  }

  if (action === "submitPublicTask") {
    const teamId = requireTeam(payload);
    if (state.phase !== "morning") throw new Error("公共任務只在太和佔領戰期間開放。");
    const claims = state.publicTaskClaims ?? (state.publicTaskClaims = []);
    const claim = claims.find((item) => item.id === payload.claimId && item.teamId === teamId && item.status === "started");
    if (!claim) throw new Error("找不到進行中的公共任務。");
    claim.status = "pending";
    log(state, `${teamName(state, teamId)}完成公共任務 ${claim.taskId}，等待 GM 核對。`, "warn");
    return state;
  }

  if (action === "failPublicTask") {
    const teamId = requireTeam(payload);
    const claims = state.publicTaskClaims ?? (state.publicTaskClaims = []);
    const claim = claims.find((item) => item.id === payload.claimId && item.teamId === teamId && item.status === "started");
    if (!claim) throw new Error("找不到可標記失敗的公共任務。");
    claim.status = "rejected";
    claim.resolvedAt = new Date().toISOString();
    log(state, `${teamName(state, teamId)}標記公共任務 ${claim.taskId} 失敗；下次重試會改用新題。`, "warn");
    return state;
  }

  if (action === "resolvePublicTask") {
    const claims = state.publicTaskClaims ?? (state.publicTaskClaims = []);
    const claim = claims.find((item) => item.id === payload.claimId && item.status === "pending");
    if (!claim) throw new Error("公共任務已處理或不存在。");
    const task = PUBLIC_TASKS.find((item) => item.id === claim.taskId);
    if (!task) throw new Error("公共任務資料不存在。");
    const approved = Boolean(payload.approved);
    claim.status = approved ? "completed" : "rejected";
    claim.resolvedAt = new Date().toISOString();
    if (approved) {
      state.teams[claim.teamId].resources[task.reward] += 1;
      log(state, `${teamName(state, claim.teamId)}完成 ${task.id}，一次性生產 ${RESOURCES[task.reward].name} ×1。`, "good");
    } else {
      log(state, `${teamName(state, claim.teamId)}未完成 ${task.id}，該隊可重新挑戰。`, "warn");
    }
    return state;
  }

  if (action === "claimLunchContract") {
    const teamId = requireTeam(payload);
    const contractId = String(payload.contractId ?? "");
    const contract = LUNCH_CONTRACTS.find((item) => item.id === contractId);
    if (!contract) throw new Error("午餐合約不存在。");
    if (state.phase !== "lunch") throw new Error("午餐合約只在 12:15–13:00 開放接取。");
    const claims = state.lunchContractClaims ?? (state.lunchContractClaims = []);
    if (claims.some((item) => item.contractId === contractId)) {
      throw new Error("這份合約剛剛已被其他隊接取。");
    }
    if (claims.some((item) => item.teamId === teamId)) {
      throw new Error("每隊只可接取一份午餐合約。");
    }
    claims.push({
      id: crypto.randomUUID(),
      contractId,
      teamId,
      status: "claimed",
      resources: emptyResources(),
      createdAt: new Date().toISOString(),
    });
    log(state, `${teamName(state, teamId)}先到先得接取 ${contractId}「${contract.title}」。`, "warn");
    return state;
  }

  if (action === "releaseLunchContract") {
    const teamId = requireTeam(payload);
    const claims = state.lunchContractClaims ?? (state.lunchContractClaims = []);
    const index = claims.findIndex((item) => item.id === payload.claimId && item.teamId === teamId && item.status === "claimed");
    if (index < 0) throw new Error("這份合約不可放棄，可能已經提交交貨。");
    const [claim] = claims.splice(index, 1);
    log(state, `${teamName(state, teamId)}放棄午餐合約 ${claim.contractId}，合約重新開放。`, "warn");
    return state;
  }

  if (action === "submitLunchContract") {
    const teamId = requireTeam(payload);
    if (state.phase !== "lunch") throw new Error("午餐交貨已經截止。");
    const claims = state.lunchContractClaims ?? (state.lunchContractClaims = []);
    const claim = claims.find((item) => item.id === payload.claimId && item.teamId === teamId && item.status === "claimed");
    if (!claim) throw new Error("找不到可交貨的午餐合約。");
    const contract = LUNCH_CONTRACTS.find((item) => item.id === claim.contractId);
    if (!contract) throw new Error("午餐合約資料不存在。");
    const resources = emptyResources();
    if (contract.cost) {
      const fixedCost = contract.cost as Partial<Resources>;
      for (const key of RESOURCE_KEYS) resources[key] = fixedCost[key] ?? 0;
    } else {
      const selected = parseSide({ resources: payload.resources }).resources;
      const total = RESOURCE_KEYS.reduce((sum, key) => sum + selected[key], 0);
      if (total !== 3) throw new Error("混合批發單必須交出剛好 3 份資源。");
      for (const key of RESOURCE_KEYS) resources[key] = selected[key];
    }
    if (!hasResources(state.teams[teamId], resources)) throw new Error("現有資源不足，請先交易或向市場購入。");
    claim.resources = resources;
    claim.status = "submitted";
    claim.submittedAt = new Date().toISOString();
    log(state, `${teamName(state, teamId)}提交午餐合約 ${claim.contractId} 交貨，等待 GM 收貨。`, "warn");
    return state;
  }

  if (action === "resolveLunchContract") {
    const claims = state.lunchContractClaims ?? (state.lunchContractClaims = []);
    const claim = claims.find((item) => item.id === payload.claimId && item.status === "submitted");
    if (!claim) throw new Error("午餐交貨已處理或不存在。");
    const contract = LUNCH_CONTRACTS.find((item) => item.id === claim.contractId);
    if (!contract) throw new Error("午餐合約資料不存在。");
    if (!Boolean(payload.approved)) {
      claim.status = "claimed";
      claim.submittedAt = undefined;
      log(state, `${teamName(state, claim.teamId)}的午餐交貨被退回，可補貨後再提交。`, "warn");
      return state;
    }
    const target = state.teams[claim.teamId];
    if (!hasResources(target, claim.resources)) throw new Error("該隊現時資源不足，請退回交貨或請玩家先補貨。");
    subtractResources(target, claim.resources);
    target.cash += contract.cash;
    claim.status = "completed";
    claim.resolvedAt = new Date().toISOString();
    log(state, `${teamName(state, claim.teamId)}完成 ${claim.contractId}，扣除交貨並收取 $${contract.cash}。`, "good");
    return state;
  }

  if (action === "requestChallenge") {
    const teamId = requireTeam(payload);
    const propertyId = String(payload.propertyId ?? "");
    const property = state.properties.find((item) => item.id === propertyId);
    if (!property) throw new Error("找不到這個生產點。");
    if (state.challenges.some((item) => item.teamId === teamId && item.status === "pending")) {
      throw new Error("你隊已有一個等待裁決的挑戰。");
    }
    const resource = requireResource(payload.resource);
    const sameResourceCount = state.properties.filter((item) => item.resource === resource && item.owner).length;
    if (sameResourceCount >= 3 && property.resource !== resource) throw new Error("這種資源已達 3 個生產點上限。");
    const holdings = ownedProperties(state, teamId);
    const abandonPropertyId = typeof payload.abandonPropertyId === "string" ? payload.abandonPropertyId : undefined;
    if (holdings.length >= 2) {
      if (!abandonPropertyId || !holdings.some((item) => item.id === abandonPropertyId)) {
        throw new Error("持有 2 個業權時，挑戰前必須指定成功後放棄的現有業權。");
      }
    }
    if (property.owner === teamId) throw new Error("這個生產點已屬於你隊。");
    state.challenges.push({
      id: crypto.randomUUID(), teamId, propertyId, resource, abandonPropertyId,
      status: "pending", createdAt: new Date().toISOString(),
    });
    log(state, `${teamName(state, teamId)}挑戰 ${property.id} ${property.title}，等待 GM 裁決。`, "warn");
    return state;
  }

  if (action === "resolveChallenge") {
    const challenge = state.challenges.find((item) => item.id === payload.challengeId && item.status === "pending");
    if (!challenge) throw new Error("挑戰已處理或不存在。");
    const won = Boolean(payload.won);
    challenge.status = won ? "won" : "lost";
    if (won) {
      const property = state.properties.find((item) => item.id === challenge.propertyId);
      if (!property) throw new Error("生產點不存在。");
      if (challenge.abandonPropertyId) {
        const abandoned = state.properties.find((item) => item.id === challenge.abandonPropertyId);
        if (!abandoned || abandoned.owner !== challenge.teamId) throw new Error("預先指定的放棄業權已不再有效。");
        abandoned.owner = null;
        abandoned.resource = null;
        abandoned.skipNext = false;
      }
      property.owner = challenge.teamId;
      property.resource = challenge.resource;
      property.skipNext = false;
      state.teams[challenge.teamId].resources[challenge.resource] += 1;
      log(state, `${teamName(state, challenge.teamId)}成功佔領 ${property.id}，即時生產 1 份資源。`, "good");
    } else {
      log(state, `${teamName(state, challenge.teamId)}挑戰失敗，原有業權不受影響。`, "warn");
    }
    return state;
  }

  if (action === "retool") {
    const teamId = requireTeam(payload);
    const property = state.properties.find((item) => item.id === payload.propertyId);
    if (!property || property.owner !== teamId) throw new Error("你隊並不持有這個生產點。");
    const resource = requireResource(payload.resource);
    const count = state.properties.filter((item) => item.owner && item.resource === resource && item.id !== property.id).length;
    if (count >= 3) throw new Error("這種資源已達 3 個生產點上限。");
    const price = property.id === "P3" ? 0 : 2;
    if (state.teams[teamId].cash < price) throw new Error("現金不足以轉產。");
    state.teams[teamId].cash -= price;
    property.resource = resource;
    property.skipNext = true;
    log(state, `${teamName(state, teamId)}將 ${property.id} 轉產，並跳過下一次生產。`);
    return state;
  }

  if (action === "market") {
    const teamId = requireTeam(payload);
    const resource = requireResource(payload.resource);
    const operation = payload.operation;
    const target = state.teams[teamId];
    if (operation === "buy") {
      const price = state.prices[resource];
      if (target.cash < price) throw new Error("現金不足。");
      target.cash -= price;
      target.resources[resource] += 1;
      state.prices[resource] = Math.min(8, price + 1);
      log(state, `${teamName(state, teamId)}從官方市場買入 1 份資源。`);
    } else if (operation === "sell") {
      if (target.resources[resource] < 1) throw new Error("沒有足夠資源出售。");
      const payout = Math.max(2, state.prices[resource] - 3);
      target.resources[resource] -= 1;
      target.cash += payout;
      state.prices[resource] = Math.max(5, state.prices[resource] - 1);
      log(state, `${teamName(state, teamId)}向官方市場賣出 1 份資源。`);
    } else throw new Error("市場操作無效。");
    return state;
  }

  if (action === "convert") {
    const teamId = requireTeam(payload);
    const targetResource = requireResource(payload.targetResource);
    const target = state.teams[teamId];
    const input = parseSide({ resources: payload.resources }).resources;
    const required = target.twoForOne > 0 ? 2 : 3;
    const total = RESOURCE_KEYS.reduce((sum, key) => sum + input[key], 0);
    if (total !== required) throw new Error(`今次需要交出剛好 ${required} 份資源。`);
    if (!hasResources(target, input)) throw new Error("資源不足。");
    subtractResources(target, input);
    target.resources[targetResource] += 1;
    if (target.twoForOne > 0) target.twoForOne -= 1;
    log(state, `${teamName(state, teamId)}完成官方 ${required} 換 1。`);
    return state;
  }

  if (action === "createTrade") {
    const from = requireTeam(payload);
    if (!isTeamId(payload.to) || payload.to === from) throw new Error("請選擇另一隊作交易對象。");
    const give = parseSide(payload.give);
    const receive = parseSide(payload.receive);
    if (!sideHasValue(give) || !sideHasValue(receive)) throw new Error("雙方都必須提供最少一項資產。");
    if (!teamOwnsSide(state, from, give)) throw new Error("你隊現時沒有足夠資產提出這份報價。");
    state.trades.unshift({
      id: crypto.randomUUID(), from, to: payload.to, give, receive,
      note: String(payload.note ?? "").slice(0, 80), status: "open", createdAt: new Date().toISOString(),
    });
    log(state, `${teamName(state, from)}向${teamName(state, payload.to)}提出交易。`);
    return state;
  }

  if (action === "acceptTrade") {
    const teamId = requireTeam(payload);
    const trade = state.trades.find((item) => item.id === payload.tradeId && item.status === "open");
    if (!trade || trade.to !== teamId) throw new Error("這份交易不存在或已結束。");
    if (!teamOwnsSide(state, trade.from, trade.give) || !teamOwnsSide(state, trade.to, trade.receive)) {
      throw new Error("其中一方資產已改變，交易無法執行。");
    }
    const fromCount = ownedProperties(state, trade.from).length - (trade.give.propertyId ? 1 : 0) + (trade.receive.propertyId ? 1 : 0);
    const toCount = ownedProperties(state, trade.to).length - (trade.receive.propertyId ? 1 : 0) + (trade.give.propertyId ? 1 : 0);
    if (fromCount > 2 || toCount > 2) throw new Error("交易後會超出 2 個業權持有上限。");
    transferSide(state, trade.from, trade.to, trade.give);
    transferSide(state, trade.to, trade.from, trade.receive);
    trade.status = "completed";
    trade.completedAt = new Date().toISOString();
    log(state, `${teamName(state, trade.from)}與${teamName(state, trade.to)}完成原子交易。`, "good");
    return state;
  }

  if (action === "cancelTrade") {
    const teamId = requireTeam(payload);
    const trade = state.trades.find((item) => item.id === payload.tradeId && item.status === "open");
    if (!trade || trade.from !== teamId) throw new Error("只可取消自己提出的交易。");
    trade.status = "cancelled";
    log(state, `${teamName(state, teamId)}取消了一份交易。`);
    return state;
  }

  if (action === "craftProject") {
    const teamId = requireTeam(payload);
    const project = PROJECTS.find((item) => item.id === payload.projectId);
    if (!project) throw new Error("認證項目不存在。");
    const target = state.teams[teamId];
    if (target.projects.includes(project.id)) throw new Error("這項認證已完成。");
    if (!hasResources(target, project.cost)) throw new Error("資源組合不足。");
    subtractResources(target, project.cost);
    target.projects.push(project.id);
    if (project.id === "voyage") target.retries += 1;
    if (project.id === "pier") target.twoForOne += 1;
    log(state, `${teamName(state, teamId)}完成「${project.title}」。`, "good");
    return state;
  }

  if (action === "arrive") {
    const teamId = requireTeam(payload);
    if (state.phase !== "route") throw new Error("13:00「航線開拓」開始後才可確認下午到站。");
    const stationIndex = number(payload.stationIndex, -1);
    const target = state.teams[teamId];
    if (stationIndex < 0 || stationIndex === target.stationIndex || stationIndex >= STATIONS.length) {
      throw new Error("請選擇另一個有效車站。");
    }
    const currentStation = STATIONS[target.stationIndex];
    const nextStation = STATIONS[stationIndex];
    if (ROUTE_ZONE_ORDER[nextStation.zone] < ROUTE_ZONE_ORDER[currentStation.zone]) {
      throw new Error(`你隊已進入 ${currentStation.zone} 區，不能返回上一區。`);
    }
    if (state.gpsStrict) {
      const lat = Number(payload.lat);
      const lng = Number(payload.lng);
      const accuracy = Number(payload.accuracy);
      if (![lat, lng, accuracy].every(Number.isFinite)) throw new Error("未能取得有效 GPS 位置。");
      const station = STATIONS[stationIndex];
      const distance = haversineMeters(lat, lng, station.lat, station.lng);
      const allowance = Math.max(900, Math.min(1300, accuracy * 1.5));
      if (distance > allowance) throw new Error(`你距離${station.name}約 ${Math.round(distance)} 米，未能確認到站。`);
    }
    target.stationIndex = stationIndex;
    const zoneNote = nextStation.zone !== currentStation.zone ? `，進入 ${nextStation.zone} 區並鎖定上一區` : "";
    log(state, `${teamName(state, teamId)}確認到達 ${nextStation.name}${zoneNote}。`, "good");
    return state;
  }

  if (action === "startTask") {
    const teamId = requireTeam(payload);
    const task = AFTERNOON_TASKS.find((item) => item.id === payload.taskId);
    if (!task) throw new Error("任務不存在。");
    if (state.phase !== "route") throw new Error("下午任務要到 13:00「航線開拓」階段才可開始。");
    if (!state.tasksOpen) throw new Error("下午任務已在 14:45 截止。");
    if (state.teams[teamId].stationIndex !== task.station) throw new Error("必須身處任務所屬車站才可開始。");
    if (state.taskRuns.some((run) => run.taskId === task.id && run.teamId === teamId && run.status === "completed")) {
      throw new Error("你隊已完成這項任務。");
    }
    const existing = [...state.taskRuns].reverse().find((run) => run.taskId === task.id && run.teamId === teamId && ["started", "submitted", "rejected"].includes(run.status));
    const needsNewSlot = !existing || existing.status === "rejected";
    if (task.capacity && needsNewSlot && occupiedTaskSlots(state, task.id) >= task.capacity) {
      throw new Error(`限量任務 ${task.id} 的 ${task.capacity} 個名額已被搶完。`);
    }
    if (existing?.status === "rejected") {
      existing.status = "started";
      existing.startedAt = new Date().toISOString();
      existing.submittedAt = undefined;
      existing.failedAt = undefined;
      existing.questionSet = nextQuestionSet(state, task.id);
      log(state, `${teamName(state, teamId)}重新搶得 ${task.id}「${task.title}」${task.capacity ? `限量名額（${occupiedTaskSlots(state, task.id)}/${task.capacity}）` : ""}。`, task.capacity ? "warn" : "info");
    } else if (!existing) {
      state.taskRuns.push({ id: crypto.randomUUID(), taskId: task.id, teamId, status: "started", startedAt: new Date().toISOString(), questionSet: nextQuestionSet(state, task.id) });
      log(state, `${teamName(state, teamId)}開始挑戰 ${task.id}「${task.title}」${task.capacity ? `，並搶得限量名額（${occupiedTaskSlots(state, task.id)}/${task.capacity}）` : ""}。`, task.capacity ? "warn" : "info");
    }
    return state;
  }

  if (action === "failTask") {
    const teamId = requireTeam(payload);
    const run = [...state.taskRuns].reverse().find((item) => item.taskId === payload.taskId && item.teamId === teamId && item.status === "started");
    if (!run) throw new Error("找不到可標記失敗的進行中任務。");
    run.status = "rejected";
    run.failedAt = new Date().toISOString();
    run.note = "玩家主動標記本次任務失敗";
    const task = AFTERNOON_TASKS.find((item) => item.id === run.taskId);
    log(state, `${teamName(state, teamId)}標記 ${run.taskId} 挑戰失敗；下次重試會自動改用新題${task?.capacity ? "，限量名額已即時釋放" : ""}。`, "warn");
    return state;
  }

  if (action === "submitTask") {
    const teamId = requireTeam(payload);
    if (state.phase !== "route") throw new Error("下午任務要到 13:00「航線開拓」階段才可提交。");
    if (!state.tasksOpen) throw new Error("14:45 任務已全面截止，不能再提交。");
    const run = [...state.taskRuns].reverse().find((item) => item.taskId === payload.taskId && item.teamId === teamId && item.status === "started");
    if (!run) throw new Error("請先開始任務，或任務已經提交。");
    run.status = "submitted";
    run.submittedAt = new Date().toISOString();
    run.note = String(payload.note ?? "").slice(0, 240);
    if (run.taskId === "B5") {
      const eligibleTrade = state.trades.some((trade) =>
        trade.status === "completed" &&
        (trade.from === teamId || trade.to === teamId) &&
        Boolean(trade.completedAt) &&
        new Date(trade.completedAt as string) >= new Date(run.startedAt) &&
        tradeAssetTypeCount(trade.give, trade.receive) >= 2
      );
      if (!eligibleTrade) throw new Error("未找到開始任務後完成、並包含最少兩類資產的交易。");
    }
    if (run.taskId === "C2") {
      const bid = number(payload.bid);
      if (bid < 1 || bid > state.teams[teamId].cash) throw new Error("密封出價必須介乎 $1 與隊伍現金之間。");
      const reward = parseSide({ resources: payload.auctionReward }).resources;
      if (RESOURCE_KEYS.reduce((sum, key) => sum + reward[key], 0) !== 2) throw new Error("請預先選擇剛好2份勝出資源。");
      run.bid = bid;
      run.auctionReward = reward;
    }
    if (run.taskId === "C5") {
      const contribution = parseSide({ resources: payload.contribution }).resources;
      if (RESOURCE_KEYS.reduce((sum, key) => sum + contribution[key], 0) < 1) throw new Error("每隊最少貢獻1份資源。");
      if (!hasResources(state.teams[teamId], contribution)) throw new Error("現有資源不足以作出這份貢獻。");
      const contractCode = String(payload.contractCode ?? "").trim().toUpperCase().slice(0, 8);
      if (!/^[A-Z0-9]{3,8}$/.test(contractCode)) throw new Error("請輸入三隊共同使用的3–8位英數合約碼。");
      run.contribution = contribution;
      run.contractCode = contractCode;
    }
    if (run.taskId === "C6") {
      if (payload.stakeType !== "cash" && payload.stakeType !== "property") throw new Error("請選擇支付現金或抵押業權。");
      run.stakeType = payload.stakeType;
      const reward = parseSide({ resources: payload.stakeReward }).resources;
      const rewardTotal = RESOURCE_KEYS.reduce((sum, key) => sum + reward[key], 0);
      if (run.stakeType === "cash") {
        if (state.teams[teamId].cash < 7) throw new Error("現金不足以支付 $7。");
        if (rewardTotal !== 2) throw new Error("現金方案必須選擇剛好 2 份資源。");
        run.stakePropertyId = undefined;
      } else {
        const property = state.properties.find((item) => item.id === payload.stakePropertyId && item.owner === teamId);
        if (!property) throw new Error("所選業權已不再屬於你隊。");
        if (rewardTotal !== 3) throw new Error("業權方案必須選擇剛好 3 份資源。");
        if (RESOURCE_KEYS.some((key) => reward[key] > 2)) throw new Error("業權方案同一資源最多選擇 2 份。");
        run.stakePropertyId = property.id;
      }
      run.stakeReward = reward;
    }
    log(state, `${teamName(state, teamId)}提交 ${run.taskId}，等待 GM 確認。`, "warn");
    return state;
  }

  if (action === "resolveAuction") {
    const runs = state.taskRuns.filter((run) => run.taskId === "C2" && run.status === "submitted" && run.bid);
    if (runs.length === 0) throw new Error("未有密封出價可揭標。");
    runs.sort((a, b) => (b.bid ?? 0) - (a.bid ?? 0) || String(a.submittedAt).localeCompare(String(b.submittedAt)));
    const winner = runs[0];
    const winningBid = winner.bid ?? 0;
    if (state.teams[winner.teamId].cash < winningBid) throw new Error(`${teamName(state, winner.teamId)}現金已不足以支付勝出價。`);
    state.teams[winner.teamId].cash -= winningBid;
    addResources(state.teams[winner.teamId], winner.auctionReward ?? {});
    if (runs[1]) state.teams[runs[1].teamId].twoForOne += 1;
    for (const run of runs) run.status = "completed";
    log(state, `泊位密封競投揭標：${teamName(state, winner.teamId)}以 $${winningBid} 勝出${runs[1] ? `，${teamName(state, runs[1].teamId)}取得一次2換1` : ""}。`, "good");
    return state;
  }

  if (action === "resolveJointContract") {
    const runs = (Object.keys(state.teams) as TeamId[]).map((teamId) =>
      [...state.taskRuns].reverse().find((run) => run.taskId === "C5" && run.teamId === teamId && run.status === "submitted")
    );
    if (runs.some((run) => !run)) throw new Error("三隊都提交同一份三隊拼船單後才可結算。");
    const confirmed = runs as TaskRun[];
    const codes = new Set(confirmed.map((run) => run.contractCode));
    if (codes.size !== 1) throw new Error("三隊合約碼不一致，請退回更正。");
    const coverage = new Set<ResourceKey>();
    for (const run of confirmed) {
      if (!run.contribution || !hasResources(state.teams[run.teamId], run.contribution)) throw new Error(`${teamName(state, run.teamId)}資源不足以履行貢獻。`);
      for (const key of RESOURCE_KEYS) if (run.contribution[key] > 0) coverage.add(key);
    }
    if (coverage.size < 3) throw new Error("三隊總貢獻必須涵蓋最少3種資源。");
    for (const run of confirmed) {
      subtractResources(state.teams[run.teamId], run.contribution ?? {});
      state.teams[run.teamId].cash += 4;
      run.status = "completed";
    }
    log(state, `三隊拼船單 ${confirmed[0].contractCode} 成立：三隊完成扣貨並各得 $4。`, "good");
    return state;
  }

  if (action === "resolveTask") {
    const run = state.taskRuns.find((item) => item.id === payload.runId && item.status === "submitted");
    if (!run) throw new Error("任務提交已處理或不存在。");
    const approved = Boolean(payload.approved);
    if (!approved) {
      if (state.teams[run.teamId].retries > 0 && Boolean(payload.useRetry)) {
        state.teams[run.teamId].retries -= 1;
        run.status = "started";
        log(state, `${teamName(state, run.teamId)}使用航行裝備重試 ${run.taskId}。`, "warn");
      } else {
        run.status = "rejected";
        const rejectedTask = AFTERNOON_TASKS.find((item) => item.id === run.taskId);
        log(state, `${teamName(state, run.teamId)}的 ${run.taskId} 未通過，可重新挑戰${rejectedTask?.capacity ? "；限量名額已釋放，重試時要重新搶額" : ""}。`, "warn");
      }
      return state;
    }
    const task = AFTERNOON_TASKS.find((item) => item.id === run.taskId);
    if (!task) throw new Error("任務資料不存在。");
    if (task.id === "C2") throw new Error("請使用密封競投的「揭標結算」。");
    if (task.id === "C5") throw new Error("請使用三隊拼船單的「三隊結算」。");
    if (task.id === "C6") {
      if (!run.stakeReward || !run.stakeType) throw new Error("補貨方案資料不完整。");
      if (run.stakeType === "cash") {
        if (state.teams[run.teamId].cash < 7) throw new Error("該隊現金已不足 $7，請退回重新選擇。");
        state.teams[run.teamId].cash -= 7;
      } else {
        const property = state.properties.find((item) => item.id === run.stakePropertyId && item.owner === run.teamId);
        if (!property) throw new Error("抵押業權已不再屬於該隊，請退回重新選擇。");
        property.owner = null;
      }
    }
    run.status = "completed";
    state.teams[run.teamId].cash += task.reward.cash ?? 0;
    addResources(state.teams[run.teamId], task.reward.resources ?? {});
    if (task.id === "C6" && run.stakeReward) addResources(state.teams[run.teamId], run.stakeReward);
    log(state, `${teamName(state, run.teamId)}完成 ${task.id}「${task.title}」並取得獎勵。`, "good");
    return state;
  }

  if (action === "adjustPrice") {
    const resource = requireResource(payload.resource);
    const delta = Number(payload.delta) >= 0 ? 1 : -1;
    state.prices[resource] = Math.max(5, Math.min(8, state.prices[resource] + delta));
    log(state, `GM 將${resource}官方價格調整為 $${state.prices[resource]}。`);
    return state;
  }

  if (action === "settleGame") {
    if (state.settled) throw new Error("遊戲已完成最終結算。");
    const scores = (Object.keys(state.teams) as TeamId[]).map((teamId) => {
      const target = state.teams[teamId];
      const qualified = target.projects.length === PROJECTS.length;
      if (qualified) {
        for (const run of state.taskRuns.filter((item) => item.teamId === teamId && item.taskId === "C6" && item.status === "completed" && item.stakePropertyId)) {
          const mortgaged = state.properties.find((property) => property.id === run.stakePropertyId && property.owner === null);
          if (mortgaged) mortgaged.owner = teamId;
        }
      }
      const resourceValue = RESOURCE_KEYS.reduce(
        (sum, key) => sum + target.resources[key] * Math.max(2, state.prices[key] - 3),
        0
      );
      const propertyValue = ownedProperties(state, teamId).length * 4;
      target.cash += resourceValue + propertyValue;
      target.resources = emptyResources();
      return {
        teamId,
        qualified,
        projects: target.projects.length,
        cash: target.cash,
        rank: 0,
      };
    });
    scores.sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      if (a.qualified) return b.cash - a.cash;
      return b.projects - a.projects || b.cash - a.cash;
    });
    state.finalScores = scores.map((score, index) => ({ ...score, rank: index + 1 }));
    state.settled = true;
    state.phase = "final";
    state.tasksOpen = false;
    log(state, `15:00 最終結算完成，${teamName(state, state.finalScores[0].teamId)}暫列第一。`, "good");
    return state;
  }

  throw new Error("未知操作。");
}

export function validateTeamPins(value: unknown, gmPin: string): TeamPins {
  const raw = (value ?? {}) as Record<string, unknown>;
  const pins = {
    red: String(raw.red ?? ""),
    blue: String(raw.blue ?? ""),
    gold: String(raw.gold ?? ""),
  };
  if (Object.values(pins).some((pin) => !/^\d{4}$/.test(pin))) {
    throw new Error("每隊登入碼必須是剛好 4 位數字。");
  }
  if (new Set(Object.values(pins)).size !== 3) throw new Error("三隊登入碼不可重複。");
  if (Object.values(pins).includes(gmPin)) throw new Error("隊伍登入碼不可與 GM 登入碼相同。");
  return pins;
}

export function verifyCredential(action: string, payload: Record<string, unknown>, pin: unknown, teamPins: TeamPins, gmPin: string) {
  const gmActions = new Set([
    "reset", "setPhase", "setTasksOpen", "setGpsStrict", "runProduction",
    "adjustTeam", "resolveChallenge", "resolvePublicTask", "resolveLunchContract", "resolveTask", "resolveAuction", "resolveJointContract", "adjustPrice", "settleGame", "getTeamPins", "setTeamPins",
  ]);
  if (action === "auth") {
    if (payload.role === "gm") return pin === gmPin;
    return isTeamId(payload.teamId) && pin === teamPins[payload.teamId];
  }
  if (gmActions.has(action)) return pin === gmPin;
  return isTeamId(payload.teamId) && pin === teamPins[payload.teamId];
}
