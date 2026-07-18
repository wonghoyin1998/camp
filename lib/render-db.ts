import { Pool } from "pg";

import {
  makeInitialState,
  validateTeamPins,
  type GameState,
  type TeamPins,
} from "./game-state";

const GAME_ID = "main";

function requiredPin(name: "GM_PIN" | "INITIAL_RED_PIN" | "INITIAL_BLUE_PIN" | "INITIAL_GOLD_PIN") {
  const value = process.env[name];
  if (!value || !/^\d{4}$/.test(value)) {
    throw new Error(`${name} 必須設定為 4 位數字。`);
  }
  return value;
}

export function getGmPin() {
  return requiredPin("GM_PIN");
}

function initialTeamPins() {
  return validateTeamPins({
    red: requiredPin("INITIAL_RED_PIN"),
    blue: requiredPin("INITIAL_BLUE_PIN"),
    gold: requiredPin("INITIAL_GOLD_PIN"),
  }, getGmPin());
}

declare global {
  // Keep one pool while Next.js reloads modules in development.
  var campRoutePostgresPool: Pool | undefined;
}

function databasePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Render 資料庫尚未連接。請設定 DATABASE_URL。");
  }

  if (!globalThis.campRoutePostgresPool) {
    globalThis.campRoutePostgresPool = new Pool({
      connectionString,
      max: 5,
      ssl: process.env.DATABASE_SSL === "require"
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return globalThis.campRoutePostgresPool;
}

let initialization: Promise<void> | undefined;

async function ensureGame() {
  const pool = databasePool();
  if (!initialization) {
    initialization = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS game_states (
        id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query("CREATE INDEX IF NOT EXISTS game_states_updated_idx ON game_states(updated_at)");
      await pool.query(`CREATE TABLE IF NOT EXISTS game_credentials (
        id TEXT PRIMARY KEY,
        red_pin TEXT NOT NULL,
        blue_pin TEXT NOT NULL,
        gold_pin TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

      const initialMode = process.env.INITIAL_GAME_MODE === "demo" ? "demo" : "live";
      const initialPins = initialTeamPins();
      await pool.query(
        `INSERT INTO game_states (id, state, revision, updated_at)
         VALUES ($1, $2, 0, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [GAME_ID, JSON.stringify(makeInitialState(initialMode))],
      );
      await pool.query(
        `INSERT INTO game_credentials (id, red_pin, blue_pin, gold_pin, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [GAME_ID, initialPins.red, initialPins.blue, initialPins.gold],
      );
    })().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  await initialization;
  return pool;
}

export async function readTeamPins(): Promise<TeamPins> {
  const pool = await ensureGame();
  const result = await pool.query<{
    red_pin: string;
    blue_pin: string;
    gold_pin: string;
  }>("SELECT red_pin, blue_pin, gold_pin FROM game_credentials WHERE id = $1", [GAME_ID]);
  const row = result.rows[0];
  if (!row) return initialTeamPins();
  return validateTeamPins({ red: row.red_pin, blue: row.blue_pin, gold: row.gold_pin }, getGmPin());
}

export async function readState(): Promise<{ state: GameState; revision: number }> {
  const pool = await ensureGame();
  const result = await pool.query<{ state: string; revision: number }>(
    "SELECT state, revision FROM game_states WHERE id = $1",
    [GAME_ID],
  );
  const row = result.rows[0];
  if (!row) throw new Error("未能讀取遊戲狀態。");
  return { state: JSON.parse(row.state) as GameState, revision: Number(row.revision) };
}

export async function updateTeamPins(teamPins: TeamPins) {
  const pool = await ensureGame();
  await pool.query(
    `UPDATE game_credentials
     SET red_pin = $1, blue_pin = $2, gold_pin = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [teamPins.red, teamPins.blue, teamPins.gold, GAME_ID],
  );
}

export async function compareAndSwapState(state: GameState, revision: number) {
  const pool = await ensureGame();
  const result = await pool.query(
    `UPDATE game_states
     SET state = $1, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND revision = $3`,
    [JSON.stringify(state), GAME_ID, revision],
  );
  return result.rowCount === 1;
}
