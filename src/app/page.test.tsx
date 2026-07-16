import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("BLACK TEXTの段階A画面を表示する", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "BLACK TEXT" }),
    ).toBeInTheDocument();
    expect(screen.getByText("固定文章版 MVP / STAGE A")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "プロジェクト基盤を準備しました",
    );
  });
});
