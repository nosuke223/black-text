import { describe, expect, it } from "vitest";

import type { ChoiceHistoryEntry, GameAction, GameState } from "./game-state";
import { createInitialGameState, resetGameState } from "./game-state";

describe("createInitialGameState", () => {
  it("MVP仕様の初期状態を生成する", () => {
    expect(createInitialGameState()).toEqual({
      scene_id: "P00",
      selected_item: "rusty_bell",
      choice_history: [],
      outcome: "playing",
      call_count: 0,
      response_count: 0,
      bell_uses: 0,
      entity_pressure: 0,
      clues: [],
      fatal_violation: false,
    });
  });

  it("呼び出すたびに独立した履歴と手掛かり配列を生成する", () => {
    const first = createInitialGameState();
    const second = createInitialGameState();

    expect(first).not.toBe(second);
    expect(first.choice_history).not.toBe(second.choice_history);
    expect(first.clues).not.toBe(second.clues);
  });
});

describe("ゲーム領域の契約", () => {
  it("S07の経路を表示文とともに選択履歴へ保持できる", () => {
    const routeHistory: ChoiceHistoryEntry = {
      order: 7,
      scene_id: "S07",
      choice_id: "S07_SERVICE_PASSAGE",
      displayed_text: "物音のしない従業員用通路を進む",
    };

    expect(routeHistory).toEqual({
      order: 7,
      scene_id: "S07",
      choice_id: "S07_SERVICE_PASSAGE",
      displayed_text: "物音のしない従業員用通路を進む",
    });
  });

  it("選択と次への操作を区別する", () => {
    const actions: GameAction[] = [
      {
        type: "select_choice",
        selection: {
          choice_id: "S01_SILENCE",
          displayed_text: "返事をせず廊下へ出る",
        },
      },
      { type: "advance_scene" },
    ];

    expect(actions.map((action) => action.type)).toEqual([
      "select_choice",
      "advance_scene",
    ]);
  });
});

describe("resetGameState", () => {
  it("再挑戦時にすべての値と配列を新しい初期状態へ戻す", () => {
    const previousHistory: ChoiceHistoryEntry[] = [
      {
        order: 1,
        scene_id: "S01",
        choice_id: "S01_REPLY",
        displayed_text: "返事をする",
      },
    ];
    const previousClues: GameState["clues"] = ["CLUE-A", "CLUE-B"];
    const previousState: GameState = {
      scene_id: "R_GAME_OVER",
      selected_item: "rusty_bell",
      choice_history: previousHistory,
      outcome: "game_over",
      call_count: 3,
      response_count: 2,
      bell_uses: 1,
      entity_pressure: 5,
      clues: previousClues,
      fatal_violation: true,
    };

    const resetState = resetGameState();

    expect(previousState).not.toEqual(resetState);
    expect(resetState).toEqual(createInitialGameState());
    expect(resetState.choice_history).not.toBe(previousHistory);
    expect(resetState.clues).not.toBe(previousClues);
  });
});
