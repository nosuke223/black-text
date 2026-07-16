import type { ChoiceId, ClueId, ItemId, Outcome, SceneId } from "./ids";

export interface ChoiceSelection {
  readonly choice_id: ChoiceId;
  readonly displayed_text: string;
}

export interface ChoiceHistoryEntry extends ChoiceSelection {
  readonly order: number;
  readonly scene_id: SceneId;
}

export type GameAction =
  | {
      readonly type: "select_choice";
      readonly selection: ChoiceSelection;
    }
  | {
      readonly type: "advance_scene";
    };

export interface GameState {
  readonly scene_id: SceneId;
  readonly selected_item: ItemId;
  readonly choice_history: readonly ChoiceHistoryEntry[];
  readonly outcome: Outcome;
  readonly call_count: number;
  readonly response_count: number;
  readonly bell_uses: number;
  readonly entity_pressure: number;
  readonly clues: readonly ClueId[];
  readonly fatal_violation: boolean;
}

export function createInitialGameState(): GameState {
  return {
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
  };
}

export function resetGameState(): GameState {
  return createInitialGameState();
}
