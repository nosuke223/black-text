import { describe, expect, it } from "vitest";

import { applyGameAction } from "../domain/game-engine";
import {
  createInitialGameState,
  type GameState,
} from "../domain/game-state";
import type { ChoiceId } from "../domain/ids";
import {
  completePlaytestRecord,
  createPlaytestSession,
  getDisplayedClues,
  getPlaytestRecordFilename,
  markScenePresented,
  recordChoiceSelection,
  replayPlaytestRecord,
  serializePlaytestRecord,
  type PlaytestSession,
} from "./playtest-record";

function recordSelection(
  state: GameState,
  session: PlaytestSession,
  choiceId: ChoiceId,
  selectedAtMs: number,
): { readonly state: GameState; readonly session: PlaytestSession } {
  const result = applyGameAction(state, {
    type: "select_choice",
    selection: {
      choice_id: choiceId,
      displayed_text: `表示文:${choiceId}`,
    },
  });
  const historyEntry = result.state.choice_history.at(-1);
  if (!historyEntry) {
    throw new Error("選択履歴が追加されませんでした。");
  }

  return {
    state: result.state,
    session: recordChoiceSelection(session, historyEntry, selectedAtMs),
  };
}

function advance(state: GameState): GameState {
  return applyGameAction(state, { type: "advance_scene" }).state;
}

describe("プレイテスト計測", () => {
  it("選択肢が表示されてから選ぶまでの時間を0以上で記録する", () => {
    const state = advance(createInitialGameState());
    const session = markScenePresented(
      createPlaytestSession("session-1", 1_000),
      1_200,
    );
    const first = recordSelection(state, session, "S01_SILENCE", 1_650);

    expect(first.session.choice_history[0]).toMatchObject({
      order: 1,
      scene_id: "S01",
      choice_id: "S01_SILENCE",
      displayed_text: "表示文:S01_SILENCE",
      decision_time_ms: 450,
    });

    const nextSession = markScenePresented(first.session, 2_000);
    const second = recordSelection(
      first.state,
      nextSession,
      "S02_LOOK_HALL",
      1_900,
    );
    expect(second.session.choice_history[1]?.decision_time_ms).toBe(0);
  });

  it("完了JSONを同じゲーム版で再生すると最終状態を再現できる", () => {
    let state = advance(createInitialGameState());
    let session = markScenePresented(
      createPlaytestSession("session-replay", 1_000),
      1_100,
    );
    let selectedAtMs = 1_500;

    const choices = [
      "S01_SILENCE",
      "S02_CHECK_NEARBY",
      "S03_READ_NOTICE",
      "S04_REPLY",
      "S05_REMEMBER_WORDS",
      "S06_INSPECT_BOOK",
      "S07_FRONT_HALL",
      "S08_SILENCE",
      "S10_REREAD_RULE",
      "S11_OPEN_DOOR",
    ] as const;

    for (const choiceId of choices) {
      const result = recordSelection(state, session, choiceId, selectedAtMs);
      state = result.state;
      session = result.session;
      selectedAtMs += 500;

      if (state.scene_id === "S09") {
        state = advance(state);
      }
      if (state.outcome === "playing") {
        session = markScenePresented(session, selectedAtMs - 250);
      }
    }

    const record = completePlaytestRecord(session, state, 7_000);
    const replayedState = replayPlaytestRecord(record);

    expect(record).toMatchObject({
      schema_version: "1.0.0",
      game_version: "scenario-001-rules-v1",
      session_id: "session-replay",
      scenario_id: "SCENARIO-001",
      selected_item: "rusty_bell",
      started_at: "1970-01-01T00:00:01.000Z",
      ended_at: "1970-01-01T00:00:07.000Z",
      total_play_time_ms: 6_000,
      response_count: 1,
      bell_uses: 0,
      outcome: "clear",
      last_choice_id: "S11_OPEN_DOOR",
    });
    expect(record.choice_history.every((choice) => choice.decision_time_ms >= 0))
      .toBe(true);
    record.choice_history.forEach((choice, index) => {
      expect(choice).toMatchObject(state.choice_history[index] ?? {});
    });
    expect(record.clues).toContainEqual({
      clue_id: "CLUE-E",
      displayed_text: "二度目の声は、あなたの声をなぞっていた。",
    });
    expect(replayedState).toEqual(state);
  });

  it("JSONとファイル名に公開対象だけを含める", () => {
    let state = advance(createInitialGameState());
    let session = markScenePresented(
      createPlaytestSession("safe-session", 1_000),
      1_100,
    );

    const choices = [
      "S01_SILENCE",
      "S02_LOOK_HALL",
      "S03_CONTINUE",
      "S04_SILENCE",
      "S05_REMEMBER_DIRECTION",
      "S06_CLOSE_BOOK",
      "S07_FRONT_HALL",
      "S08_REPLY",
    ] as const;

    choices.forEach((choiceId, index) => {
      const result = recordSelection(
        state,
        session,
        choiceId,
        1_500 + index * 100,
      );
      state = result.state;
      session = markScenePresented(result.session, 1_550 + index * 100);
    });

    const record = completePlaytestRecord(session, state, 3_000);
    const serialized = serializePlaytestRecord(record);

    expect(getPlaytestRecordFilename(record)).toBe(
      "black-text-playtest-safe-session.json",
    );
    expect(serialized).not.toContain("entity_pressure");
    expect(serialized).not.toContain("fatal_violation");
    expect(serialized).not.toContain("fatal_response");
    expect(serialized).not.toContain("game_over_reason");
    expect(serialized).not.toContain("email");
  });

  it("元のセッションを変更せず、新しいセッションを独立して生成する", () => {
    const first = createPlaytestSession("session-a", 1_000);
    const second = createPlaytestSession("session-b", 2_000);
    const marked = markScenePresented(first, 1_500);

    expect(first).toEqual({
      session_id: "session-a",
      started_at_ms: 1_000,
      scene_presented_at_ms: 1_000,
      choice_history: [],
    });
    expect(marked).not.toBe(first);
    expect(second.session_id).not.toBe(first.session_id);
    expect(second.choice_history).not.toBe(first.choice_history);
  });

  it("CLUE-Eの記録文を一度目の声への返答状況に合わせる", () => {
    const baseState = {
      ...createInitialGameState(),
      clues: ["CLUE-E"],
    } as const satisfies GameState;
    const noReply = getDisplayedClues({
      ...baseState,
      choice_history: [
        {
          order: 1,
          scene_id: "S01",
          choice_id: "S01_SILENCE",
          displayed_text: "黙って廊下へ出る",
        },
      ],
    });
    const replied = getDisplayedClues({
      ...baseState,
      choice_history: [
        {
          order: 1,
          scene_id: "S01",
          choice_id: "S01_REPLY",
          displayed_text: "「誰かいるのか」と声をかける",
        },
      ],
    });

    expect(noReply).toEqual([
      {
        clue_id: "CLUE-E",
        displayed_text: "二度目の声は、あなたの声をなぞっていた。",
      },
    ]);
    expect(replied).toEqual([
      {
        clue_id: "CLUE-E",
        displayed_text: "二度目の声は、あなたの言葉をまねていた。",
      },
    ]);
  });
});
