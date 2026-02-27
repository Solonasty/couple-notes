import { Note } from "../models/note.type";



export function buildWeeklySummaryPrompt(notes: Note[]): string {
  console.log(notes)
  const input = notes
    .map((n, i) => `${i + 1}) ${String(n?.text ?? "").trim()}`)
    .filter(line => line.length > 3)
    .join("\n");

  return input;
}