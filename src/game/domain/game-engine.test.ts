import { describe, expect, it } from "vitest";

import { createInitialGameState, type GameState } from "./game-state";
import { CHOICE_IDS, type ChoiceId, type SceneId } from "./ids";
import {
  applyGameAction,
  GameEngineError,
  getCurrentScene,
  getGameOverReason,
  NEXT_SCENE_BY_CHOICE,
  updateGameState,
} from "./game-engine";
import {
  CLUE_E_TEXT_BY_RESPONSE,
  GAME_OVER_TEXT_BY_REASON,
  S08_RING_BELL_TEXT_BY_ROUTE,
  S10_BELL_RECALL_TEXT,
} from "../scenarios/scenario-001/scenario";

function stateAt(
  sceneId: SceneId,
  overrides: Partial<GameState> = {},
): GameState {
  return {
    ...createInitialGameState(),
    scene_id: sceneId,
    ...overrides,
  };
}

function select(
  state: GameState,
  choiceId: ChoiceId,
  displayedText: string = choiceId,
) {
  return applyGameAction(state, {
    type: "select_choice",
    selection: {
      choice_id: choiceId,
      displayed_text: displayedText,
    },
  });
}

function advance(state: GameState) {
  return applyGameAction(state, { type: "advance_scene" });
}

function expectEngineError(
  operation: () => unknown,
  code: GameEngineError["code"],
): void {
  let thrownError: unknown;

  try {
    operation();
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toBeInstanceOf(GameEngineError);
  expect(thrownError).toMatchObject({ code });
}

function playChoices(choiceIds: readonly ChoiceId[]): GameState {
  let state = advance(createInitialGameState()).state;

  for (const choiceId of choiceIds) {
    state = select(state, choiceId, `表示文:${choiceId}`).state;

    if (state.scene_id === "S09") {
      state = advance(state).state;
    }
  }

  return state;
}

describe("シーン進行と履歴", () => {
  it("P00とS09の「次へ」を履歴へ追加せず、シーン入場時の更新を一度だけ行う", () => {
    const s01 = advance(createInitialGameState()).state;

    expect(s01.scene_id).toBe("S01");
    expect(s01.call_count).toBe(1);
    expect(s01.choice_history).toEqual([]);

    const s09 = stateAt("S09", {
      call_count: 3,
      clues: ["CLUE-C"],
    });
    const s10 = advance(s09).state;

    expect(s10).toEqual({ ...s09, scene_id: "S10" });
    expect(s10.clues).toEqual(["CLUE-C"]);
  });

  it("S01、S04、S08へ入る前にcall_countを増やす", () => {
    let state = advance(createInitialGameState()).state;
    state = select(state, "S01_SILENCE").state;
    state = select(state, "S02_LOOK_HALL").state;
    state = select(state, "S03_CONTINUE").state;

    expect(state.scene_id).toBe("S04");
    expect(state.call_count).toBe(2);

    state = select(state, "S04_SILENCE").state;
    state = select(state, "S05_REMEMBER_DIRECTION").state;
    state = select(state, "S06_CLOSE_BOOK").state;
    state = select(state, "S07_FRONT_HALL").state;

    expect(state.scene_id).toBe("S08");
    expect(state.call_count).toBe(3);
  });

  it("表示文ではなくChoiceIdだけで判定し、表示文は履歴へそのまま残す", () => {
    const displayedText = "返事をする、と見せかけた別表現";
    const result = select(stateAt("S01"), "S01_SILENCE", displayedText);

    expect(result.state.response_count).toBe(0);
    expect(result.state.entity_pressure).toBe(0);
    expect(result.state.choice_history).toEqual([
      {
        order: 1,
        scene_id: "S01",
        choice_id: "S01_SILENCE",
        displayed_text: displayedText,
      },
    ]);
  });

  it("すべての選択肢IDに後続シーンまたは結果がある", () => {
    expect(Object.keys(NEXT_SCENE_BY_CHOICE)).toHaveLength(25);
    expect(Object.values(NEXT_SCENE_BY_CHOICE)).not.toContain(undefined);
  });

  it("初期状態から全分岐をたどっても進行不能にならない", () => {
    const visitedChoiceIds = new Set<ChoiceId>();
    const terminalOutcomes = new Set<GameState["outcome"]>();

    function visit(state: GameState, remainingTransitions: number): void {
      expect(remainingTransitions).toBeGreaterThan(0);

      if (state.outcome !== "playing") {
        terminalOutcomes.add(state.outcome);
        return;
      }

      const scene = getCurrentScene(state);

      if (scene.choices.length === 0) {
        visit(advance(state).state, remainingTransitions - 1);
        return;
      }

      for (const choice of scene.choices) {
        visitedChoiceIds.add(choice.id);
        visit(
          select(state, choice.id, choice.text).state,
          remainingTransitions - 1,
        );
      }
    }

    visit(createInitialGameState(), 20);

    expect([...visitedChoiceIds].sort()).toEqual([...CHOICE_IDS].sort());
    expect(terminalOutcomes).toEqual(new Set(["clear", "game_over"]));
  });
});

describe("状態更新と選択結果文", () => {
  it("返事と鈴の使用で回数と怪異圧力を更新する", () => {
    const response = select(stateAt("S01"), "S01_REPLY").state;
    const bell = select(stateAt("S04"), "S04_RING_BELL").state;

    expect(response.response_count).toBe(1);
    expect(response.entity_pressure).toBe(1);
    expect(bell.bell_uses).toBe(1);
    expect(bell.entity_pressure).toBe(1);
  });

  it("怪異圧力を5へ制限し、安全網でゲームオーバーにする", () => {
    const result = select(
      stateAt("S01", { entity_pressure: 5 }),
      "S01_REPLY",
    );

    expect(result.state.entity_pressure).toBe(5);
    expect(result.state.outcome).toBe("game_over");
    expect(result.game_over_reason).toBe("entity_pressure");
  });

  it("通常更新で怪異圧力が5へ達すると安全網でゲームオーバーにする", () => {
    const result = select(
      stateAt("S01", { entity_pressure: 4 }),
      "S01_REPLY",
    );

    expect(result.state.entity_pressure).toBe(5);
    expect(result.state.outcome).toBe("game_over");
    expect(result.game_over_reason).toBe("entity_pressure");
  });

  it("CLUE-Eの本文を二度目の声が表示された時点の返答状況に合わせる", () => {
    const noReply = select(
      stateAt("S05", {
        response_count: 1,
        choice_history: [
          {
            order: 1,
            scene_id: "S01",
            choice_id: "S01_SILENCE",
            displayed_text: "黙って廊下へ出る",
          },
          {
            order: 2,
            scene_id: "S04",
            choice_id: "S04_REPLY",
            displayed_text: "声に返事をする",
          },
        ],
      }),
      "S05_REMEMBER_WORDS",
    );
    const replied = select(
      stateAt("S05", {
        response_count: 1,
        choice_history: [
          {
            order: 1,
            scene_id: "S01",
            choice_id: "S01_REPLY",
            displayed_text: "「誰かいるのか」と声をかける",
          },
          {
            order: 2,
            scene_id: "S04",
            choice_id: "S04_SILENCE",
            displayed_text: "何も言わず階段へ向かう",
          },
        ],
      }),
      "S05_REMEMBER_WORDS",
    );

    expect(noReply.choice_result_text).toBe(CLUE_E_TEXT_BY_RESPONSE.none);
    expect(replied.choice_result_text).toBe(CLUE_E_TEXT_BY_RESPONSE.replied);
    expect(noReply.state.clues).toContain("CLUE-E");
    expect(replied.state.clues).toContain("CLUE-E");
  });

  it("S06の本文表示とCLUE-B・CLUE-Dの追加を同じ選択結果で行う", () => {
    const inspected = select(stateAt("S06"), "S06_INSPECT_BOOK");
    const closed = select(stateAt("S06"), "S06_CLOSE_BOOK");

    expect(inspected.choice_result_text).toContain("二度目までは、人の声");
    expect(inspected.choice_result_text).toContain("鳴らした音は、戻ってくる");
    expect(inspected.state.clues).toEqual(["CLUE-B", "CLUE-D"]);
    expect(closed.choice_result_text).toBeNull();
    expect(closed.state.clues).toEqual([]);
  });

  it("S09の本文が確定した時点でCLUE-Cを一度だけ追加する", () => {
    const s09 = select(
      stateAt("S08", {
        call_count: 3,
        choice_history: [
          {
            order: 1,
            scene_id: "S07",
            choice_id: "S07_FRONT_HALL",
            displayed_text: "正面廊下を進む",
          },
        ],
      }),
      "S08_SILENCE",
    ).state;

    expect(s09.scene_id).toBe("S09");
    expect(s09.clues).toEqual(["CLUE-C"]);
    expect(advance(s09).state.clues).toEqual(["CLUE-C"]);
  });

  it.each([
    ["S07_FRONT_HALL", "正面廊下"],
    ["S07_SERVICE_PASSAGE", "従業員用通路"],
  ] as const)("S08の鈴の反響を%sの背後に固定する", (routeId, routeText) => {
    const state = stateAt("S08", {
      choice_history: [
        {
          order: 1,
          scene_id: "S07",
          choice_id: routeId,
          displayed_text: routeText,
        },
      ],
    });
    const result = select(state, "S08_RING_BELL");

    expect(result.choice_result_text).toBe(
      S08_RING_BELL_TEXT_BY_ROUTE[routeId],
    );
    expect(result.choice_result_text).toContain(routeText);
  });

  it.each([0, 1, 2] as const)(
    "S10で鈴の使用回数%d回を文章として振り返る",
    (bellUses) => {
      const result = select(
        stateAt("S10", { bell_uses: bellUses }),
        "S10_RECALL_BELL_USES",
      );

      expect(result.choice_result_text).toBe(S10_BELL_RECALL_TEXT[bellUses]);
    },
  );

  it("S04本文をそれ以前の返答状況に応じて解決する", () => {
    expect(getCurrentScene(stateAt("S04")).text).toContain(
      "あなたの声に似ていた",
    );
    expect(
      getCurrentScene(
        stateAt("S04", {
          response_count: 1,
          choice_history: [
            {
              order: 1,
              scene_id: "S01",
              choice_id: "S01_REPLY",
              displayed_text: "「誰かいるのか」と声をかける",
            },
          ],
        }),
      ).text,
    ).toContain("あなたが口にした声だった");
  });
});

describe("クリア判定", () => {
  it("CLUE-Bを発見し、怪異圧力2以下で直接脱出するとクリアする", () => {
    const state = playChoices([
      "S01_SILENCE",
      "S02_CHECK_NEARBY",
      "S03_READ_NOTICE",
      "S04_SILENCE",
      "S05_REMEMBER_WORDS",
      "S06_INSPECT_BOOK",
      "S07_SERVICE_PASSAGE",
      "S08_SILENCE",
      "S10_REREAD_RULE",
      "S11_OPEN_DOOR",
    ]);

    expect(state.scene_id).toBe("R_CLEAR");
    expect(state.outcome).toBe("clear");
    expect(state.clues).toEqual([
      "CLUE-A",
      "CLUE-E",
      "CLUE-B",
      "CLUE-D",
      "CLUE-C",
    ]);
  });

  it("二回以内の鈴で背後を確認し、振り返らず扉を開けるとクリアする", () => {
    const ring = select(
      stateAt("S11", { bell_uses: 1, entity_pressure: 1 }),
      "S11_RING_BELL",
    );

    expect(ring.state.scene_id).toBe("S12");
    expect(ring.state.bell_uses).toBe(2);
    expect(ring.state.entity_pressure).toBe(2);

    const escaped = select(ring.state, "S12_OPEN_DOOR").state;
    expect(escaped.scene_id).toBe("R_CLEAR");
    expect(escaped.outcome).toBe("clear");
  });
});

describe("ゲームオーバー判定", () => {
  it("CLUE-B未発見で直接脱出するとゲームオーバーにする", () => {
    const result = select(stateAt("S11"), "S11_OPEN_DOOR");

    expect(result.state.outcome).toBe("game_over");
    expect(result.game_over_reason).toBe("direct_escape_failure");
  });

  it("CLUE-B発見済みでも怪異圧力3以上なら直接脱出を失敗させる", () => {
    const result = select(
      stateAt("S11", { clues: ["CLUE-B"], entity_pressure: 3 }),
      "S11_OPEN_DOOR",
    );

    expect(result.state.outcome).toBe("game_over");
    expect(result.game_over_reason).toBe("direct_escape_failure");
  });

  it("三度目の声への返事を致命的違反として即時ゲームオーバーにする", () => {
    const result = select(stateAt("S08", { call_count: 3 }), "S08_REPLY");

    expect(result.state).toMatchObject({
      scene_id: "R_GAME_OVER",
      outcome: "game_over",
      response_count: 1,
      entity_pressure: 5,
      fatal_violation: true,
    });
    expect(result.game_over_reason).toBe("fatal_response");
    expect(result.choice_result_text).toBe(
      GAME_OVER_TEXT_BY_REASON.fatal_response,
    );
  });

  it("鈴を更新後に三回目の使用を判定してゲームオーバーにする", () => {
    const result = select(
      stateAt("S11", { bell_uses: 2, entity_pressure: 2 }),
      "S11_RING_BELL",
    );

    expect(result.state.bell_uses).toBe(3);
    expect(result.state.entity_pressure).toBe(3);
    expect(result.state.outcome).toBe("game_over");
    expect(result.game_over_reason).toBe("bell_overuse");
    expect(result.choice_result_text).toBe(
      GAME_OVER_TEXT_BY_REASON.bell_overuse,
    );
  });

  it.each(["S11_LOOK_BACK", "S12_LOOK_BACK"] as const)(
    "%sで背後を振り返るとゲームオーバーにする",
    (choiceId) => {
      const sceneId = choiceId.startsWith("S11") ? "S11" : "S12";
      const result = select(stateAt(sceneId), choiceId);

      expect(result.state.outcome).toBe("game_over");
      expect(result.game_over_reason).toBe("look_back");
    },
  );

  it.each([
    {
      condition: "CLUE-B未発見",
      state: { bell_uses: 2, entity_pressure: 2 } satisfies Partial<GameState>,
    },
    {
      condition: "怪異圧力3以上",
      state: {
        bell_uses: 2,
        entity_pressure: 3,
        clues: ["CLUE-B"],
      } satisfies Partial<GameState>,
    },
  ])(
    "鈴を二回使い$conditionなら、S11の全選択肢をゲームオーバーにする",
    ({ state }) => {
      const choiceIds = [
        "S11_OPEN_DOOR",
        "S11_RING_BELL",
        "S11_LOOK_BACK",
      ] as const;

      for (const choiceId of choiceIds) {
        expect(select(stateAt("S11", state), choiceId).state.outcome).toBe(
          "game_over",
        );
      }
    },
  );

  it("結果状態から原因別ゲームオーバー文を再解決できる", () => {
    const result = select(stateAt("S08"), "S08_REPLY");

    expect(getGameOverReason(result.state)).toBe("fatal_response");
    expect(getCurrentScene(result.state).text).toBe(
      GAME_OVER_TEXT_BY_REASON.fatal_response,
    );
  });
});

describe("純粋性と不正入力", () => {
  it("同じ初期状態と選択肢ID列から同じ最終状態を返す", () => {
    const choices = [
      "S01_SILENCE",
      "S02_LOOK_HALL",
      "S03_READ_NOTICE",
      "S04_SILENCE",
      "S05_REMEMBER_DIRECTION",
      "S06_INSPECT_BOOK",
      "S07_FRONT_HALL",
      "S08_SILENCE",
      "S10_RECALL_BELL_USES",
      "S11_OPEN_DOOR",
    ] as const;

    expect(playChoices(choices)).toEqual(playChoices(choices));
  });

  it("updateGameStateは結果オブジェクトを除いた次状態だけを返す", () => {
    const state = stateAt("S01");
    const action = {
      type: "select_choice" as const,
      selection: {
        choice_id: "S01_SILENCE" as const,
        displayed_text: "黙って進む",
      },
    };

    expect(updateGameState(state, action)).toEqual(
      applyGameAction(state, action).state,
    );
  });

  it("不正な選択肢IDを明示的なエラーにし、元の状態を変更しない", () => {
    const state = stateAt("S01");
    const snapshot = structuredClone(state);

    expectEngineError(
      () => select(state, "S12_OPEN_DOOR"),
      "invalid_choice",
    );
    expect(state).toEqual(snapshot);
  });

  it("不正なシーンIDを明示的なエラーにし、元の状態を変更しない", () => {
    const state = stateAt("S01", {
      scene_id: "UNKNOWN" as SceneId,
    });
    const snapshot = structuredClone(state);

    expectEngineError(() => advance(state), "invalid_scene");
    expect(state).toEqual(snapshot);
  });

  it("選択肢があるシーンで「次へ」を実行できない", () => {
    expectEngineError(() => advance(stateAt("S01")), "invalid_action");
  });

  it("結果確定後の追加操作を拒否する", () => {
    const finished = stateAt("R_CLEAR", { outcome: "clear" });

    expectEngineError(() => advance(finished), "game_already_finished");
  });

  it("S08の鈴使用時に経路履歴がなければ明示的なエラーにする", () => {
    expectEngineError(
      () => select(stateAt("S08"), "S08_RING_BELL"),
      "missing_route_history",
    );
  });
});
