"use client";

import { useEffect, useRef, useState } from "react";

import {
  applyGameAction,
  getCurrentScene,
} from "@/game/domain/game-engine";
import {
  createInitialGameState,
  type GameAction,
} from "@/game/domain/game-state";
import { downloadPlaytestRecord } from "@/game/playtest/download-playtest-record";
import {
  completePlaytestRecord,
  createPlaytestSession,
  getDisplayedClues,
  markScenePresented,
  recordChoiceSelection,
  type PlaytestRecord,
  type PlaytestSession,
} from "@/game/playtest/playtest-record";
import {
  RECORD_COPY,
  type FixedChoice,
} from "@/game/scenarios/scenario-001/scenario";

type ScreenMode = "title" | "play" | "record";

function getCurrentTimeMs(): number {
  return Date.now();
}

function createSessionId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export default function Home() {
  const [screenMode, setScreenMode] = useState<ScreenMode>("title");
  const [gameState, setGameState] = useState(createInitialGameState);
  const [choiceResultText, setChoiceResultText] = useState<string | null>(null);
  const [playtestRecord, setPlaytestRecord] =
    useState<PlaytestRecord | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const interactionLockedRef = useRef(false);
  const playtestSessionRef = useRef<PlaytestSession | null>(null);
  const sceneHeadingRef = useRef<HTMLHeadingElement>(null);
  const recordHeadingRef = useRef<HTMLHeadingElement>(null);

  const scene = getCurrentScene(gameState);
  const isPlaying = gameState.outcome === "playing";
  const displayedClues = playtestRecord?.clues ?? getDisplayedClues(gameState);
  const lastChoiceText =
    gameState.choice_history.at(-1)?.displayed_text ?? "なし";

  useEffect(() => {
    if (screenMode === "record") {
      recordHeadingRef.current?.focus();
      return;
    }

    if (screenMode !== "play") {
      return;
    }

    interactionLockedRef.current = false;
    sceneHeadingRef.current?.focus();

    if (!isPlaying || !playtestSessionRef.current) {
      return;
    }

    try {
      playtestSessionRef.current = markScenePresented(
        playtestSessionRef.current,
        Date.now(),
      );
    } catch {
      playtestSessionRef.current = null;
    }
  }, [gameState, isPlaying, screenMode]);

  function runGameAction(action: GameAction): void {
    if (interactionLockedRef.current) {
      return;
    }

    interactionLockedRef.current = true;

    try {
      const selectedAtMs = getCurrentTimeMs();
      const result = applyGameAction(gameState, action);

      if (action.type === "select_choice" && playtestSessionRef.current) {
        try {
          const historyEntry = result.state.choice_history.at(-1);

          if (!historyEntry) {
            throw new Error("選択履歴を計測できませんでした。");
          }

          const updatedSession = recordChoiceSelection(
            playtestSessionRef.current,
            historyEntry,
            selectedAtMs,
          );
          playtestSessionRef.current = updatedSession;

          if (result.state.outcome !== "playing") {
            setPlaytestRecord(
              completePlaytestRecord(
                updatedSession,
                result.state,
                selectedAtMs,
              ),
            );
          }
        } catch {
          playtestSessionRef.current = null;
          setPlaytestRecord(null);
        }
      }

      setGameState(result.state);
      setChoiceResultText(result.choice_result_text);
    } catch (error) {
      interactionLockedRef.current = false;
      throw error;
    }
  }

  function beginPlay(): void {
    const startedAtMs = getCurrentTimeMs();

    setGameState(createInitialGameState());
    setChoiceResultText(null);
    setPlaytestRecord(null);
    setSaveStatus(null);

    try {
      playtestSessionRef.current = createPlaytestSession(
        createSessionId(),
        startedAtMs,
      );
    } catch {
      playtestSessionRef.current = null;
    }

    setScreenMode("play");
  }

  function handleChoice(choice: FixedChoice): void {
    runGameAction({
      type: "select_choice",
      selection: {
        choice_id: choice.id,
        displayed_text: choice.text,
      },
    });
  }

  function handleSave(): void {
    if (!playtestRecord) {
      setSaveStatus("記録を保存できませんでした。再挑戦は続けられます。");
      return;
    }

    try {
      downloadPlaytestRecord(playtestRecord);
      setSaveStatus("記録を保存しました。");
    } catch {
      setSaveStatus("記録を保存できませんでした。再挑戦は続けられます。");
    }
  }

  function handleExit(): void {
    playtestSessionRef.current = null;
    setGameState(createInitialGameState());
    setChoiceResultText(null);
    setPlaytestRecord(null);
    setSaveStatus(null);
    setScreenMode("title");
  }

  if (screenMode === "title") {
    return (
      <main className="game-shell">
        <section className="title-screen" aria-labelledby="page-title">
          <p className="title-kicker">選択式テキストホラー</p>
          <h1 id="page-title" className="title-logo">
            BLACK TEXT
          </h1>
          <p className="concept-line">選択すること自体が、恐怖になる。</p>
          <button className="start-button" type="button" onClick={beginPlay}>
            <span>はじめる</span>
            <span aria-hidden="true">→</span>
          </button>
        </section>
      </main>
    );
  }

  if (screenMode === "record") {
    return (
      <main className="game-shell">
        <article className="record-frame" aria-labelledby="record-title">
          <header className="game-header">
            <h1 className="game-brand">BLACK TEXT</h1>
            <span className="header-line" aria-hidden="true" />
          </header>

          <section className="record-panel">
            <h2
              id="record-title"
              className="record-title"
              ref={recordHeadingRef}
              tabIndex={-1}
            >
              {RECORD_COPY.heading}
            </h2>

            <dl className="record-list">
              <div className="record-row">
                <dt>{RECORD_COPY.selected_item_label}</dt>
                <dd>錆びた鈴</dd>
              </div>
              <div className="record-row">
                <dt>{RECORD_COPY.clues_label}</dt>
                <dd>
                  {displayedClues.length > 0 ? (
                    <ul className="record-clues">
                      {displayedClues.map((clue) => (
                        <li key={clue.clue_id}>{clue.displayed_text}</li>
                      ))}
                    </ul>
                  ) : (
                    "なし"
                  )}
                </dd>
              </div>
              <div className="record-row">
                <dt>{RECORD_COPY.response_count_label}</dt>
                <dd>{gameState.response_count}回</dd>
              </div>
              <div className="record-row">
                <dt>{RECORD_COPY.bell_uses_label}</dt>
                <dd>{gameState.bell_uses}回</dd>
              </div>
              <div className="record-row">
                <dt>{RECORD_COPY.last_choice_label}</dt>
                <dd>{lastChoiceText}</dd>
              </div>
            </dl>
          </section>

          <div className="record-actions">
            <button className="record-button" type="button" onClick={handleSave}>
              {RECORD_COPY.save_label}
            </button>
            <button className="record-button" type="button" onClick={beginPlay}>
              {RECORD_COPY.retry_label}
            </button>
            <button className="text-button" type="button" onClick={handleExit}>
              終了する
            </button>
          </div>

          {saveStatus ? (
            <p className="save-status" role="status">
              {saveStatus}
            </p>
          ) : null}
        </article>
      </main>
    );
  }

  return (
    <main className="game-shell">
      <article
        className={`game-frame ${isPlaying ? "" : "game-frame--result"}`}
        aria-labelledby="scene-title"
      >
        <header className="game-header">
          <h1 className="game-brand">BLACK TEXT</h1>
          <span className="header-line" aria-hidden="true" />
        </header>

        <section className="scene-panel">
          <h2
            id="scene-title"
            className="scene-title"
            ref={sceneHeadingRef}
            tabIndex={-1}
          >
            {scene.title}
          </h2>

          <div className="scene-copy" aria-live="polite" aria-atomic="true">
            {isPlaying && choiceResultText ? (
              <p className="choice-result">{choiceResultText}</p>
            ) : null}
            <p className="scene-text">{scene.text}</p>
          </div>
        </section>

        {isPlaying ? (
          <div className="actions" role="group" aria-label="行動を選ぶ">
            {scene.choices.map((choice, index) => (
              <button
                className="choice-button"
                key={choice.id}
                type="button"
                onClick={() => handleChoice(choice)}
              >
                <span className="choice-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{choice.text}</span>
              </button>
            ))}

            {scene.choices.length === 0 ? (
              <button
                className="continue-button"
                type="button"
                onClick={() => runGameAction({ type: "advance_scene" })}
              >
                <span>次へ</span>
                <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="result-actions">
            <button
              className="continue-button"
              type="button"
              onClick={() => setScreenMode("record")}
            >
              <span>記録を見る</span>
              <span aria-hidden="true">→</span>
            </button>
            <p className="result-mark" aria-hidden="true">
              END
            </p>
          </div>
        )}
      </article>
    </main>
  );
}
