import assert from "node:assert/strict";
import test from "node:test";

import { makeInitialState, mutateGame } from "../lib/game-state.ts";

test("C5 pays $4 per contributed resource only at final settlement", () => {
  const state = makeInitialState("demo");
  const contributions = {
    red: { energy: 2 },
    blue: { intel: 1 },
    gold: { gear: 1, network: 1 },
  };
  const startingCash = Object.fromEntries(Object.entries(state.teams).map(([id, team]) => [id, team.cash]));

  for (const teamId of ["red", "blue", "gold"]) {
    state.teams[teamId].stationIndex = 16;
    mutateGame(state, "startTask", { teamId, taskId: "C5" });
    mutateGame(state, "submitTask", { teamId, taskId: "C5", contribution: contributions[teamId] });
  }
  assert.equal(new Set(state.taskRuns.filter((run) => run.taskId === "C5").map((run) => run.contractCode)).size, 1);
  mutateGame(state, "resolveJointContract", {});

  assert.equal(state.teams.red.cash, startingCash.red);
  assert.equal(state.teams.blue.cash, startingCash.blue);
  assert.equal(state.teams.gold.cash, startingCash.gold);
  assert.equal(state.taskRuns.find((run) => run.teamId === "red" && run.taskId === "C5").jointSettlementValue, 8);
  assert.equal(state.taskRuns.find((run) => run.teamId === "blue" && run.taskId === "C5").jointSettlementValue, 4);
  assert.equal(state.taskRuns.find((run) => run.teamId === "gold" && run.taskId === "C5").jointSettlementValue, 8);

  for (const team of Object.values(state.teams)) team.projects = ["power", "route", "voyage", "pier"];
  for (const team of Object.values(state.teams)) team.resources = { energy: 0, intel: 0, gear: 0, network: 0 };
  for (const property of state.properties) property.owner = null;
  mutateGame(state, "settleGame", {});

  assert.equal(state.teams.red.cash, startingCash.red + 8);
  assert.equal(state.teams.blue.cash, startingCash.blue + 4);
  assert.equal(state.teams.gold.cash, startingCash.gold + 8);
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
