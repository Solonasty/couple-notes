import { Note } from "../models/note.type";

export function buildWeeklySummaryPrompt(notes: Note[]): string {
  return notes
    .map((n, i) => {
      const name = String(n?.ownerName ?? "").trim() || "Неизвестно";
      const text = String(n?.text ?? "").trim();
      return `${i + 1}) [${name}] ${text}`;
    })
    .filter(line => line.length > 10)
    .join("\n");
}