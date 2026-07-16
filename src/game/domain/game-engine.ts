import type {
  ChoiceHistoryEntry,
  GameAction,
  GameState,
} from "./game-state";
import type { ChoiceId, ClueId, RouteChoiceId, SceneId } from "./ids";
import {
  GAME_OVER_TEXT_BY_REASON,
  SCENARIO_001_SCENES,
  S04_TEXT_BY_RESPONSE,
  S08_RING_BELL_TEXT_BY_ROUTE,
  S10_BELL_RECALL_TEXT,
  type FixedChoice,
  type FixedScene,
  type GameOverReason,
} from "../scenarios/scenario-001/scenario";

export type GameEngineErrorCode =
  | "invalid_scene"
  | "invalid_action"
  | "invalid_choice"
  | "missing_route_history"
  | "game_already_finished";

export class GameEngineError extends Error {
  readonly code: GameEngineErrorCode;

  constructor(code: GameEngineErrorCode, message: string) {
    super(message);
    this.name = "GameEngineError";
    this.code = code;
  }
}

export interface GameActionResult {
  readonly state: GameState;
  readonly choice_result_text: string | null;
  readonly game_over_reason: GameOverReason | null;
}

export const NEXT_SCENE_BY_CHOICE = {
  S01_REPLY: "S02",
  S01_SILENCE: "S02",
  S02_LOOK_HALL: "S03",
  S02_CHECK_NEARBY: "S03",
  S03_READ_NOTICE: "S04",
  S03_CONTINUE: "S04",
  S04_REPLY: "S05",
  S04_RING_BELL: "S05",
  S04_SILENCE: "S05",
  S05_REMEMBER_WORDS: "S06",
  S05_REMEMBER_DIRECTION: "S06",
  S06_INSPECT_BOOK: "S07",
  S06_CLOSE_BOOK: "S07",
  S07_FRONT_HALL: "S08",
  S07_SERVICE_PASSAGE: "S08",
  S08_REPLY: "R_GAME_OVER",
  S08_RING_BELL: "S09",
  S08_SILENCE: "S09",
  S10_REREAD_RULE: "S11",
  S10_RECALL_BELL_USES: "S11",
  S11_OPEN_DOOR: "R_CLEAR",
  S11_RING_BELL: "S12",
  S11_LOOK_BACK: "R_GAME_OVER",
  S12_OPEN_DOOR: "R_CLEAR",
  S12_LOOK_BACK: "R_GAME_OVER",
} as const satisfies Readonly<Record<ChoiceId, SceneId>>;

const NEXT_SCENE_BY_ADVANCE = {
  P00: "S01",
  S09: "S10",
} as const satisfies Partial<Readonly<Record<SceneId, SceneId>>>;

const CALL_SCENE_IDS: readonly SceneId[] = ["S01", "S04", "S08"];
const RESPONSE_CHOICE_IDS: readonly ChoiceId[] = ["S01_REPLY", "S04_REPLY"];
const BELL_CHOICE_IDS: readonly ChoiceId[] = [
  "S04_RING_BELL",
  "S08_RING_BELL",
  "S11_RING_BELL",
];
const LOOK_BACK_CHOICE_IDS: readonly ChoiceId[] = [
  "S11_LOOK_BACK",
  "S12_LOOK_BACK",
];

function getScene(sceneId: SceneId): FixedScene {
  const scene = SCENARIO_001_SCENES[sceneId];

  if (!scene) {
    throw new GameEngineError(
      "invalid_scene",
      `未定義のシーンIDです: ${String(sceneId)}`,
    );
  }

  return scene;
}

function getChoice(scene: FixedScene, choiceId: ChoiceId): FixedChoice {
  const choice = scene.choices.find((candidate) => candidate.id === choiceId);

  if (!choice) {
    throw new GameEngineError(
      "invalid_choice",
      `シーン${scene.id}では選択できない選択肢IDです: ${String(choiceId)}`,
    );
  }

  return choice;
}

function clampEntityPressure(value: number): number {
  return Math.max(0, Math.min(5, value));
}

function addClues(
  currentClues: readonly ClueId[],
  revealedClues: readonly ClueId[] | undefined,
): readonly ClueId[] {
  if (!revealedClues || revealedClues.length === 0) {
    return currentClues;
  }

  const clues = new Set(currentClues);
  for (const clueId of revealedClues) {
    clues.add(clueId);
  }
  return [...clues];
}

function enterScene(state: GameState, sceneId: SceneId): GameState {
  const scene = getScene(sceneId);

  return {
    ...state,
    scene_id: sceneId,
    call_count:
      state.call_count + (CALL_SCENE_IDS.includes(sceneId) ? 1 : 0),
    clues: addClues(state.clues, scene.revealed_clue_ids),
  };
}

function appendChoiceHistory(
  state: GameState,
  choiceId: ChoiceId,
  displayedText: string,
): readonly ChoiceHistoryEntry[] {
  return [
    ...state.choice_history,
    {
      order: state.choice_history.length + 1,
      scene_id: state.scene_id,
      choice_id: choiceId,
      displayed_text: displayedText,
    },
  ];
}

function updateChoiceState(
  state: GameState,
  choice: FixedChoice,
  displayedText: string,
): GameState {
  const isResponse = RESPONSE_CHOICE_IDS.includes(choice.id);
  const isFatalResponse = choice.id === "S08_REPLY";
  const isBellUse = BELL_CHOICE_IDS.includes(choice.id);
  const pressureIncrease = Number(isResponse) + Number(isBellUse);

  return {
    ...state,
    choice_history: appendChoiceHistory(state, choice.id, displayedText),
    response_count:
      state.response_count + Number(isResponse || isFatalResponse),
    bell_uses: state.bell_uses + Number(isBellUse),
    entity_pressure: isFatalResponse
      ? 5
      : clampEntityPressure(state.entity_pressure + pressureIncrease),
    clues: addClues(state.clues, choice.result?.revealed_clue_ids),
    fatal_violation: state.fatal_violation || isFatalResponse,
  };
}

function getLastRouteChoice(
  choiceHistory: readonly ChoiceHistoryEntry[],
): RouteChoiceId {
  const routeChoice = [...choiceHistory]
    .reverse()
    .find(
      (entry): entry is ChoiceHistoryEntry & { choice_id: RouteChoiceId } =>
        entry.choice_id === "S07_FRONT_HALL" ||
        entry.choice_id === "S07_SERVICE_PASSAGE",
    );

  if (!routeChoice) {
    throw new GameEngineError(
      "missing_route_history",
      "S08で鈴を鳴らすには、S07の経路選択履歴が必要です。",
    );
  }

  return routeChoice.choice_id;
}

function hasRepliedBeforeSecondCall(state: GameState): boolean {
  return state.choice_history.some(
    (entry) => entry.choice_id === "S01_REPLY",
  );
}

function resolveChoiceResultText(
  state: GameState,
  choice: FixedChoice,
): string | null {
  if (choice.id === "S05_REMEMBER_WORDS") {
    return choice.result?.text_by_response?.[
      hasRepliedBeforeSecondCall(state) ? "replied" : "none"
    ] ?? null;
  }

  if (choice.id === "S08_RING_BELL") {
    return S08_RING_BELL_TEXT_BY_ROUTE[
      getLastRouteChoice(state.choice_history)
    ];
  }

  if (choice.id === "S10_RECALL_BELL_USES") {
    const bellUses = Math.min(2, state.bell_uses) as 0 | 1 | 2;
    return S10_BELL_RECALL_TEXT[bellUses];
  }

  return choice.result?.text ?? null;
}

function canEscapeDirectly(state: GameState): boolean {
  return (
    !state.fatal_violation &&
    state.entity_pressure <= 2 &&
    state.clues.includes("CLUE-B")
  );
}

function canEscapeAfterBell(state: GameState): boolean {
  return (
    !state.fatal_violation &&
    state.bell_uses <= 2 &&
    state.entity_pressure < 5
  );
}

function determineGameOverReason(
  state: GameState,
  choiceId: ChoiceId,
): GameOverReason | null {
  // 具体的な違反を先に特定し、entity_pressureは安全網として扱う。
  if (state.fatal_violation) {
    return "fatal_response";
  }

  if (state.bell_uses >= 3) {
    return "bell_overuse";
  }

  if (state.entity_pressure >= 5) {
    return "entity_pressure";
  }

  if (LOOK_BACK_CHOICE_IDS.includes(choiceId)) {
    return "look_back";
  }

  if (choiceId === "S11_OPEN_DOOR" && !canEscapeDirectly(state)) {
    return "direct_escape_failure";
  }

  return null;
}

function isClearChoice(state: GameState, choiceId: ChoiceId): boolean {
  if (choiceId === "S11_OPEN_DOOR") {
    return canEscapeDirectly(state);
  }

  if (choiceId === "S12_OPEN_DOOR") {
    return canEscapeAfterBell(state);
  }

  return false;
}

function finishGame(
  state: GameState,
  outcome: "clear" | "game_over",
): GameState {
  return {
    ...state,
    scene_id: outcome === "clear" ? "R_CLEAR" : "R_GAME_OVER",
    outcome,
  };
}

function applyAdvanceAction(state: GameState): GameActionResult {
  const nextSceneId = NEXT_SCENE_BY_ADVANCE[
    state.scene_id as keyof typeof NEXT_SCENE_BY_ADVANCE
  ];

  if (!nextSceneId) {
    throw new GameEngineError(
      "invalid_action",
      `シーン${state.scene_id}では「次へ」を実行できません。`,
    );
  }

  return {
    state: enterScene(state, nextSceneId),
    choice_result_text: null,
    game_over_reason: null,
  };
}

function applyChoiceAction(
  state: GameState,
  action: Extract<GameAction, { type: "select_choice" }>,
): GameActionResult {
  const scene = getScene(state.scene_id);
  const choice = getChoice(scene, action.selection.choice_id);
  const choiceResultText = resolveChoiceResultText(state, choice);
  const updatedState = updateChoiceState(
    state,
    choice,
    action.selection.displayed_text,
  );
  const gameOverReason = determineGameOverReason(updatedState, choice.id);

  if (gameOverReason) {
    return {
      state: finishGame(updatedState, "game_over"),
      choice_result_text: GAME_OVER_TEXT_BY_REASON[gameOverReason],
      game_over_reason: gameOverReason,
    };
  }

  if (isClearChoice(updatedState, choice.id)) {
    return {
      state: finishGame(updatedState, "clear"),
      choice_result_text: choiceResultText,
      game_over_reason: null,
    };
  }

  return {
    state: enterScene(updatedState, NEXT_SCENE_BY_CHOICE[choice.id]),
    choice_result_text: choiceResultText,
    game_over_reason: null,
  };
}

export function applyGameAction(
  state: GameState,
  action: GameAction,
): GameActionResult {
  getScene(state.scene_id);

  if (state.outcome !== "playing") {
    throw new GameEngineError(
      "game_already_finished",
      "結果が確定したゲームへ操作を追加することはできません。",
    );
  }

  if (action.type === "advance_scene") {
    return applyAdvanceAction(state);
  }

  if (action.type === "select_choice") {
    return applyChoiceAction(state, action);
  }

  throw new GameEngineError("invalid_action", "未定義の操作です。");
}

export function updateGameState(
  state: GameState,
  action: GameAction,
): GameState {
  return applyGameAction(state, action).state;
}

export function getGameOverReason(state: GameState): GameOverReason | null {
  if (state.outcome !== "game_over") {
    return null;
  }

  const lastChoiceId = state.choice_history.at(-1)?.choice_id;

  if (state.fatal_violation) {
    return "fatal_response";
  }

  if (
    state.bell_uses >= 3 &&
    lastChoiceId !== undefined &&
    BELL_CHOICE_IDS.includes(lastChoiceId)
  ) {
    return "bell_overuse";
  }

  if (state.entity_pressure >= 5) {
    return "entity_pressure";
  }

  if (lastChoiceId && LOOK_BACK_CHOICE_IDS.includes(lastChoiceId)) {
    return "look_back";
  }

  if (lastChoiceId === "S11_OPEN_DOOR") {
    return "direct_escape_failure";
  }

  return null;
}

export function getCurrentScene(state: GameState): FixedScene {
  const scene = getScene(state.scene_id);

  if (scene.id === "S04") {
    return {
      ...scene,
      text: S04_TEXT_BY_RESPONSE[
        hasRepliedBeforeSecondCall(state) ? "replied" : "none"
      ],
    };
  }

  if (scene.id === "R_GAME_OVER") {
    const gameOverReason = getGameOverReason(state);

    return {
      ...scene,
      text: gameOverReason
        ? GAME_OVER_TEXT_BY_REASON[gameOverReason]
        : scene.text,
    };
  }

  return scene;
}
