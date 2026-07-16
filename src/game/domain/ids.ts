export const SCENE_IDS = [
  "P00",
  "S01",
  "S02",
  "S03",
  "S04",
  "S05",
  "S06",
  "S07",
  "S08",
  "S09",
  "S10",
  "S11",
  "S12",
  "R_CLEAR",
  "R_GAME_OVER",
] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export const CHOICE_IDS = [
  "S01_REPLY",
  "S01_SILENCE",
  "S02_LOOK_HALL",
  "S02_CHECK_NEARBY",
  "S03_READ_NOTICE",
  "S03_CONTINUE",
  "S04_REPLY",
  "S04_RING_BELL",
  "S04_SILENCE",
  "S05_REMEMBER_WORDS",
  "S05_REMEMBER_DIRECTION",
  "S06_INSPECT_BOOK",
  "S06_CLOSE_BOOK",
  "S07_FRONT_HALL",
  "S07_SERVICE_PASSAGE",
  "S08_REPLY",
  "S08_RING_BELL",
  "S08_SILENCE",
  "S10_REREAD_RULE",
  "S10_RECALL_BELL_USES",
  "S11_OPEN_DOOR",
  "S11_RING_BELL",
  "S11_LOOK_BACK",
  "S12_OPEN_DOOR",
  "S12_LOOK_BACK",
] as const;

export type ChoiceId = (typeof CHOICE_IDS)[number];

export type RouteChoiceId = Extract<
  ChoiceId,
  "S07_FRONT_HALL" | "S07_SERVICE_PASSAGE"
>;

export const CLUE_IDS = [
  "CLUE-A",
  "CLUE-B",
  "CLUE-C",
  "CLUE-D",
  "CLUE-E",
] as const;

export type ClueId = (typeof CLUE_IDS)[number];

export const OUTCOMES = ["playing", "clear", "game_over"] as const;

export type Outcome = (typeof OUTCOMES)[number];

export type ItemId = "rusty_bell";
