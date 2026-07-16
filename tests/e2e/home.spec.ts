import { readFile } from "node:fs/promises";

import {
  expect,
  test as base,
  type Page,
} from "@playwright/test";

const test = base.extend<{ pageErrorGuard: void }>({
  pageErrorGuard: [
    async ({ page }, use) => {
      const errors: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(`console: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        errors.push(`pageerror: ${error.message}`);
      });

      await use();

      expect(errors, "ブラウザに未処理エラーがないこと").toEqual([]);
    },
    { auto: true },
  ],
});

type FirstCallChoice = "reply" | "silence";
type SecondCallChoice = "reply" | "bell" | "silence";
type ThirdCallChoice = "bell" | "silence";

interface RouteOptions {
  readonly firstCall?: FirstCallChoice;
  readonly secondCall?: SecondCallChoice;
  readonly inspectBook?: boolean;
  readonly thirdCall?: ThirdCallChoice;
}

interface SavedPlaytestRecord {
  readonly schema_version: string;
  readonly game_version: string;
  readonly session_id: string;
  readonly total_play_time_ms: number;
  readonly choice_history: readonly {
    readonly order: number;
    readonly decision_time_ms: number;
  }[];
  readonly outcome: string;
}

const FIRST_CALL_LABEL = {
  reply: "「誰かいるのか」と声をかける",
  silence: "黙って廊下へ出る",
} as const satisfies Readonly<Record<FirstCallChoice, string>>;

const SECOND_CALL_LABEL = {
  reply: "声に返事をする",
  bell: "鈴を鳴らす",
  silence: "何も言わず階段へ向かう",
} as const satisfies Readonly<Record<SecondCallChoice, string>>;

const THIRD_CALL_LABEL = {
  bell: "鈴を鳴らす",
  silence: "口を押さえて進む",
} as const satisfies Readonly<Record<ThirdCallChoice, string>>;

async function choose(page: Page, name: string): Promise<void> {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeVisible();
  await button.click();
}

async function startGame(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "BLACK TEXT" }),
  ).toBeVisible();
  await choose(page, "はじめる");
  await choose(page, "次へ");
}

async function playToThirdCall(
  page: Page,
  options: RouteOptions = {},
): Promise<void> {
  const {
    firstCall = "silence",
    secondCall = "silence",
    inspectBook = true,
  } = options;

  await startGame(page);
  await choose(page, FIRST_CALL_LABEL[firstCall]);
  await choose(page, "自分の足元と扉の周囲を確かめる");
  await choose(page, "階段へ進む");
  await choose(page, SECOND_CALL_LABEL[secondCall]);
  await choose(page, "声がした方向と間隔を覚える");
  await choose(page, inspectBook ? "宿帳を詳しく調べる" : "宿帳を閉じる");
  await choose(page, "明かりの残る正面廊下を進む");
}

async function playToEntrance(
  page: Page,
  options: RouteOptions = {},
): Promise<void> {
  const { thirdCall = "silence" } = options;

  await playToThirdCall(page, options);
  await choose(page, THIRD_CALL_LABEL[thirdCall]);
  await choose(page, "次へ");
  await choose(page, "「三度目には、返事をしない」という文面を読み返す");
}

async function expectClear(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 2, name: "生還" }),
  ).toBeVisible();
  await expect(page.getByText(/冷たい夜気が、肺に入る。/)).toBeVisible();
}

async function expectGameOver(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 2, name: "記録終了" }),
  ).toBeVisible();
}

test("@preview-smoke CLUE-Bを取得した低圧経路で直接脱出し、JSON保存後に再挑戦できる", async ({
  page,
}) => {
  await playToEntrance(page);
  await choose(page, "扉を開ける");
  await expectClear(page);

  await choose(page, "記録を見る");

  const downloadPromise = page.waitForEvent("download");
  await choose(page, "プレイテスト記録を保存");
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(downloadPath).not.toBeNull();
  if (!downloadPath) {
    throw new Error("保存したJSONファイルのパスを取得できませんでした。");
  }

  const jsonText = await readFile(downloadPath, "utf8");
  const record = JSON.parse(jsonText) as SavedPlaytestRecord;

  expect(download.suggestedFilename()).toBe(
    `black-text-playtest-${record.session_id}.json`,
  );
  expect(record.schema_version).toBe("1.0.0");
  expect(record.game_version).toBe("scenario-001-rules-v1");
  expect(record.outcome).toBe("clear");
  expect(record.total_play_time_ms).toBeGreaterThanOrEqual(0);
  expect(record.choice_history).toHaveLength(10);
  expect(
    record.choice_history.every(
      (choice, index) =>
        choice.order === index + 1 && choice.decision_time_ms >= 0,
    ),
  ).toBe(true);
  expect(record).not.toHaveProperty("entity_pressure");
  expect(record).not.toHaveProperty("fatal_violation");
  expect(record).not.toHaveProperty("game_over_reason");
  await expect(page.getByRole("status")).toHaveText("記録を保存しました。");

  await choose(page, "もう一度試す");

  await expect(
    page.getByRole("heading", { level: 2, name: "錆びた鈴" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "次へ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "RECORD" })).toHaveCount(0);
});

test("鈴を二回以内で使い、背後を見ずに脱出する", async ({ page }) => {
  await playToEntrance(page, {
    secondCall: "bell",
    inspectBook: false,
  });
  await choose(page, "鈴を鳴らす");
  await choose(page, "扉を開ける");

  await expectClear(page);
});

test("@preview-smoke 三度目の呼びかけに返事をするとゲームオーバーになる", async ({
  page,
}) => {
  await playToThirdCall(page, { inspectBook: false });
  await choose(page, "「知っている」と返す");

  await expectGameOver(page);
  await expect(page.getByText(/返事をしたのは、/)).toBeVisible();
});

test("CLUE-B未取得で直接脱出するとゲームオーバーになる", async ({
  page,
}) => {
  await playToEntrance(page, { inspectBook: false });
  await choose(page, "扉を開ける");

  await expectGameOver(page);
  await expect(page.getByText(/記録は、ここで途切れている。/)).toBeVisible();
});

test("安全策を使い切り、怪異圧力3以上で直接脱出に失敗する", async ({
  page,
}) => {
  await playToEntrance(page, {
    firstCall: "reply",
    secondCall: "bell",
    thirdCall: "bell",
  });
  await choose(page, "扉を開ける");

  await expectGameOver(page);
});

test("安全策を使い切り、三回目の鈴を鳴らすとゲームオーバーになる", async ({
  page,
}) => {
  await playToEntrance(page, {
    secondCall: "bell",
    inspectBook: false,
    thirdCall: "bell",
  });
  await choose(page, "鈴を鳴らす");

  await expectGameOver(page);
  await expect(page.getByText("そこにいた。")).toBeVisible();
});

test("安全策を使い切り、最終局面で振り返るとゲームオーバーになる", async ({
  page,
}) => {
  await playToEntrance(page, {
    secondCall: "bell",
    inspectBook: false,
    thirdCall: "bell",
  });
  await choose(page, "後ろを振り返る");

  await expectGameOver(page);
});
