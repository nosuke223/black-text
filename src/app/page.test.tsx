import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

function completeSafeRoute(): void {
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
    completeSafeRoute();

    expect(
      screen.getByRole("heading", { level: 2, name: "生還" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/冷たい夜気が、肺に入る。/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "記録を見る" }),
    ).toBeInTheDocument();
  });

  it("結果後の記録に手掛かりと行動回数と最後の選択を表示する", () => {
    const { container } = render(<Home />);
    startGame();
    completeSafeRoute();

    choose("記録を見る");

    const recordHeading = screen.getByRole("heading", {
      level: 2,
      name: "RECORD",
    });
    expect(recordHeading).toHaveFocus();
    expect(screen.getByText("選択した物").parentElement).toHaveTextContent(
      "錆びた鈴",
    );
    expect(screen.getByText("声に返事をした回数").parentElement)
      .toHaveTextContent("0回");
    expect(screen.getByText("鈴を鳴らした回数").parentElement)
      .toHaveTextContent("0回");
    expect(screen.getByText("最後の選択").parentElement).toHaveTextContent(
      "扉を開ける",
    );
    expect(screen.getByText("三度目には、返事をしないこと"))
      .toBeInTheDocument();
    expect(container).not.toHaveTextContent("CLUE-B");
    expect(container).not.toHaveTextContent("entity_pressure");
    expect(container).not.toHaveTextContent("fatal_violation");
  });

  it("保存できない場合も通知を表示し、再挑戦で初期画面へ戻る", () => {
    vi.spyOn(URL, "createObjectURL").mockImplementationOnce(() => {
      throw new Error("保存失敗");
    });
    render(<Home />);
    startGame();
    completeSafeRoute();
    choose("記録を見る");

    choose("プレイテスト記録を保存");

    expect(screen.getByRole("status")).toHaveTextContent(
      "記録を保存できませんでした。再挑戦は続けられます。",
    );

    choose("もう一度試す");

    expect(
      screen.getByRole("heading", { level: 2, name: "錆びた鈴" }),
    ).toHaveFocus();
    expect(screen.getByRole("button", { name: "次へ" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "RECORD" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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
