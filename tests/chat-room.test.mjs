import assert from "node:assert/strict";
import test from "node:test";

import { makeInitialState, mutateGame, verifyCredential } from "../lib/game-state.ts";

const teamPins = { red: "1111", blue: "2222", gold: "3333" };
const gmPin = "9999";

test("chat accepts verified team and GM credentials only", () => {
  assert.equal(verifyCredential("sendChatMessage", { teamId: "red" }, "1111", teamPins, gmPin), true);
  assert.equal(verifyCredential("sendChatMessage", { teamId: "red" }, "2222", teamPins, gmPin), false);
  assert.equal(verifyCredential("sendChatMessage", {}, gmPin, teamPins, gmPin), true);
  assert.equal(verifyCredential("sendChatMessage", {}, "0000", teamPins, gmPin), false);
});

test("chat records server-supplied identity and normalizes message text", () => {
  const state = makeInitialState("live");

  mutateGame(state, "sendChatMessage", {
    senderRole: "team",
    senderTeamId: "red",
    text: "  大家\n好！\t準備開船  ",
  });

  assert.equal(state.chatMessages?.length, 1);
  assert.deepEqual(
    {
      senderRole: state.chatMessages?.[0].senderRole,
      senderTeamId: state.chatMessages?.[0].senderTeamId,
      text: state.chatMessages?.[0].text,
    },
    { senderRole: "team", senderTeamId: "red", text: "大家 好！ 準備開船" },
  );
});

test("chat rejects missing identity, empty or oversized messages, and rapid repeats", () => {
  const state = makeInitialState("live");

  assert.throws(
    () => mutateGame(state, "sendChatMessage", { senderRole: "team", text: "hello" }),
    /確認發言隊伍/,
  );
  assert.throws(
    () => mutateGame(state, "sendChatMessage", { senderRole: "gm", text: "  \n\t " }),
    /不可留空/,
  );
  assert.throws(
    () => mutateGame(state, "sendChatMessage", { senderRole: "gm", text: "字".repeat(281) }),
    /最多 280 個字/,
  );

  mutateGame(state, "sendChatMessage", { senderRole: "gm", text: "第一則" });
  assert.throws(
    () => mutateGame(state, "sendChatMessage", { senderRole: "gm", text: "第二則" }),
    /發送得太快/,
  );
});

test("chat retains only the latest 200 messages", () => {
  const state = makeInitialState("live");
  state.chatMessages = Array.from({ length: 200 }, (_, index) => ({
    id: `old-${index}`,
    senderRole: "team",
    senderTeamId: index % 2 === 0 ? "red" : "blue",
    text: `舊訊息 ${index}`,
    createdAt: "2020-01-01T00:00:00.000Z",
  }));

  mutateGame(state, "sendChatMessage", { senderRole: "gm", text: "最新公告" });

  assert.equal(state.chatMessages.length, 200);
  assert.equal(state.chatMessages[0].id, "old-1");
  assert.equal(state.chatMessages[199].text, "最新公告");
});
