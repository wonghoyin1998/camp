import {
  mutateGame,
  validateTeamPins,
  verifyCredential,
  type GameState,
} from "../../../lib/game-state";
import {
  compareAndSwapState,
  getGmPin,
  readState,
  readTeamPins,
  updateTeamPins,
} from "../../../lib/render-db";

export const dynamic = "force-dynamic";

function response(state: GameState, revision: number, extra: Record<string, unknown> = {}) {
  return Response.json(
    { state, revision, ...extra },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

export async function GET() {
  try {
    const { state, revision } = await readState();
    return response(state, revision);
  } catch (error) {
    const message = error instanceof Error ? error.message : "讀取遊戲失敗。";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      pin?: string;
      payload?: Record<string, unknown>;
    };
    const action = String(body.action ?? "");
    const payload = body.payload ?? {};
    const authenticatedRead = await readState();
    const teamPins = await readTeamPins();
    const gmPin = getGmPin();
    if (!verifyCredential(action, payload, body.pin, teamPins, gmPin)) {
      return Response.json({ error: "登入碼不正確。" }, { status: 401 });
    }
    if (action === "auth") {
      return response(authenticatedRead.state, authenticatedRead.revision, { authenticated: true });
    }
    if (action === "getTeamPins") {
      return response(authenticatedRead.state, authenticatedRead.revision, { teamPins });
    }
    if (action === "setTeamPins") {
      const nextPins = validateTeamPins(payload.teamPins, gmPin);
      await updateTeamPins(nextPins);
      return response(authenticatedRead.state, authenticatedRead.revision, { teamPins: nextPins });
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { state, revision } = await readState();
      const next = mutateGame(state, action, payload);
      if (await compareAndSwapState(next, revision)) return response(next, revision + 1);
    }
    return Response.json({ error: "另一隊剛剛更新了遊戲，請再試一次。" }, { status: 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失敗。";
    return Response.json({ error: message }, { status: 400 });
  }
}
