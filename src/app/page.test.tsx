import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

function startGame(): void {
  fireEvent.click(screen.getByRole("button", { name: "はじめる" }));
}

function choose(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

function advance(): void {
  choose("次へ");
}

describe("Home", () => {
  it("タイトルから固定文章版の導入を開始し、本文へフォーカスを移す", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "BLACK TEXT" }),
    ).toBeInTheDocument();
    expect(screen.getByText("選択すること自体が、恐怖になる。"))
      .toBeInTheDocument();

    startGame();

    const sceneTitle = screen.getByRole("heading", {
      level: 2,
      name: "錆びた鈴",
    });
    expect(sceneTitle).toHaveFocus();
    expect(screen.getByText(/錆びた鈴を手に取った。/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次へ" })).toBeInTheDocument();
  });

  it("二度目の声までの返答履歴に合う選択結果文を表示する", () => {
    render(<Home />);
    startGame();
    advance();
    choose("黙って廊下へ出る");
    choose("自分の足元と扉の周囲を確かめる");
    choose("階段へ進む");

    expect(screen.getByText(/あなたの声に似ていた。/)).toBeInTheDocument();

    choose("声に返事をする");
    choose("声が使った言葉を覚える");

    expect(
      screen.getByText("二度目の声は、あなたの声をなぞっていた。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("二度目の声は、あなたの言葉をまねていた。"),
    ).not.toBeInTheDocument();
  });

  it("手掛かりを確認した安全な経路で生還結果を表示する", () => {
    render(<Home />);
    startGame();
    advance();
    choose("黙って廊下へ出る");
    choose("自分の足元と扉の周囲を確かめる");
    choose("階段へ進む");
    choose("何も言わず階段へ向かう");
    choose("声がした方向と間隔を覚える");
    choose("宿帳を詳しく調べる");
    choose("明かりの残る正面廊下を進む");
    choose("口を押さえて進む");
    advance();
    choose("「三度目には、返事をしない」という文面を読み返す");
    choose("扉を開ける");

    expect(
      screen.getByRole("heading", { level: 2, name: "生還" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/冷たい夜気が、肺に入る。/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("三度目の声へ返事をすると内部理由を出さずゲームオーバーを表示する", () => {
    const { container } = render(<Home />);
    startGame();
    advance();
    choose("黙って廊下へ出る");
    choose("声がした廊下の奥を見る");
    choose("階段へ進む");
    choose("何も言わず階段へ向かう");
    choose("声がした方向と間隔を覚える");
    choose("宿帳を閉じる");
    choose("明かりの残る正面廊下を進む");
    choose("「知っている」と返す");

    expect(
      screen.getByRole("heading", { level: 2, name: "記録終了" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/返事をしたのは、/)).toBeInTheDocument();
    expect(container).not.toHaveTextContent("fatal_response");
    expect(container).not.toHaveTextContent("entity_pressure");
    expect(container).not.toHaveTextContent("fatal_violation");
  });

  it("同じ描画中の二重選択では最初の選択だけを反映する", () => {
    render(<Home />);
    startGame();
    advance();

    const silence = screen.getByRole("button", { name: "黙って廊下へ出る" });
    const reply = screen.getByRole("button", {
      name: "「誰かいるのか」と声をかける",
    });

    act(() => {
      fireEvent.click(silence);
      fireEvent.click(reply);
    });

    choose("声がした廊下の奥を見る");
    choose("階段へ進む");

    expect(screen.getByText(/あなたの声に似ていた。/)).toBeInTheDocument();
    expect(
      screen.queryByText(/あなたが口にした声だった。/),
    ).not.toBeInTheDocument();
  });
});
