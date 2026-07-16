import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlaytestRecord } from "./playtest-record";
import { downloadPlaytestRecord } from "./download-playtest-record";

const SAMPLE_RECORD: PlaytestRecord = {
  schema_version: "1.0.0",
  game_version: "scenario-001-rules-v1",
  session_id: "download-session",
  scenario_id: "SCENARIO-001",
  selected_item: "rusty_bell",
  started_at: "2026-07-16T00:00:00.000Z",
  ended_at: "2026-07-16T00:01:00.000Z",
  total_play_time_ms: 60_000,
  choice_history: [],
  clues: [],
  response_count: 0,
  bell_uses: 0,
  outcome: "clear",
  last_choice_id: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("downloadPlaytestRecord", () => {
  it("JSONをローカルファイルとして保存し、オブジェクトURLを解放する", () => {
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:playtest-record");
    const revokeObjectUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadPlaytestRecord(SAMPLE_RECORD);

    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.instances[0]).toMatchObject({
      href: "blob:playtest-record",
      download: "black-text-playtest-download-session.json",
    });
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:playtest-record");
    expect(document.querySelector("a[download]")).not.toBeInTheDocument();
  });
});
