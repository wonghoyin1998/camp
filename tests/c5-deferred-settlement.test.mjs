import assert from "node:assert/strict";
import test from "node:test";

import { makeInitialState, mutateGame } from "../lib/game-state.ts";

test("C5 reserves resources on submission and pays $6 each only at final settlement", () => {
  const state = makeInitialState("demo");
  const contributions = {
    red: { energy: 2, gear: 1 },
    blue: { intel: 1 },
    gold: { network: 1 },
  };
  const startingCash = Object.fromEntries(Object.entries(state.teams).map(([id, team]) => [id, team.cash]));

  for (const teamId of ["red", "blue", "gold"]) {
    state.teams[teamId].stationIndex = 16;
    mutateGame(state, "startTask", { teamId, taskId: "C5" });
    mutateGame(state, "submitTask", { teamId, taskId: "C5", contribution: contributions[teamId] });
  }
  assert.deepEqual(state.teams.red.resources, { energy: 1, intel: 2, gear: 0, network: 4 });
  assert.deepEqual(state.teams.blue.resources, { energy: 2, intel: 3, gear: 2, network: 1 });
  assert.deepEqual(state.teams.gold.resources, { energy: 4, intel: 1, gear: 3, network: 1 });
  assert.throws(() => mutateGame(state, "craftProject", { teamId: "red", projectId: "power" }), /資源組合不足/);
  assert.equal(new Set(state.taskRuns.filter((run) => run.taskId === "C5").map((run) => run.contractCode)).size, 1);
  mutateGame(state, "resolveJointContract", {});

  assert.equal(state.teams.red.cash, startingCash.red);
  assert.equal(state.teams.blue.cash, startingCash.blue);
  assert.equal(state.teams.gold.cash, startingCash.gold);
  assert.deepEqual(state.teams.red.resources, { energy: 1, intel: 2, gear: 0, network: 4 });
  assert.equal(state.taskRuns.find((run) => run.teamId === "red" && run.taskId === "C5").jointSettlementValue, 18);
  assert.equal(state.taskRuns.find((run) => run.teamId === "blue" && run.taskId === "C5").jointSettlementValue, 6);
  assert.equal(state.taskRuns.find((run) => run.teamId === "gold" && run.taskId === "C5").jointSettlementValue, 6);

  for (const team of Object.values(state.teams)) team.projects = ["power", "route", "voyage", "pier"];
  for (const team of Object.values(state.teams)) team.resources = { energy: 0, intel: 0, gear: 0, network: 0 };
  for (const property of state.properties) property.owner = null;
  mutateGame(state, "settleGame", {});

  assert.equal(state.teams.red.cash, startingCash.red + 18);
  assert.equal(state.teams.blue.cash, startingCash.blue + 6);
  assert.equal(state.teams.gold.cash, startingCash.gold + 6);
});

test("GM rejection returns C5 reserved resources", () => {
  const state = makeInitialState("demo");
  state.teams.red.stationIndex = 16;
  mutateGame(state, "startTask", { teamId: "red", taskId: "C5" });
  mutateGame(state, "submitTask", { teamId: "red", taskId: "C5", contribution: { energy: 2 } });
  const run = state.taskRuns.find((item) => item.teamId === "red" && item.taskId === "C5");

  assert.equal(state.teams.red.resources.energy, 1);
  mutateGame(state, "resolveTask", { runId: run.id, approved: false });

  assert.equal(state.teams.red.resources.energy, 3);
  assert.equal(run.status, "rejected");
  assert.equal(run.contribution, undefined);
});

test("final settlement returns any unconfirmed C5 reservations without the $6 bonus", () => {
  const state = makeInitialState("demo");
  state.teams.red.stationIndex = 16;
  mutateGame(state, "startTask", { teamId: "red", taskId: "C5" });
  mutateGame(state, "submitTask", { teamId: "red", taskId: "C5", contribution: { energy: 2 } });
  for (const team of Object.values(state.teams)) team.projects = ["power", "route", "voyage", "pier"];
  state.teams.blue.resources = { energy: 0, intel: 0, gear: 0, network: 0 };
  state.teams.gold.resources = { energy: 0, intel: 0, gear: 0, network: 0 };
  for (const property of state.properties) property.owner = null;
  const before = state.teams.red.cash;

  mutateGame(state, "settleGame", {});

  assert.equal(state.teams.red.cash, before + 30);
  assert.equal(state.taskRuns.find((run) => run.teamId === "red" && run.taskId === "C5").status, "rejected");
});

test("legacy completed C5 runs are not paid twice", () => {
  const state = makeInitialState("demo");
  state.taskRuns.push({ id: "legacy", taskId: "C5", teamId: "red", status: "completed", startedAt: new Date().toISOString(), contribution: { energy: 2, intel: 0, gear: 0, network: 0 } });
  for (const team of Object.values(state.teams)) {
    team.projects = ["power", "route", "voyage", "pier"];
    team.resources = { energy: 0, intel: 0, gear: 0, network: 0 };
  }
  for (const property of state.properties) property.owner = null;
  const before = state.teams.red.cash;
  mutateGame(state, "settleGame", {});
  assert.equal(state.teams.red.cash, before);
});
