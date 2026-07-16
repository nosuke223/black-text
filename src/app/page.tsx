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
import type { FixedChoice } from "@/game/scenarios/scenario-001/scenario";

export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);
  const [gameState, setGameState] = useState(createInitialGameState);
  const [choiceResultText, setChoiceResultText] = useState<string | null>(null);
  const interactionLockedRef = useRef(false);
  const sceneHeadingRef = useRef<HTMLHeadingElement>(null);

  const scene = getCurrentScene(gameState);
  const isPlaying = gameState.outcome === "playing";

  useEffect(() => {
    if (!hasStarted) {
      return;
    }

    interactionLockedRef.current = false;
    sceneHeadingRef.current?.focus();
  }, [gameState, hasStarted]);

  function runGameAction(action: GameAction): void {
    if (interactionLockedRef.current) {
      return;
    }

    interactionLockedRef.current = true;

    try {
      const result = applyGameAction(gameState, action);
      setGameState(result.state);
      setChoiceResultText(result.choice_result_text);
    } catch (error) {
      interactionLockedRef.current = false;
      throw error;
    }
  }

  function handleStart(): void {
    setGameState(createInitialGameState());
    setChoiceResultText(null);
    setHasStarted(true);
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

  if (!hasStarted) {
    return (
      <main className="game-shell">
        <section className="title-screen" aria-labelledby="page-title">
          <p className="title-kicker">選択式テキストホラー</p>
          <h1 id="page-title" className="title-logo">
            BLACK TEXT
          </h1>
          <p className="concept-line">選択すること自体が、恐怖になる。</p>
          <button className="start-button" type="button" onClick={handleStart}>
            <span>はじめる</span>
            <span aria-hidden="true">→</span>
          </button>
        </section>
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
          <p className="result-mark" aria-hidden="true">
            END
          </p>
        )}
      </article>
    </main>
  );
}
