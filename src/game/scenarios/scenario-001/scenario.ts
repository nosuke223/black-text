import type {
  ChoiceId,
  ClueId,
  RouteChoiceId,
  SceneId,
} from "../../domain/ids";

export type ChoiceClassification =
  | "RESPONSE"
  | "SILENCE"
  | "OBSERVATION"
  | "CLUE_CHECK"
  | "MOVE"
  | "BELL_USE"
  | "ROUTE_CHOICE"
  | "FATAL_RESPONSE"
  | "CLUE_REVIEW"
  | "HISTORY_REVIEW"
  | "ESCAPE_ATTEMPT"
  | "FATAL_LOOK_BACK"
  | "ESCAPE";

export type ResponseState = "none" | "replied";

export type GameOverReason =
  | "fatal_response"
  | "bell_overuse"
  | "look_back"
  | "direct_escape_failure"
  | "entity_pressure";

export interface FixedChoiceResult {
  readonly text?: string;
  readonly text_by_response?: Readonly<Record<ResponseState, string>>;
  readonly revealed_clue_ids?: readonly ClueId[];
}

export interface FixedChoice {
  readonly id: ChoiceId;
  readonly text: string;
  readonly classification: ChoiceClassification;
  readonly meaning: string;
  readonly result?: FixedChoiceResult;
}

export interface FixedScene {
  readonly id: SceneId;
  readonly title: string;
  readonly text: string;
  readonly choices: readonly FixedChoice[];
  readonly revealed_clue_ids?: readonly ClueId[];
}

export interface ClueDefinition {
  readonly id: ClueId;
  readonly strength: "weak" | "medium" | "strong";
  readonly text: string;
  readonly canonical_meaning: string;
}

function lines(...values: readonly string[]): string {
  return values.join("\n");
}

export const GENERIC_GAME_OVER_TEXT = lines(
  "記録は、ここで途切れている。",
  "",
  "最後に残った文字は、",
  "あなたが選んだ言葉と同じだった。",
);

export const GAME_OVER_TEXT_BY_REASON = {
  fatal_response: lines("返事をしたのは、", "", "どちらですか。"),
  bell_overuse: "そこにいた。",
  look_back: GENERIC_GAME_OVER_TEXT,
  direct_escape_failure: GENERIC_GAME_OVER_TEXT,
  entity_pressure: GENERIC_GAME_OVER_TEXT,
} as const satisfies Readonly<Record<GameOverReason, string>>;

export const SCENARIO_001_CLUES: Readonly<Record<ClueId, ClueDefinition>> = {
  "CLUE-A": {
    id: "CLUE-A",
    strength: "weak",
    text: "二度までは、同じだった",
    canonical_meaning: "呼びかけの回数に意味がある",
  },
  "CLUE-B": {
    id: "CLUE-B",
    strength: "medium",
    text: "二度目までは、人の声",
    canonical_meaning: "三度目の声は人ではない",
  },
  "CLUE-C": {
    id: "CLUE-C",
    strength: "strong",
    text: "三度目には、返事をしないこと",
    canonical_meaning: "三度目には返事をしない",
  },
  "CLUE-D": {
    id: "CLUE-D",
    strength: "weak",
    text: "鳴らした音は、戻ってくる",
    canonical_meaning: "鈴の使用には代償がある",
  },
  "CLUE-E": {
    id: "CLUE-E",
    strength: "weak",
    text: "二度目の声は、先の言葉またはあなたの声をまねていた",
    canonical_meaning: "怪異はプレイヤーの反応を材料に模倣する",
  },
};

export const S04_TEXT_BY_RESPONSE = {
  none: lines(
    "一階から、",
    "",
    "「そこにいるの」",
    "",
    "と聞こえた。",
    "",
    "今度は、",
    "",
    "あなたの声に似ていた。",
  ),
  replied: lines(
    "一階から、",
    "",
    "「誰かいるのか」",
    "",
    "と聞こえた。",
    "",
    "さっき、",
    "",
    "あなたが口にした声だった。",
  ),
} as const satisfies Readonly<Record<ResponseState, string>>;

export const CLUE_E_TEXT_BY_RESPONSE = {
  none: "二度目の声は、あなたの声をなぞっていた。",
  replied: "二度目の声は、あなたの言葉をまねていた。",
} as const satisfies Readonly<Record<ResponseState, string>>;

export const S08_RING_BELL_TEXT_BY_ROUTE = {
  S07_FRONT_HALL: lines(
    "ちりん。",
    "",
    "反響は、",
    "",
    "今しがた通ってきた正面廊下の背後から返った。",
  ),
  S07_SERVICE_PASSAGE: lines(
    "ちりん。",
    "",
    "反響は、",
    "",
    "今しがた通ってきた従業員用通路の背後から返った。",
  ),
} as const satisfies Readonly<Record<RouteChoiceId, string>>;

export const S10_BELL_RECALL_TEXT = {
  0: "まだ一度も、鈴の音を返していない。",
  1: "これまでに、鈴の音を一度だけ返した。",
  2: "これまでに、鈴の音を二度返した。次が三度目になる。",
} as const satisfies Readonly<Record<0 | 1 | 2, string>>;

export const RECORD_COPY = {
  heading: "RECORD",
  selected_item_label: "選択した物",
  clues_label: "確認した記録",
  response_count_label: "声に返事をした回数",
  bell_uses_label: "鈴を鳴らした回数",
  last_choice_label: "最後の選択",
  save_label: "プレイテスト記録を保存",
  retry_label: "もう一度試す",
} as const;

export const SCENARIO_001_SCENES: Readonly<Record<SceneId, FixedScene>> = {
  P00: {
    id: "P00",
    title: "錆びた鈴",
    text: lines(
      "錆びた鈴を手に取った。",
      "",
      "黒ずんだ金属は、",
      "夜気よりも冷たかった。",
    ),
    choices: [],
  },
  S01: {
    id: "S01",
    title: "最初の声",
    text: lines(
      "二階の奥から、",
      "",
      "「ねえ」",
      "",
      "と聞こえた。",
      "",
      "人の声には違いなかった。",
      "",
      "けれど、",
      "",
      "誰かを呼んでいる声には聞こえなかった。",
    ),
    choices: [
      {
        id: "S01_REPLY",
        text: "「誰かいるのか」と声をかける",
        classification: "RESPONSE",
        meaning: "最初の声へ返事する",
      },
      {
        id: "S01_SILENCE",
        text: "黙って廊下へ出る",
        classification: "SILENCE",
        meaning: "返事をせず廊下へ出る",
      },
    ],
  },
  S02: {
    id: "S02",
    title: "廊下の見方",
    text: lines(
      "客室の扉を開けた。",
      "",
      "廊下の奥は暗い。",
      "",
      "声がした先には、",
      "",
      "何もいない。",
      "",
      "ただ、",
      "",
      "床板の軋みが一度だけ近づいた。",
    ),
    choices: [
      {
        id: "S02_LOOK_HALL",
        text: "声がした廊下の奥を見る",
        classification: "OBSERVATION",
        meaning: "声がした廊下の奥を見る",
      },
      {
        id: "S02_CHECK_NEARBY",
        text: "自分の足元と扉の周囲を確かめる",
        classification: "OBSERVATION",
        meaning: "自分の足元と扉の周囲を確かめる",
      },
    ],
  },
  S03: {
    id: "S03",
    title: "破れた張り紙",
    text: lines(
      "廊下の壁に、紙が残っている。",
      "",
      "「二度までは、同じだった」",
      "",
      "その下は、",
      "",
      "爪で削られたように読めない。",
    ),
    choices: [
      {
        id: "S03_READ_NOTICE",
        text: "紙を詳しく読む",
        classification: "CLUE_CHECK",
        meaning: "張り紙を詳しく読む",
        result: {
          revealed_clue_ids: ["CLUE-A"],
        },
      },
      {
        id: "S03_CONTINUE",
        text: "階段へ進む",
        classification: "MOVE",
        meaning: "張り紙を詳しく読まず進む",
      },
    ],
  },
  S04: {
    id: "S04",
    title: "二度目の声",
    text: S04_TEXT_BY_RESPONSE.none,
    choices: [
      {
        id: "S04_REPLY",
        text: "声に返事をする",
        classification: "RESPONSE",
        meaning: "二度目の声へ返事する",
      },
      {
        id: "S04_RING_BELL",
        text: "鈴を鳴らす",
        classification: "BELL_USE",
        meaning: "鈴で方向を確認する",
        result: {
          text: lines(
            "ちりん。",
            "",
            "反響は、",
            "",
            "階段とは反対方向から返った。",
          ),
        },
      },
      {
        id: "S04_SILENCE",
        text: "何も言わず階段へ向かう",
        classification: "SILENCE",
        meaning: "返事をせず進む",
      },
    ],
  },
  S05: {
    id: "S05",
    title: "二度目の声の記録",
    text: lines(
      "声が途切れたあとも、",
      "",
      "何をまねされたのかだけが残った。",
      "",
      "言葉か。",
      "",
      "声か。",
      "",
      "それとも、",
      "",
      "返事を待つ間か。",
    ),
    choices: [
      {
        id: "S05_REMEMBER_WORDS",
        text: "声が使った言葉を覚える",
        classification: "CLUE_CHECK",
        meaning: "二度目の声が使った言葉を覚える",
        result: {
          text_by_response: CLUE_E_TEXT_BY_RESPONSE,
          revealed_clue_ids: ["CLUE-E"],
        },
      },
      {
        id: "S05_REMEMBER_DIRECTION",
        text: "声がした方向と間隔を覚える",
        classification: "OBSERVATION",
        meaning: "声がした方向と間隔を覚える",
      },
    ],
  },
  S06: {
    id: "S06",
    title: "宿帳",
    text: lines(
      "帳場に、宿帳が開かれている。",
      "",
      "最後の行だけが、",
      "",
      "乾いた黒い染みで半分隠れている。",
      "",
      "「二度目までは、――」",
      "",
      "続きは、貼りついた次の頁に隠れている。",
    ),
    choices: [
      {
        id: "S06_INSPECT_BOOK",
        text: "宿帳を詳しく調べる",
        classification: "CLUE_CHECK",
        meaning: "宿帳を詳しく調べ、隠れた記述を読む",
        result: {
          text: lines(
            "貼りついた頁を剥がす。",
            "",
            "「二度目までは、人の声」",
            "",
            "その裏面には、",
            "",
            "「鳴らした音は、戻ってくる」",
            "",
            "と書かれていた。",
          ),
          revealed_clue_ids: ["CLUE-B", "CLUE-D"],
        },
      },
      {
        id: "S06_CLOSE_BOOK",
        text: "宿帳を閉じる",
        classification: "MOVE",
        meaning: "宿帳を閉じる",
      },
    ],
  },
  S07: {
    id: "S07",
    title: "玄関までの道",
    text: lines(
      "帳場から玄関へは、",
      "",
      "二つの道が伸びている。",
      "",
      "正面廊下には、",
      "",
      "弱い明かりが残っている。",
      "",
      "従業員用通路からは、",
      "",
      "何の物音も聞こえない。",
    ),
    choices: [
      {
        id: "S07_FRONT_HALL",
        text: "明かりの残る正面廊下を進む",
        classification: "ROUTE_CHOICE",
        meaning: "明かりの残る正面廊下を進む",
      },
      {
        id: "S07_SERVICE_PASSAGE",
        text: "物音のしない従業員用通路を進む",
        classification: "ROUTE_CHOICE",
        meaning: "物音のしない従業員用通路を進む",
      },
    ],
  },
  S08: {
    id: "S08",
    title: "三度目の声",
    text: lines(
      "玄関へ続く廊下で、",
      "",
      "声がした。",
      "",
      "「ねえ」",
      "",
      "少し間を置いて、",
      "",
      "「そこにいるんでしょう」",
      "",
      "そして、",
      "",
      "あなたが最初に選んだ物の名前を言った。",
      "",
      "「錆びた鈴」",
    ),
    choices: [
      {
        id: "S08_REPLY",
        text: "「知っている」と返す",
        classification: "FATAL_RESPONSE",
        meaning: "三度目の声へ返事する",
      },
      {
        id: "S08_RING_BELL",
        text: "鈴を鳴らす",
        classification: "BELL_USE",
        meaning: "三度目に鈴を鳴らす",
      },
      {
        id: "S08_SILENCE",
        text: "口を押さえて進む",
        classification: "SILENCE",
        meaning: "口を押さえて進む",
      },
    ],
  },
  S09: {
    id: "S09",
    title: "最後の日記",
    text: lines(
      "玄関脇の机に、",
      "",
      "一枚だけ紙が残っている。",
      "",
      "「三度目には、返事をしないこと」",
      "",
      "その下には、",
      "",
      "「鈴も、あなたの声になる」",
      "",
      "と書かれていた。",
    ),
    choices: [],
    revealed_clue_ids: ["CLUE-C"],
  },
  S10: {
    id: "S10",
    title: "最後の確認",
    text: lines(
      "玄関まで、",
      "",
      "あと数歩しかない。",
      "",
      "日記をたたんだ手に、",
      "",
      "錆びた鈴の重さが残っている。",
    ),
    choices: [
      {
        id: "S10_REREAD_RULE",
        text: "「三度目には、返事をしない」という文面を読み返す",
        classification: "CLUE_REVIEW",
        meaning: "三度目の主法則を読み返す",
      },
      {
        id: "S10_RECALL_BELL_USES",
        text: "これまで鈴を鳴らした回数を思い出す",
        classification: "HISTORY_REVIEW",
        meaning: "これまでの鈴の使用回数を思い出す",
      },
    ],
  },
  S11: {
    id: "S11",
    title: "玄関",
    text: lines(
      "玄関の前に立った。",
      "",
      "扉の向こうから、",
      "",
      "あなたの声がする。",
      "",
      "「開けて」",
      "",
      "「もう大丈夫」",
      "",
      "「外に出られる」",
    ),
    choices: [
      {
        id: "S11_OPEN_DOOR",
        text: "扉を開ける",
        classification: "ESCAPE_ATTEMPT",
        meaning: "鈴を使わず玄関を開ける",
      },
      {
        id: "S11_RING_BELL",
        text: "鈴を鳴らす",
        classification: "BELL_USE",
        meaning: "最終局面で怪異の方向を確認する",
      },
      {
        id: "S11_LOOK_BACK",
        text: "後ろを振り返る",
        classification: "FATAL_LOOK_BACK",
        meaning: "背後を振り返る",
      },
    ],
  },
  S12: {
    id: "S12",
    title: "背後の反響",
    text: lines(
      "ちりん。",
      "",
      "音は、",
      "",
      "扉の向こうではなく、",
      "",
      "あなたの背後から返ってきた。",
    ),
    choices: [
      {
        id: "S12_OPEN_DOOR",
        text: "扉を開ける",
        classification: "ESCAPE",
        meaning: "背後を見ずに玄関を開ける",
      },
      {
        id: "S12_LOOK_BACK",
        text: "振り返る",
        classification: "FATAL_LOOK_BACK",
        meaning: "鈴の反響があった背後を振り返る",
      },
    ],
  },
  R_CLEAR: {
    id: "R_CLEAR",
    title: "生還",
    text: lines(
      "扉を開けた。",
      "",
      "冷たい夜気が、肺に入る。",
      "",
      "背後の声は、もう追ってこなかった。",
    ),
    choices: [],
  },
  R_GAME_OVER: {
    id: "R_GAME_OVER",
    title: "記録終了",
    text: GENERIC_GAME_OVER_TEXT,
    choices: [],
  },
};

export const SCENARIO_001 = {
  id: "SCENARIO-001",
  title: "三度目の呼び声",
  initial_scene_id: "P00",
  selected_item: "rusty_bell",
  scenes: SCENARIO_001_SCENES,
  clues: SCENARIO_001_CLUES,
  game_over_text_by_reason: GAME_OVER_TEXT_BY_REASON,
  record_copy: RECORD_COPY,
} as const;
