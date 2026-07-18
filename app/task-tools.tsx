"use client";

import { useEffect, useState } from "react";
import {
  ACTION_RELAY_DECK,
  BAG_CODE_ACTIONS,
  C5_SETTLEMENT_PER_RESOURCE,
  CARGO_ORDER_ROUNDS,
  CHARADES_DECK,
  MARKET_SCENARIOS,
  RESOURCE_KEYS,
  RESOURCES,
  SYNC_QUESTIONS,
  TABOO_DECK,
  UNIQUE_CLUE_WORDS,
  WAVELENGTH_SCALES,
  WHOLESALE_LOTS,
  type ResourceKey,
  type TeamId,
} from "../lib/game-data";
import type { GameState, Resources, TradeSide } from "../lib/game-state";
import { cargoConstraintViolations } from "../lib/cargo-order";

export const TOOL_TASK_IDS = [
  "A5", "A3", "A1", "A6", "A2", "B7", "B2", "B4", "B1",
  "B8", "B3", "B6", "B5", "C2", "C3", "C1", "C5", "C6",
] as const;

export function hasTaskTool(taskId: string) {
  return (TOOL_TASK_IDS as readonly string[]).includes(taskId);
}

type CompleteFn = (evidence: string, payload?: Record<string, unknown>) => void;

type ToolProps = {
  taskId: string;
  state: GameState;
  teamId: TeamId;
  startedAt?: string;
  questionSet?: number;
  onComplete: CompleteFn;
};

const emptyResources = (): Resources => ({ energy: 0, intel: 0, gear: 0, network: 0 });

function ToolFrame({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="game-tool"><header><small>{eyebrow}</small><h2>{title}</h2></header>{children}</section>;
}

function SyncChoiceTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const [offset, setOffset] = useState((questionSet * 5) % SYNC_QUESTIONS.length);
  const [round, setRound] = useState(0);
  const [matches, setMatches] = useState(0);
  const [finished, setFinished] = useState(false);
  const question = SYNC_QUESTIONS[(offset + round) % SYNC_QUESTIONS.length];

  const mark = (matched: boolean) => {
    const nextMatches = matches + (matched ? 1 : 0);
    if (round === 4) {
      setMatches(nextMatches);
      setFinished(true);
      if (nextMatches >= 3) onComplete(`默契題 5 題中 ${nextMatches} 題全隊一致`);
    } else {
      setMatches(nextMatches);
      setRound((value) => value + 1);
    }
  };

  const retry = () => { setOffset((value) => (value + 5) % SYNC_QUESTIONS.length); setRound(0); setMatches(0); setFinished(false); };

  return <ToolFrame eyebrow={`默契題 ${round + 1}/5・已一致 ${matches}`} title={finished ? matches >= 3 ? "✓ 默契達標" : "未達3題一致" : question.prompt}>
    {!finished ? <><div className="choice-pair"><div><b>左<br />1</b><span>{question.a}</span></div><div><b>右<br />2</b><span>{question.b}</span></div></div><p className="tool-hint">全員心中揀好，倒數 3、2、1，同時舉左手（1）或右手（2）。</p><div className="tool-actions"><button className="ghost" onClick={() => mark(false)}>未能全隊一致</button><button onClick={() => mark(true)}>全隊一致</button></div></> : matches < 3 ? <button className="tool-wide" onClick={retry}>換另一組5題再試</button> : <div className="tool-success">可以提交任務。</div>}
  </ToolFrame>;
}

function TabooTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const [index, setIndex] = useState((questionSet * 4) % TABOO_DECK.length);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const card = TABOO_DECK[index % TABOO_DECK.length];
  const next = (correct: boolean) => {
    const nextScore = score + (correct ? 1 : 0);
    setScore(nextScore); setIndex((value) => value + 1);
    if (nextScore >= 4) { setDone(true); onComplete(`不能說的路線：估中 ${nextScore} 個詞`); }
  };
  return <ToolFrame eyebrow={`禁詞卡・估中 ${score}/4`} title={done ? "✓ 已估中4詞" : card.word}>
    {!done && <><div className="ban-list">{card.banned.map((word) => <span key={word}>✕ {word}</span>)}</div><p className="tool-hint">只畀描述者睇；不可講禁詞、同音字或英文。</p><div className="tool-actions"><button className="ghost" onClick={() => next(false)}>跳過</button><button onClick={() => next(true)}>估中・下一詞</button></div></>}
    {done && <div className="tool-success">可以提交任務。</div>}
  </ToolFrame>;
}

function BagCodeTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<"ready" | "preview" | "hidden" | "review" | "done">("ready");
  const [left, setLeft] = useState(10);
  const code = [...BAG_CODE_ACTIONS];
  let shuffleSeed = (questionSet * 11 + round + attempt * 3 + 1) * 2654435761;
  for (let index = code.length - 1; index > 0; index -= 1) {
    shuffleSeed = (shuffleSeed * 1664525 + 1013904223) >>> 0;
    const target = shuffleSeed % (index + 1);
    [code[index], code[target]] = [code[target], code[index]];
  }

  useEffect(() => {
    if (stage !== "preview") return;
    const timer = window.setTimeout(() => {
      if (left <= 1) { setLeft(0); setStage("hidden"); }
      else setLeft((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [stage, left]);

  const start = () => { setLeft(10); setStage("preview"); };
  const mark = (passed: boolean) => {
    if (!passed) { setAttempt((value) => value + 1); setLeft(10); setStage("ready"); return; }
    if (round >= 1) { setStage("done"); onComplete("營袋密碼鎖：連續還原2組六步密碼"); }
    else { setRound(1); setLeft(10); setStage("ready"); }
  };

  return <ToolFrame eyebrow={`密碼 ${round + 1}/2`} title={stage === "preview" ? `記憶時間 ${left} 秒` : stage === "hidden" ? "題目已收起・開始還原" : stage === "review" ? "核對六步密碼" : stage === "done" ? "✓ 密碼鎖已解開" : "全員孭好自己的營袋"}>
    {stage === "ready" && <><p className="tool-hint">每人記最少一步；只做原地動作，不傳袋、不在月台走動。</p><button className="tool-wide" onClick={start}>顯示第 {round + 1} 組密碼 10 秒</button></>}
    {stage === "preview" && <div className="bag-code">{code.map((action, index) => <div key={`${action}-${index}`}><b>{index + 1}</b><span>{action}</span></div>)}</div>}
    {stage === "hidden" && <><div className="hidden-code">⌁ 六步密碼已鎖起</div><p className="tool-hint">按次序逐步做出大家記住的動作，完成後先揭曉。</p><button className="tool-wide" onClick={() => setStage("review")}>全隊已做完・揭曉核對</button></>}
    {stage === "review" && <><div className="bag-code">{code.map((action, index) => <div key={`${action}-${index}`}><b>{index + 1}</b><span>{action}</span></div>)}</div><div className="tool-actions"><button className="ghost" onClick={() => mark(false)}>次序有錯・換新密碼</button><button onClick={() => mark(true)}>六步全對</button></div></>}
    {stage === "done" && <div className="tool-success">兩組密碼完成，可以提交任務。</div>}
  </ToolFrame>;
}

function CharadesTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const [index, setIndex] = useState((questionSet * 5) % CHARADES_DECK.length);
  const [score, setScore] = useState(0);
  const [guessers, setGuessers] = useState(1);
  const [done, setDone] = useState(false);
  const correct = () => {
    const next = score + 1; setScore(next); setIndex((value) => value + 1);
    if (next >= 5 && guessers >= 3) { setDone(true); onComplete(`動作題估中 ${next} 題；${guessers} 人做過估題者`); }
  };
  return <ToolFrame eyebrow={`估中 ${score}/5・估題者 ${guessers}/3`} title={done ? "✓ 動作挑戰完成" : CHARADES_DECK[index % CHARADES_DECK.length]}>
    {!done && <><p className="tool-hint">估題者背向畫面；其他人只可做動作。</p><label className="tool-range">做過估題者人數 <input type="range" min="1" max="6" value={guessers} onChange={(event) => setGuessers(Number(event.target.value))} /><b>{guessers}</b></label><div className="tool-actions"><button className="ghost" onClick={() => setIndex((value) => value + 1)}>換題</button><button onClick={correct}>估中・下一題</button></div></>}
    {done && <div className="tool-success">可以提交任務。</div>}
  </ToolFrame>;
}

const RPS_SIGNS = ["✊ 石頭", "✋ 布", "✌️ 剪刀"];
const RPS_TARGETS = ["勝出", "落敗", "打和"];
const RPS_TARGET_ORDERS = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

function RpsTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<"target" | "wait" | "reveal" | "done">("target");
  const [countdown, setCountdown] = useState(3);
  const target = RPS_TARGETS[RPS_TARGET_ORDERS[questionSet % RPS_TARGET_ORDERS.length][round]];
  const opponent = RPS_SIGNS[(questionSet + round + attempt * 2) % RPS_SIGNS.length];
  useEffect(() => {
    if (stage !== "wait") return;
    const timer = window.setTimeout(() => {
      if (countdown <= 1) { setCountdown(0); setStage("reveal"); }
      else setCountdown((value) => value - 1);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [stage, countdown]);
  const prepare = () => { setCountdown(3); setStage("wait"); };
  const judge = (passed: boolean) => {
    if (!passed) { setAttempt((value) => value + 1); setStage("target"); return; }
    if (round === 2) { setStage("done"); onComplete("全隊包剪揼：勝、負、和各完成一次"); }
    else { setRound((value) => value + 1); setAttempt(0); setStage("target"); }
  };
  return <ToolFrame eyebrow={`回合 ${round + 1}/3`} title={`今輪全隊要：${target}`}>
    {stage === "target" && <><div className="rps-wait"><small>對手手勢仍然收起</small><b>先決定自己要出咩</b></div><p className="tool-hint">不可討論。全員在心中準備好，先按下面按鈕。</p><button className="tool-wide" onClick={prepare}>全隊準備好・等待揭曉</button></>}
    {stage === "wait" && <div className="rps-countdown"><small>等一等…</small><b>{countdown}</b></div>}
    {stage === "reveal" && <><div className="rps-opponent"><small>手機對手出</small><b>{opponent}</b></div><p className="tool-hint">而家同時出拳；全隊要同一手勢並符合「{target}」。</p><div className="tool-actions"><button className="ghost" onClick={() => judge(false)}>唔同步／結果錯・重來</button><button onClick={() => judge(true)}>同步兼結果正確</button></div></>}
    {stage === "done" && <div className="tool-success">勝、負、和各完成一次，可以提交。</div>}
  </ToolFrame>;
}

function SilentCountTool({ onComplete }: { onComplete: CompleteFn }) {
  const [attempts, setAttempts] = useState(1);
  const [done, setDone] = useState(false);
  const complete = () => { setDone(true); onComplete(`無聲數字：第 ${attempts} 次成功由1報到20`); };
  return <ToolFrame eyebrow={`第 ${attempts} 次嘗試`} title={done ? "✓ 成功報到20" : "全員望地下・由1開始"}>
    {!done ? <><p className="tool-hint">撞聲、跳數、同一人連續報兩個數，就按重來。</p><div className="tool-actions"><button className="ghost" onClick={() => setAttempts((value) => value + 1)}>撞聲・由1重來</button><button onClick={complete}>成功報到20</button></div></> : <div className="tool-success">可以提交任務。</div>}
  </ToolFrame>;
}

function ActionRelayTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const [index, setIndex] = useState((questionSet * 3) % ACTION_RELAY_DECK.length);
  const [stage, setStage] = useState<"ready" | "show" | "hidden" | "answer" | "done">("ready");
  const [left, setLeft] = useState(8);
  const card = ACTION_RELAY_DECK[index % ACTION_RELAY_DECK.length];
  useEffect(() => {
    if (stage !== "show") return;
    const timer = window.setTimeout(() => {
      if (left <= 1) {
        setLeft(0);
        setStage("hidden");
      } else {
        setLeft((value) => value - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [stage, left]);
  const start = () => { setLeft(8); setStage("show"); };
  const fail = () => { setIndex((value) => value + 1); setStage("ready"); };
  const pass = () => { setStage("done"); onComplete(`動作傳真完成：${card.title}，命中最少2個關鍵動作`); };
  return <ToolFrame eyebrow="第一位專用題卡" title={stage === "show" ? card.title : stage === "hidden" ? "題卡已收起" : stage === "answer" ? "核對原本動作" : stage === "done" ? "✓ 傳真成功" : "其他人先背向手機"}>
    {stage === "ready" && <button className="tool-wide" onClick={start}>第一位按下・查看8秒</button>}
    {stage === "show" && <><div className="action-sequence">{card.actions.map((action, i) => <span key={action}><b>{i + 1}</b>{action}</span>)}</div><div className="reveal-count">{left}</div></>}
    {stage === "hidden" && <><p className="tool-hint">放低手機，逐個只示範一次。到最後一人完成動作先核對。</p><button className="tool-wide" onClick={() => setStage("answer")}>最後一人完成・揭答案</button></>}
    {stage === "answer" && <><div className="action-sequence">{card.actions.map((action, i) => <span key={action}><b>{i + 1}</b>{action}</span>)}</div><div className="tool-actions"><button className="ghost" onClick={fail}>只中0–1個・換題</button><button onClick={pass}>中2–3個</button></div></>}
    {stage === "done" && <div className="tool-success">可以提交任務。</div>}
  </ToolFrame>;
}

function MarketScenarioTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const [round, setRound] = useState(0);
  const [batch, setBatch] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const scenario = MARKET_SCENARIOS[(questionSet * 4 + batch * 4 + round) % MARKET_SCENARIOS.length];
  const correct = picked === scenario.answer;
  const choose = (index: number) => { if (picked === null) setPicked(index); };
  const next = () => {
    const nextScore = score + (correct ? 1 : 0);
    if (round >= 3) {
      if (nextScore >= 3) { setScore(nextScore); setDone(true); onComplete(`行情黑箱：4題答中${nextScore}題`); }
      else { setBatch((value) => value + 1); setRound(0); setScore(0); setPicked(null); }
    } else { setScore(nextScore); setRound((value) => value + 1); setPicked(null); }
  };
  return <ToolFrame eyebrow={`市場情境 ${round + 1}/4・答中 ${score}`} title={done ? "✓ 行情判讀達標" : scenario.question}>
    {!done && <><div className="scenario-options">{scenario.options.map((option, index) => <button className={picked === index ? index === scenario.answer ? "correct" : "wrong" : picked !== null && index === scenario.answer ? "correct" : ""} disabled={picked !== null} key={option} onClick={() => choose(index)}><b>{index + 1}</b>{option}</button>)}</div>{picked !== null && <div className={`scenario-explain ${correct ? "correct" : "wrong"}`}><b>{correct ? "答啱" : "答錯"}</b><span>{scenario.explanation}</span><button onClick={next}>{round >= 3 ? score + (correct ? 1 : 0) >= 3 ? "完成" : "未達3題・重新挑戰" : "下一個情境"}</button></div>}</>}
    {done && <div className="tool-success">4題中答中最少3題，可以提交。</div>}
  </ToolFrame>;
}

function WholesaleTool({ onComplete }: { onComplete: CompleteFn }) {
  const [stage, setStage] = useState<"ready" | "preview" | "choose" | "result" | "done">("ready");
  const [left, setLeft] = useState(20);
  const [selected, setSelected] = useState<string[]>([]);
  const chosen = WHOLESALE_LOTS.filter((lot) => selected.includes(lot.id));
  const cost = chosen.reduce((sum, lot) => sum + lot.cost, 0);
  const base = chosen.reduce((sum, lot) => sum + lot.value, 0);
  const comboCount = ["power", "supply", "signal", "cargo"].filter((tag) => chosen.filter((lot) => lot.combo === tag).length >= 2).length;
  const score = cost <= 14 && selected.length === 4 ? base + comboCount * 4 : 0;
  useEffect(() => {
    if (stage !== "preview") return;
    const timer = window.setTimeout(() => {
      if (left <= 1) {
        setLeft(0);
        setStage("choose");
      } else {
        setLeft((value) => value - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [stage, left]);
  const toggle = (id: string) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : items.length < 4 ? [...items, id] : items);
  const reveal = () => {
    setStage("result");
    if (score >= 24) { setStage("done"); onComplete(`城市批發場：4個貨盤成本 $${cost}，貨值 ${score}`); }
  };
  const retry = () => { setSelected([]); setLeft(20); setStage("ready"); };
  return <ToolFrame eyebrow={stage === "preview" ? `記貨時間 ${left}秒` : "預算 $14・必須4個貨盤"} title={stage === "choose" ? "憑記憶揀4個貨盤" : stage === "done" ? `✓ 貨值 ${score}` : stage === "result" ? `貨值 ${score}` : "八個貨盤即將公開"}>
    {stage === "ready" && <button className="tool-wide" onClick={() => setStage("preview")}>開始20秒睇貨</button>}
    {stage === "preview" && <div className="lot-grid">{WHOLESALE_LOTS.map((lot) => <article key={lot.id}><small>{lot.id}</small><b>{lot.name}</b><span>成本 ${lot.cost}</span><strong>貨值 {lot.value}</strong><i>{lot.combo}</i></article>)}</div>}
    {stage === "choose" && <><div className="hidden-lots">{WHOLESALE_LOTS.map((lot) => <button className={selected.includes(lot.id) ? "selected" : ""} onClick={() => toggle(lot.id)} key={lot.id}>{lot.id}<small>{selected.includes(lot.id) ? "已選" : "?"}</small></button>)}</div><button className="tool-wide" disabled={selected.length !== 4} onClick={reveal}>{selected.length}/4・鎖定並揭曉</button></>}
    {stage === "result" && <><p className="tool-result">成本 ${cost}／14・基本貨值 {base}・組合加成 +{comboCount * 4}・總值 <b>{score}</b></p><button className="tool-wide" onClick={retry}>未達24・再試</button></>}
    {stage === "done" && <div className="tool-success">成本 ${cost}，總貨值 {score}，可以提交。</div>}
  </ToolFrame>;
}

function CargoOrderTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const base = (questionSet * 2) % CARGO_ORDER_ROUNDS.length;
  const [round, setRound] = useState(0);
  const [items, setItems] = useState<string[]>(() => [...CARGO_ORDER_ROUNDS[base].items].reverse());
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const card = CARGO_ORDER_ROUNDS[(base + round) % CARGO_ORDER_ROUNDS.length];
  const move = (index: number, delta: number) => setItems((current) => {
    const target = index + delta;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const check = () => {
    const errors = cargoConstraintViolations(items, card);
    if (errors > 0) { setMessage(`仍有 ${errors} 條限制未符合；系統唔會直接顯示答案。`); return; }
    if (round >= 2) { setDone(true); onComplete("六箱排位戰：連續解開3張裝船次序卡"); }
    else {
      const nextRound = round + 1;
      setRound(nextRound);
      setItems([...CARGO_ORDER_ROUNDS[(base + nextRound) % CARGO_ORDER_ROUNDS.length].items].reverse());
      setMessage(`第 ${round + 1} 張完成，下一張已裝載。`);
    }
  };
  return <ToolFrame eyebrow={`裝船卡 ${round + 1}/3・共用手機`} title={done ? "✓ 三張排位完成" : "按限制重排六個貨箱"}>
    {!done && <><ol className="constraint-list">{card.constraints.map((rule) => <li key={rule}>{rule}</li>)}</ol><div className="cargo-order">{items.map((item, index) => <div key={item}><b>{index + 1}</b><span>{item}</span><button className="ghost" disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button className="ghost" disabled={index === items.length - 1} onClick={() => move(index, 1)}>↓</button></div>)}</div>{message && <p className="tool-hint">{message}</p>}<button className="tool-wide" onClick={check}>鎖定次序・核對限制</button></>}
    {done && <div className="tool-success">全程毋須傳手機，可以提交任務。</div>}
  </ToolFrame>;
}

function makeMemoryCards(seed: number) {
  const pairs = ["⚡", "◉", "▣", "◆", "▲", "●", "★", "✚"];
  const cards = [...pairs, ...pairs].map((symbol, index) => ({ id: `${symbol}-${index}`, symbol }));
  let value = (seed + 1) * 2654435761;
  for (let index = cards.length - 1; index > 0; index -= 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const target = value % (index + 1);
    [cards[index], cards[target]] = [cards[target], cards[index]];
  }
  return cards;
}

function MemoryTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const [shuffle, setShuffle] = useState(0);
  const [cards, setCards] = useState(() => makeMemoryCards(questionSet));
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const flip = (index: number) => {
    if (failed || locked || open.includes(index) || matched.includes(index)) return;
    if (open.length === 0) { setOpen([index]); return; }
    const first = open[0];
    const nextTurns = turns + 1;
    setOpen([first, index]); setTurns(nextTurns); setLocked(true);
    if (cards[first].symbol === cards[index].symbol) {
      window.setTimeout(() => {
        setMatched((items) => {
          const next = [...items, first, index];
          if (next.length === cards.length && nextTurns <= 15) onComplete(`貨櫃記憶：${nextTurns} 回合完成8對`);
          else if (nextTurns >= 15) setFailed(true);
          return next;
        });
        setOpen([]); setLocked(false);
      }, 450);
    } else window.setTimeout(() => { setOpen([]); setLocked(false); if (nextTurns >= 15) setFailed(true); }, 850);
  };
  const retry = () => { const nextShuffle = shuffle + 1; setShuffle(nextShuffle); setCards(makeMemoryCards(questionSet + nextShuffle * 17)); setOpen([]); setMatched([]); setTurns(0); setLocked(false); setFailed(false); };
  return <ToolFrame eyebrow={`${turns}/15 回合`} title={failed ? "15回合用完" : `貨櫃配對 ${matched.length / 2}/8`}><div className="memory-grid tool-memory">{cards.map((card, index) => { const visible = open.includes(index) || matched.includes(index); return <button key={card.id} className={visible ? "open" : ""} disabled={failed || matched.includes(index)} onClick={() => flip(index)}><span>{visible ? card.symbol : "?"}</span></button>; })}</div>{failed && <button className="tool-wide" onClick={retry}>重新洗牌再試</button>}{matched.length === cards.length && !failed && <div className="tool-success">✓ 全部8對完成</div>}</ToolFrame>;
}

function PlayingCardTool({ onComplete }: { onComplete: CompleteFn }) {
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(90);
  const [score, setScore] = useState(0);
  const [fouls, setFouls] = useState(0);
  const [everyoneTwo, setEveryoneTwo] = useState(false);
  useEffect(() => {
    if (!running || left <= 0 || (score >= 18 && everyoneTwo)) return;
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [running, left, score, everyoneTwo]);
  const legal = () => {
    if (!running || left <= 0 || score >= 18) return;
    const next = score + 1;
    setScore(next);
    if (next >= 18 && everyoneTwo) { setRunning(false); onComplete(`啤牌貨運鏈：剩餘${left}秒，18張合法牌，人人最少2張`); }
  };
  const foul = () => { if (!running) return; setFouls((value) => value + 1); setLeft((value) => Math.max(0, value - 5)); };
  const reset = () => { setLeft(90); setScore(0); setFouls(0); setEveryoneTwo(false); setRunning(true); };
  const markEveryoneTwo = (checked: boolean) => {
    setEveryoneTwo(checked);
    if (checked && score >= 18 && running) { setRunning(false); onComplete(`啤牌貨運鏈：剩餘${left}秒，18張合法牌，人人最少2張`); }
  };
  return <ToolFrame eyebrow={`合法牌 ${score}/18・犯規 ${fouls}`} title={!running && score === 0 ? "準備一副真啤牌" : left > 0 ? `剩餘 ${left} 秒` : "時間到"}>
    <div className="playing-card-setup"><span>① 除 Joker 洗牌</span><span>② 每人 5 張</span><span>③ 翻 1 張中央牌</span></div>
    {!running && score === 0 && <button className="tool-wide" onClick={reset}>啤牌準備好・開始90秒</button>}
    {running && left > 0 && <><div className="card-counter"><button onClick={legal}>合法出牌 ＋1</button><button className="ghost" onClick={foul}>犯規・扣5秒</button></div><label className="check-line"><input type="checkbox" checked={everyoneTwo} onChange={(event) => markEveryoneTwo(event.target.checked)} /> 已核對每人最少成功出 2 張</label><p className="tool-hint">手機放中間，任何人可按；毋須跟住出牌者傳手機。</p></>}
    {left === 0 && !(score >= 18 && everyoneTwo) && <button className="tool-wide" onClick={reset}>時間到・重新洗牌再試</button>}
    {left > 0 && score >= 18 && !everyoneTwo && <div className="pending-banner">已到18張；倒數仍繼續，核對人人最少2張後剔選上方方格。</div>}
    {score >= 18 && everyoneTwo && <div className="tool-success">✓ 啤牌貨運鏈完成</div>}
  </ToolFrame>;
}

function sideAssetTypes(side: TradeSide) {
  const types: string[] = [];
  if (side.cash > 0) types.push("現金");
  if (RESOURCE_KEYS.some((key) => side.resources[key] > 0)) types.push("資源");
  if (side.propertyId) types.push("業權");
  return types;
}

function TradeProofTool({ state, teamId, startedAt, onComplete }: { state: GameState; teamId: TeamId; startedAt?: string; onComplete: CompleteFn }) {
  const eligible = state.trades.find((trade) => {
    if (trade.status !== "completed" || (trade.from !== teamId && trade.to !== teamId)) return false;
    if (startedAt && trade.completedAt && new Date(trade.completedAt) < new Date(startedAt)) return false;
    return new Set([...sideAssetTypes(trade.give), ...sideAssetTypes(trade.receive)]).size >= 2;
  });
  return <ToolFrame eyebrow="玩家交易所即時核對" title={eligible ? "✓ 找到合資格交易" : "未找到完成交易"}>
    {eligible ? <><p className="tool-result">交易編號 <b>{eligible.id.slice(0, 8)}</b>，雙方資產已由系統交換。</p><button className="tool-wide" onClick={() => onComplete(`跨隊交易 ${eligible.id.slice(0, 8)} 已完成`)}>使用這宗交易作證明</button></> : <p className="tool-hint">先到「交易」頁完成一宗涉及至少兩類資產的真交易，再返回本頁；資料每4.5秒同步。</p>}
  </ToolFrame>;
}

function AuctionTool({ state, teamId, onComplete }: { state: GameState; teamId: TeamId; onComplete: CompleteFn }) {
  const team = state.teams[teamId];
  const [bid, setBid] = useState(0);
  const [basket, setBasket] = useState<Resources>(emptyResources);
  const total = RESOURCE_KEYS.reduce((sum, key) => sum + basket[key], 0);
  const change = (key: ResourceKey, delta: number) => setBasket((current) => ({ ...current, [key]: Math.max(0, current[key] + delta) }));
  return <ToolFrame eyebrow="密封出價・其他隊看不到" title={`可用現金 $${team.cash}`}>
    <label className="bid-input">出價 $<input type="number" min="0" max={team.cash} value={bid} onChange={(event) => setBid(Math.max(0, Math.min(team.cash, Math.floor(Number(event.target.value) || 0))))} /></label>
    <p className="tool-hint">預先選定如果勝出想要的2份資源。</p><div className="mini-builder">{RESOURCE_KEYS.map((key) => <div key={key}><span style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name}</span><button onClick={() => change(key, -1)}>−</button><b>{basket[key]}</b><button disabled={total >= 2} onClick={() => change(key, 1)}>＋</button></div>)}</div>
    <button className="tool-wide" disabled={bid < 1 || total !== 2} onClick={() => onComplete(`密封出價 $${bid}；勝出選 ${RESOURCE_KEYS.filter((key) => basket[key]).map((key) => `${RESOURCES[key].name}×${basket[key]}`).join("、")}`, { bid, auctionReward: basket })}>封存出價</button>
  </ToolFrame>;
}

function WavelengthTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const targets = [24, 69, 46, 81, 37, 58, 16, 73, 42, 63];
  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<"secret" | "guess" | "reveal" | "done">("secret");
  const [guess, setGuess] = useState(50);
  const [total, setTotal] = useState(0);
  const scale = WAVELENGTH_SCALES[(questionSet * 3 + attempt * 3 + round) % WAVELENGTH_SCALES.length];
  const target = targets[(questionSet * 3 + attempt * 3 + round) % targets.length];
  const distance = Math.abs(guess - target);
  const points = distance <= 5 ? 4 : distance <= 12 ? 3 : distance <= 20 ? 2 : 0;
  const next = () => {
    const nextTotal = total + points;
    if (round >= 2) {
      if (nextTotal >= 7) { setTotal(nextTotal); setStage("done"); onComplete(`默契波長：3輪合計 ${nextTotal} 分`); }
      else { setAttempt((value) => value + 1); setRound(0); setTotal(0); setGuess(50); setStage("secret"); }
    } else { setTotal(nextTotal); setRound((value) => value + 1); setGuess(50); setStage("secret"); }
  };
  return <ToolFrame eyebrow={`波長 ${round + 1}/3・累計 ${total}分`} title={`${scale.left} ↔ ${scale.right}`}>
    {stage === "secret" && <div className="secret-target"><small>只畀提示者睇</small><b>目標位置 {target}</b><button onClick={() => setStage("guess")}>記住後收起・交畀隊友</button></div>}
    {stage === "guess" && <><label className="wavelength"><span>{scale.left}</span><input type="range" min="0" max="100" value={guess} onChange={(event) => setGuess(Number(event.target.value))} /><span>{scale.right}</span></label><button className="tool-wide" onClick={() => setStage("reveal")}>鎖定指針・揭曉</button></>}
    {stage === "reveal" && <><div className="wave-result"><span style={{ left: `${target}%` }}>目標</span><i style={{ left: `${guess}%` }}>指針</i></div><p className="tool-result">本輪 <b>{points}分</b></p><button className="tool-wide" onClick={next}>{round >= 2 ? total + points >= 7 ? "完成" : "未達7分・再試三輪" : "下一輪"}</button></>}
    {stage === "done" && <div className="tool-success">✓ 3輪合計 {total} 分</div>}
  </ToolFrame>;
}

function UniqueClueTool({ questionSet, onComplete }: { questionSet: number; onComplete: CompleteFn }) {
  const [players, setPlayers] = useState(5);
  const [round, setRound] = useState(0);
  const [offset, setOffset] = useState((questionSet * 5) % UNIQUE_CLUE_WORDS.length);
  const [correct, setCorrect] = useState(0);
  const [stage, setStage] = useState<"setup" | "collect" | "review" | "guess" | "done">("setup");
  const [clue, setClue] = useState("");
  const [clues, setClues] = useState<Array<{ text: string; cancelled: boolean }>>([]);
  const [guess, setGuess] = useState("");
  const word = UNIQUE_CLUE_WORDS[(offset + round) % UNIQUE_CLUE_WORDS.length];
  const needed = players - 1;
  const addClue = () => { if (!clue.trim()) return; const next = [...clues, { text: clue.trim(), cancelled: false }]; setClues(next); setClue(""); if (next.length >= needed) setStage("review"); };
  const toggle = (index: number) => setClues((items) => items.map((item, i) => i === index ? { ...item, cancelled: !item.cancelled } : item));
  const judge = () => {
    const hit = guess.trim().toLocaleLowerCase() === word.toLocaleLowerCase();
    const nextCorrect = correct + (hit ? 1 : 0);
    if (round >= 4) {
      if (nextCorrect >= 3) { setCorrect(nextCorrect); setStage("done"); onComplete(`唯一線索：5題估中 ${nextCorrect} 題`); }
      else { setOffset((value) => (value + 5) % UNIQUE_CLUE_WORDS.length); setRound(0); setCorrect(0); setClues([]); setGuess(""); setStage("setup"); }
    } else { setCorrect(nextCorrect); setRound((value) => value + 1); setClues([]); setGuess(""); setStage("setup"); }
  };
  return <ToolFrame eyebrow={`題目 ${round + 1}/5・估中 ${correct}/3`} title={stage === "setup" ? word : stage === "collect" ? `秘密收集提示 ${clues.length}/${needed}` : stage === "review" ? "刪除重複或同詞根提示" : stage === "guess" ? "交畀估題者" : "✓ 唯一線索達標"}>
    {stage === "setup" && <><p className="tool-hint">估題者轉身；其餘人記住目標詞。</p><label className="tool-range">玩家人數<input type="range" min="5" max="6" value={players} onChange={(event) => setPlayers(Number(event.target.value))} /><b>{players}</b></label><button className="tool-wide" onClick={() => setStage("collect")}>收起目標・開始逐個輸入</button></>}
    {stage === "collect" && <label className="tool-input">第 {clues.length + 1} 位提示<input autoFocus value={clue} onChange={(event) => setClue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addClue(); }} /><button onClick={addClue}>封存提示</button></label>}
    {stage === "review" && <><div className="clue-review">{clues.map((item, index) => <button className={item.cancelled ? "cancelled" : ""} onClick={() => toggle(index)} key={`${item.text}-${index}`}>{item.text}</button>)}</div><p className="tool-hint">重複、同詞根或明顯變體全部點選刪除。</p><button className="tool-wide" onClick={() => setStage("guess")}>完成刪除・交畀估題者</button></>}
    {stage === "guess" && <><div className="surviving-clues">{clues.filter((item) => !item.cancelled).map((item) => <span key={item.text}>{item.text}</span>)}</div><label className="tool-input">估題者答案<input value={guess} onChange={(event) => setGuess(event.target.value)} /></label><button className="tool-wide" disabled={!guess.trim()} onClick={judge}>鎖定答案</button></>}
    {stage === "done" && <div className="tool-success">可以提交任務。</div>}
  </ToolFrame>;
}

function JointContractTool({ state, teamId, onComplete }: { state: GameState; teamId: TeamId; onComplete: CompleteFn }) {
  const team = state.teams[teamId];
  const contractRuns = state.taskRuns.filter((run) => run.taskId === "C5" && ["started", "submitted", "completed"].includes(run.status));
  const submittedRuns = contractRuns.filter((run) => ["submitted", "completed"].includes(run.status));
  const currentRun = [...contractRuns].reverse().find((run) => run.teamId === teamId);
  const legacyRoomCode = `C5${state.roomCode.replace(/[^A-Z0-9]/gi, "").slice(-4).padStart(4, "0")}`.toUpperCase();
  const sharedCode = currentRun?.contractCode ?? contractRuns.find((run) => run.contractCode)?.contractCode ?? legacyRoomCode;
  const [basket, setBasket] = useState<Resources>(emptyResources);
  const total = RESOURCE_KEYS.reduce((sum, key) => sum + basket[key], 0);
  const coverage = new Set<ResourceKey>();
  for (const run of submittedRuns) for (const key of RESOURCE_KEYS) if ((run.contribution?.[key] ?? 0) > 0) coverage.add(key);
  for (const key of RESOURCE_KEYS) if (basket[key] > 0) coverage.add(key);
  const change = (key: ResourceKey, delta: number) => setBasket((current) => ({ ...current, [key]: Math.max(0, Math.min(team.resources[key], current[key] + delta)) }));
  return <ToolFrame eyebrow={`三隊一張單・每份資源終局值 $${C5_SETTLEMENT_PER_RESOURCE}`} title="三隊拼船單">
    <ol className="contract-steps"><li><b>1</b><span>系統建立共用合約碼；三隊到達 C5 後自動加入。</span></li><li><b>2</b><span>每隊揀最少1份資源，三隊合計要涵蓋3種。</span></li><li><b>3</b><span>提交一刻即時扣起資源，不能再用於其他地方；GM 確認三隊合約後，每份於終局按 ${C5_SETTLEMENT_PER_RESOURCE} 結算。</span></li></ol>
    <div className="joint-status">{(Object.keys(state.teams) as TeamId[]).map((id) => { const run = [...submittedRuns].reverse().find((item) => item.teamId === id); return <div className={run ? "ready" : ""} key={id}><b>{state.teams[id].name}</b><span>{run ? `已提交 ${run.contractCode}・${run.contribution ? RESOURCE_KEYS.filter((key) => run.contribution?.[key]).map((key) => RESOURCES[key].name).join("＋") : "—"}` : id === teamId ? "你隊正在填寫" : "未提交"}</span></div>; })}</div>
    <div className="hidden-code">⌁ 共用合約碼：{sharedCode}</div>
    <p className="tool-hint">目前連同你隊選擇共涵蓋 <b>{coverage.size}/3</b> 種資源；你隊已選 <b>{total}</b> 份，提交後會即時扣起，成功成單後終局結算值為 <b>${total * C5_SETTLEMENT_PER_RESOURCE}</b>。</p>
    <div className="mini-builder">{RESOURCE_KEYS.map((key) => <div key={key}><span style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name}<small>有{team.resources[key]}</small></span><button onClick={() => change(key, -1)}>−</button><b>{basket[key]}</b><button disabled={basket[key] >= team.resources[key]} onClick={() => change(key, 1)}>＋</button></div>)}</div>
    <button className="tool-wide" disabled={sharedCode.length < 3 || total < 1} onClick={() => onComplete(`三隊拼船單 ${sharedCode}；貢獻 ${RESOURCE_KEYS.filter((key) => basket[key]).map((key) => `${RESOURCES[key].name}×${basket[key]}`).join("、")}`, { contractCode: sharedCode, contribution: basket })}>確認本隊貢獻・下一步提交</button>
  </ToolFrame>;
}

function MortgageTool({ state, teamId, onComplete }: { state: GameState; teamId: TeamId; onComplete: CompleteFn }) {
  const team = state.teams[teamId];
  const properties = state.properties.filter((property) => property.owner === teamId);
  const [stakeType, setStakeType] = useState<"cash" | "property">("cash");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [basket, setBasket] = useState<Resources>(emptyResources);
  const required = stakeType === "cash" ? 2 : 3;
  const total = RESOURCE_KEYS.reduce((sum, key) => sum + basket[key], 0);
  const valid = stakeType === "cash" ? team.cash >= 7 && total === 2 : Boolean(propertyId) && total === 3 && RESOURCE_KEYS.every((key) => basket[key] <= 2);
  const changeType = (next: "cash" | "property") => { setStakeType(next); setBasket(emptyResources()); };
  const change = (key: ResourceKey, delta: number) => setBasket((current) => ({ ...current, [key]: Math.max(0, Math.min(stakeType === "property" ? 2 : 2, current[key] + delta)) }));
  return <ToolFrame eyebrow="兩個方案都比官方市場抵買・確認後不可改" title="終局補貨站">
    <div className="segmented"><button className={stakeType === "cash" ? "active" : ""} onClick={() => changeType("cash")}>$7 換 2 份</button><button className={stakeType === "property" ? "active" : ""} disabled={properties.length === 0} onClick={() => changeType("property")}>業權換 3 份</button></div>
    <div className="value-comparison"><span>{stakeType === "cash" ? "官方市場買2份通常最少 $12；此處固定 $7。" : "抵押業權即取3份；成功完成四項認證會歸還業權。"}</span><b>已選 {total}/{required}</b></div>
    {stakeType === "property" && <label className="tool-input">抵押業權<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>{properties.map((property) => <option value={property.id} key={property.id}>{property.id} {property.title}</option>)}</select></label>}
    <div className="mini-builder">{RESOURCE_KEYS.map((key) => <div key={key}><span style={{ color: RESOURCES[key].color }}>{RESOURCES[key].icon} {RESOURCES[key].name}</span><button onClick={() => change(key, -1)}>−</button><b>{basket[key]}</b><button disabled={total >= required || basket[key] >= 2} onClick={() => change(key, 1)}>＋</button></div>)}</div>
    <button className="tool-wide" disabled={!valid} onClick={() => onComplete(`終局補貨：${stakeType === "cash" ? "支付$7" : `抵押${propertyId}`}，換取${RESOURCE_KEYS.filter((key) => basket[key]).map((key) => `${RESOURCES[key].name}×${basket[key]}`).join("、")}`, { stakeType, stakePropertyId: stakeType === "property" ? propertyId : undefined, stakeReward: basket })}>{!valid ? stakeType === "cash" && team.cash < 7 ? "現金不足 $7" : stakeType === "property" && !propertyId ? "沒有可抵押業權" : `尚欠 ${required - total} 份資源選擇` : "鎖定補貨方案"}</button>
  </ToolFrame>;
}

export function TaskTool({ taskId, state, teamId, startedAt, questionSet = 0, onComplete }: ToolProps) {
  if (taskId === "A5") return <SyncChoiceTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "A3") return <TabooTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "A1") return <BagCodeTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "A6") return <CharadesTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "A2") return <RpsTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "B7") return <SilentCountTool onComplete={onComplete} />;
  if (taskId === "B2") return <ActionRelayTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "B4") return <MarketScenarioTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "B1") return <WholesaleTool onComplete={onComplete} />;
  if (taskId === "B8") return <CargoOrderTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "B3") return <MemoryTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "B6") return <PlayingCardTool onComplete={onComplete} />;
  if (taskId === "B5") return <TradeProofTool state={state} teamId={teamId} startedAt={startedAt} onComplete={onComplete} />;
  if (taskId === "C2") return <AuctionTool state={state} teamId={teamId} onComplete={onComplete} />;
  if (taskId === "C3") return <WavelengthTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "C1") return <UniqueClueTool questionSet={questionSet} onComplete={onComplete} />;
  if (taskId === "C5") return <JointContractTool state={state} teamId={teamId} onComplete={onComplete} />;
  if (taskId === "C6") return <MortgageTool state={state} teamId={teamId} onComplete={onComplete} />;
  return null;
}
