import { describe, expect, it } from "vitest";

import type { ClueId } from "../../domain/ids";
import { CHOICE_IDS, CLUE_IDS, SCENE_IDS } from "../../domain/ids";
import {
  CLUE_E_TEXT_BY_RESPONSE,
  GAME_OVER_TEXT_BY_REASON,
  RECORD_COPY,
  S08_RING_BELL_TEXT_BY_ROUTE,
  SCENARIO_001,
  SCENARIO_001_CLUES,
  SCENARIO_001_SCENES,
} from "./scenario";

const EXPECTED_CHOICE_COUNTS = {
  P00: 0,
  S01: 2,
  S02: 2,
  S03: 2,
  S04: 3,
  S05: 2,
  S06: 2,
  S07: 2,
  S08: 3,
  S09: 0,
  S10: 2,
  S11: 3,
  S12: 2,
  R_CLEAR: 0,
  R_GAME_OVER: 0,
} as const;

describe("SCENARIO_001", () => {
  it("仕様で定義したすべてのシーンを重複なく持つ", () => {
    const sceneIds = Object.values(SCENARIO_001_SCENES).map(
      (scene) => scene.id,
    );

    expect(sceneIds).toHaveLength(new Set(sceneIds).size);
    expect([...sceneIds].sort()).toEqual([...SCENE_IDS].sort());
    expect(SCENARIO_001.initial_scene_id).toBe("P00");

    for (const scene of Object.values(SCENARIO_001_SCENES)) {
      expect(scene.title.trim()).not.toBe("");
      expect(scene.text.trim()).not.toBe("");
    }
  });

  it("仕様で定義したすべての選択肢を重複なく持つ", () => {
    const choices = Object.values(SCENARIO_001_SCENES).flatMap(
      (scene) => scene.choices,
    );
    const choiceIds = choices.map((choice) => choice.id);

    expect(choiceIds).toHaveLength(new Set(choiceIds).size);
    expect([...choiceIds].sort()).toEqual([...CHOICE_IDS].sort());

    for (const choice of choices) {
      expect(choice.text.trim()).not.toBe("");
      expect(choice.classification.trim()).not.toBe("");
      expect(choice.meaning.trim()).not.toBe("");
    }

    for (const scene of Object.values(SCENARIO_001_SCENES)) {
      for (const choice of scene.choices) {
        expect(choice.id.startsWith(`${scene.id}_`)).toBe(true);
      }
    }
  });

  it("各シーンの選択肢数がMVP仕様と一致する", () => {
    for (const sceneId of SCENE_IDS) {
      expect(SCENARIO_001_SCENES[sceneId].choices).toHaveLength(
        EXPECTED_CHOICE_COUNTS[sceneId],
      );
    }
  });

  it("すべての手掛かりに固定文と正準的な意味がある", () => {
    expect(Object.keys(SCENARIO_001_CLUES).sort()).toEqual(
      [...CLUE_IDS].sort(),
    );

    for (const clue of Object.values(SCENARIO_001_CLUES)) {
      expect(clue.text.trim()).not.toBe("");
      expect(clue.canonical_meaning.trim()).not.toBe("");
    }
  });
});

describe("手掛かりの表示境界", () => {
  it("S06の選択前にはCLUE-Bの正確な文を表示しない", () => {
    const clueBText = SCENARIO_001_CLUES["CLUE-B"].text;

    expect(SCENARIO_001_SCENES.S06.text).not.toContain(clueBText);
    expect(SCENARIO_001_SCENES.S06.revealed_clue_ids).toBeUndefined();
  });

  it("S06_INSPECT_BOOKだけがCLUE-BとCLUE-Dの本文を提示する", () => {
    const inspectChoice = SCENARIO_001_SCENES.S06.choices.find(
      (choice) => choice.id === "S06_INSPECT_BOOK",
    );
    const closeChoice = SCENARIO_001_SCENES.S06.choices.find(
      (choice) => choice.id === "S06_CLOSE_BOOK",
    );

    expect(inspectChoice?.result?.text).toContain(
      SCENARIO_001_CLUES["CLUE-B"].text,
    );
    expect(inspectChoice?.result?.text).toContain(
      SCENARIO_001_CLUES["CLUE-D"].text,
    );
    expect(inspectChoice?.result?.revealed_clue_ids).toEqual([
      "CLUE-B",
      "CLUE-D",
    ]);
    expect(closeChoice?.result).toBeUndefined();
  });

  it("CLUE-CはS09の本文表示時だけ提示する", () => {
    const sceneSources = Object.values(SCENARIO_001_SCENES)
      .filter((scene) => scene.revealed_clue_ids?.includes("CLUE-C"))
      .map((scene) => scene.id);

    expect(sceneSources).toEqual(["S09"]);
    expect(SCENARIO_001_SCENES.S09.text).toContain(
      SCENARIO_001_CLUES["CLUE-C"].text,
    );
  });

  it("各手掛かりを仕様どおりの場面だけで提示する", () => {
    const sources = Object.fromEntries(
      CLUE_IDS.map((clueId) => [clueId, [] as string[]]),
    ) as Record<ClueId, string[]>;

    for (const scene of Object.values(SCENARIO_001_SCENES)) {
      for (const clueId of scene.revealed_clue_ids ?? []) {
        sources[clueId].push(scene.id);
      }

      for (const choice of scene.choices) {
        for (const clueId of choice.result?.revealed_clue_ids ?? []) {
          sources[clueId].push(`${scene.id}:${choice.id}`);
        }
      }
    }

    expect(sources).toEqual({
      "CLUE-A": ["S03:S03_READ_NOTICE"],
      "CLUE-B": ["S06:S06_INSPECT_BOOK"],
      "CLUE-C": ["S09"],
      "CLUE-D": ["S06:S06_INSPECT_BOOK"],
      "CLUE-E": ["S05:S05_REMEMBER_WORDS"],
    });
  });

  it("CLUE-Eの本文を返事の有無に応じて切り替える", () => {
    const rememberWordsChoice = SCENARIO_001_SCENES.S05.choices.find(
      (choice) => choice.id === "S05_REMEMBER_WORDS",
    );

    expect(CLUE_E_TEXT_BY_RESPONSE.none).toContain("あなたの声をなぞっていた");
    expect(CLUE_E_TEXT_BY_RESPONSE.none).not.toContain("あなたの言葉");
    expect(CLUE_E_TEXT_BY_RESPONSE.replied).toContain(
      "あなたの言葉をまねていた",
    );
    expect(rememberWordsChoice?.result?.text_by_response).toEqual(
      CLUE_E_TEXT_BY_RESPONSE,
    );
    expect(SCENARIO_001_CLUES["CLUE-E"].text).toContain("または");
  });
});

describe("固定表現", () => {
  it("S08の鈴の反響をS07で選んだ経路の背後へ固定する", () => {
    expect(S08_RING_BELL_TEXT_BY_ROUTE.S07_FRONT_HALL).toContain(
      "正面廊下の背後",
    );
    expect(S08_RING_BELL_TEXT_BY_ROUTE.S07_SERVICE_PASSAGE).toContain(
      "従業員用通路の背後",
    );
  });

  it("結果画面と記録画面に必要な固定文がある", () => {
    expect(SCENARIO_001_SCENES.R_CLEAR.choices).toHaveLength(0);
    expect(SCENARIO_001_SCENES.R_GAME_OVER.choices).toHaveLength(0);
    expect(SCENARIO_001_SCENES.R_CLEAR.text.trim()).not.toBe("");
    expect(SCENARIO_001_SCENES.R_GAME_OVER.text.trim()).not.toBe("");
    expect(RECORD_COPY.heading).toBe("RECORD");
    expect(RECORD_COPY.retry_label.trim()).not.toBe("");
    expect(RECORD_COPY.save_label.trim()).not.toBe("");
  });

  it("すべてのゲームオーバー理由に固定文がある", () => {
    expect(Object.keys(GAME_OVER_TEXT_BY_REASON).sort()).toEqual(
      [
        "fatal_response",
        "bell_overuse",
        "look_back",
        "direct_escape_failure",
        "entity_pressure",
      ].sort(),
    );

    for (const text of Object.values(GAME_OVER_TEXT_BY_REASON)) {
      expect(text.trim()).not.toBe("");
    }

    expect(GAME_OVER_TEXT_BY_REASON.fatal_response).toBe(
      "返事をしたのは、\n\nどちらですか。",
    );
    expect(GAME_OVER_TEXT_BY_REASON.bell_overuse).toBe("そこにいた。");
    expect(GAME_OVER_TEXT_BY_REASON.look_back).toBe(
      SCENARIO_001_SCENES.R_GAME_OVER.text,
    );
    expect(GAME_OVER_TEXT_BY_REASON.direct_escape_failure).toBe(
      SCENARIO_001_SCENES.R_GAME_OVER.text,
    );
    expect(GAME_OVER_TEXT_BY_REASON.entity_pressure).toBe(
      SCENARIO_001_SCENES.R_GAME_OVER.text,
    );
  });
});
