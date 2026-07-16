import {
  applyGameAction,
  GAME_VERSION,
  getCurrentScene,
  getSecondCallResponseState,
} from "../domain/game-engine";
import {
  createInitialGameState,
  type ChoiceHistoryEntry,
  type GameState,
} from "../domain/game-state";
import type { ChoiceId, ClueId, ItemId } from "../domain/ids";
import {
  CLUE_E_TEXT_BY_RESPONSE,
  SCENARIO_001,
} from "../scenarios/scenario-001/scenario";

export const PLAYTEST_SCHEMA_VERSION = "1.0.0" as const;

export interface PlaytestChoiceRecord extends ChoiceHistoryEntry {
  readonly decision_time_ms: number;
}

export interface DisplayedClueRecord {
  readonly clue_id: ClueId;
  readonly displayed_text: string;
}

export interface PlaytestSession {
  readonly session_id: string;
  readonly started_at_ms: number;
  readonly scene_presented_at_ms: number;
  readonly choice_history: readonly PlaytestChoiceRecord[];
}

export interface PlaytestRecord {
  readonly schema_version: typeof PLAYTEST_SCHEMA_VERSION;
  readonly game_version: typeof GAME_VERSION;
  readonly session_id: string;
  readonly scenario_id: typeof SCENARIO_001.id;
  readonly selected_item: ItemId;
  readonly started_at: string;
  readonly ended_at: string;
  readonly total_play_time_ms: number;
  readonly choice_history: readonly PlaytestChoiceRecord[];
  readonly clues: readonly DisplayedClueRecord[];
  readonly response_count: number;
  readonly bell_uses: number;
  readonly outcome: Exclude<GameState["outcome"], "playing">;
  readonly last_choice_id: ChoiceId | null;
}

function requireFiniteTime(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label}には有限の時刻が必要です。`);
  }
}

export function createPlaytestSession(
  sessionId: string,
  startedAtMs: number,
): PlaytestSession {
  if (sessionId.trim().length === 0) {
    throw new Error("セッションIDは空にできません。");
  }
  requireFiniteTime(startedAtMs, "開始時刻");

  return {
    session_id: sessionId,
    started_at_ms: startedAtMs,
    scene_presented_at_ms: startedAtMs,
    choice_history: [],
  };
}

export function markScenePresented(
  session: PlaytestSession,
  presentedAtMs: number,
): PlaytestSession {
  requireFiniteTime(presentedAtMs, "シーン表示時刻");

  return {
    ...session,
    scene_presented_at_ms: presentedAtMs,
  };
}

export function recordChoiceSelection(
  session: PlaytestSession,
  historyEntry: ChoiceHistoryEntry,
  selectedAtMs: number,
): PlaytestSession {
  requireFiniteTime(selectedAtMs, "選択時刻");

  const expectedOrder = session.choice_history.length + 1;
  if (historyEntry.order !== expectedOrder) {
    throw new Error(
      `選択順が一致しません。期待値: ${expectedOrder}、実際: ${historyEntry.order}`,
    );
  }

  return {
    ...session,
    choice_history: [
      ...session.choice_history,
      {
        ...historyEntry,
        decision_time_ms: Math.max(
          0,
          Math.round(selectedAtMs - session.scene_presented_at_ms),
        ),
      },
    ],
  };
}

export function getDisplayedClues(
  state: GameState,
): readonly DisplayedClueRecord[] {
  return state.clues.map((clueId) => ({
    clue_id: clueId,
    displayed_text:
      clueId === "CLUE-E"
        ? CLUE_E_TEXT_BY_RESPONSE[getSecondCallResponseState(state)]
        : SCENARIO_001.clues[clueId].text,
  }));
}

function assertHistoryMatches(
  sessionHistory: readonly PlaytestChoiceRecord[],
  stateHistory: readonly ChoiceHistoryEntry[],
): void {
  if (sessionHistory.length !== stateHistory.length) {
    throw new Error("計測履歴とゲームの選択履歴の件数が一致しません。");
  }

  sessionHistory.forEach((recordedChoice, index) => {
    const stateChoice = stateHistory[index];
    if (
      !stateChoice ||
      recordedChoice.order !== stateChoice.order ||
      recordedChoice.scene_id !== stateChoice.scene_id ||
      recordedChoice.choice_id !== stateChoice.choice_id ||
      recordedChoice.displayed_text !== stateChoice.displayed_text
    ) {
      throw new Error(`選択履歴の${index + 1}件目が一致しません。`);
    }
  });
}

export function completePlaytestRecord(
  session: PlaytestSession,
  state: GameState,
  endedAtMs: number,
): PlaytestRecord {
  requireFiniteTime(endedAtMs, "終了時刻");

  if (state.outcome === "playing") {
    throw new Error("プレイ中の状態から完了記録は作成できません。");
  }

  assertHistoryMatches(session.choice_history, state.choice_history);

  return {
    schema_version: PLAYTEST_SCHEMA_VERSION,
    game_version: GAME_VERSION,
    session_id: session.session_id,
    scenario_id: SCENARIO_001.id,
    selected_item: state.selected_item,
    started_at: new Date(session.started_at_ms).toISOString(),
    ended_at: new Date(endedAtMs).toISOString(),
    total_play_time_ms: Math.max(
      0,
      Math.round(endedAtMs - session.started_at_ms),
    ),
    choice_history: session.choice_history,
    clues: getDisplayedClues(state),
    response_count: state.response_count,
    bell_uses: state.bell_uses,
    outcome: state.outcome,
    last_choice_id: state.choice_history.at(-1)?.choice_id ?? null,
  };
}

export function serializePlaytestRecord(record: PlaytestRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}

export function getPlaytestRecordFilename(record: PlaytestRecord): string {
  return `black-text-playtest-${record.session_id}.json`;
}

function advancePastScenesWithoutChoices(state: GameState): GameState {
  let currentState = state;

  while (
    currentState.outcome === "playing" &&
    getCurrentScene(currentState).choices.length === 0
  ) {
    currentState = applyGameAction(currentState, {
      type: "advance_scene",
    }).state;
  }

  return currentState;
}

export function replayPlaytestRecord(record: PlaytestRecord): GameState {
  if (record.game_version !== GAME_VERSION) {
    throw new Error(`未対応のゲームバージョンです: ${record.game_version}`);
  }

  let state = advancePastScenesWithoutChoices(createInitialGameState());

  for (const choice of record.choice_history) {
    if (state.scene_id !== choice.scene_id) {
      throw new Error(
        `再現時のシーンが一致しません。期待値: ${choice.scene_id}、実際: ${state.scene_id}`,
      );
    }

    state = applyGameAction(state, {
      type: "select_choice",
      selection: {
        choice_id: choice.choice_id,
        displayed_text: choice.displayed_text,
      },
    }).state;

    if (state.outcome === "playing") {
      state = advancePastScenesWithoutChoices(state);
    }
  }

  return state;
}
