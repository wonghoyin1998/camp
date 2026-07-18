import assert from "node:assert/strict";
import test from "node:test";

import { makeInitialState, mutateGame } from "../lib/game-state.ts";

function completeIn(state, teamId, propertyId, milliseconds) {
  mutateGame(state, "startPropertyTimer", { teamId, propertyId });
  const attempt = [...state.propertyAttempts].reverse().find((item) => item.teamId === teamId && item.propertyId === propertyId && item.status === "running");
  attempt.startedAt = new Date(Date.now() - milliseconds).toISOString();
  mutateGame(state, "finishPropertyTimer", { teamId, propertyId });
  return attempt;
}

test("P1-P6 timer establishes a record and requires later teams to be strictly faster", () => {
  const state = makeInitialState("live");
  state.phase = "morning";

  const first = completeIn(state, "red", "P1", 10_000);
  assert.equal(first.success, true);
  assert.equal(first.benchmarkMs, undefined);
  assert.ok(first.elapsedMs >= 9_900 && first.elapsedMs <= 10_100);

  const slower = completeIn(state, "blue", "P1", 12_000);
  assert.equal(slower.success, false);
  assert.equal(slower.benchmarkMs, first.elapsedMs);

  const faster = completeIn(state, "gold", "P1", 8_000);
  assert.equal(faster.success, true);
  assert.equal(faster.benchmarkMs, first.elapsedMs);

  mutateGame(state, "requestChallenge", { teamId: "gold", propertyId: "P1", resource: "energy" });
  const challenge = state.challenges.at(-1);
  assert.equal(challenge.propertyAttemptId, faster.id);
  assert.equal(challenge.elapsedMs, faster.elapsedMs);
  assert.ok(faster.claimedAt);

  mutateGame(state, "resolveChallenge", { challengeId: challenge.id, won: false });
  assert.equal(faster.success, false, "GM rejection removes an invalid physical result from the benchmark");
});

test("a tied displayed time fails and no challenge can be submitted without a successful timer", () => {
  const state = makeInitialState("live");
  state.phase = "morning";
  const first = completeIn(state, "red", "P2", 5_000);
  const tied = completeIn(state, "blue", "P2", first.elapsedMs);

  assert.equal(tied.elapsedMs, first.elapsedMs);
  assert.equal(tied.success, false);
  assert.throws(
    () => mutateGame(state, "requestChallenge", { teamId: "blue", propertyId: "P2", resource: "gear" }),
    /先完成計時挑戰並快過目前紀錄/,
  );
});

test("only one team can use a property checkpoint at a time", () => {
  const state = makeInitialState("live");
  state.phase = "morning";
  mutateGame(state, "startPropertyTimer", { teamId: "red", propertyId: "P3" });
  assert.throws(
    () => mutateGame(state, "startPropertyTimer", { teamId: "blue", propertyId: "P3" }),
    /另一隊正在使用這個 checkpoint/,
  );
});
