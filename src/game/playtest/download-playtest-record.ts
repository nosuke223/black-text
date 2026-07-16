import {
  getPlaytestRecordFilename,
  serializePlaytestRecord,
  type PlaytestRecord,
} from "./playtest-record";

export function downloadPlaytestRecord(record: PlaytestRecord): void {
  const blob = new Blob([serializePlaytestRecord(record)], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    link.href = objectUrl;
    link.download = getPlaytestRecordFilename(record);
    link.hidden = true;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }
}
