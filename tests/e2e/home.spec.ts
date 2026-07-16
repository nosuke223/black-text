import { expect, test } from "@playwright/test";

test("BLACK TEXTの初期画面を表示する", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "BLACK TEXT" }),
  ).toBeVisible();
  await expect(page.getByText("選択すること自体が、恐怖になる。")).toBeVisible();
});
