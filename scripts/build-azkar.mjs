// Скачивает открытую базу «Крепости мусульманина» (AvocadoApps/azkar-ios) с арабским
// текстом, транскрипцией и русским переводом и формирует src/data/azkar.json.
// Запуск: node scripts/build-azkar.mjs (требуется Node.js с built-in node:sqlite)

import { DatabaseSync } from "node:sqlite";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DB_URL =
  "https://raw.githubusercontent.com/AvocadoApps/azkar-ios/master/Azkar/Resources/azkar.db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../src/data/azkar.json");

const CATEGORY_MAP = [
  { target: "morning", dbCategory: "morning", source: "hisn" },
  { target: "evening", dbCategory: "evening", source: "hisn" },
  { target: "after_prayer", dbCategory: "after-salah", source: null },
  { target: "dua", dbCategory: "other", source: null },
];

function cleanText(value) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function makeFallbackTitle(translation, fallbackLabel) {
  const firstLine = cleanText(translation).split("\n")[0] ?? "";
  if (!firstLine) return fallbackLabel;
  if (firstLine.length <= 48) return firstLine;
  const cut = firstLine.slice(0, 48);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[.,:;!?—-]+$/, "")}…`;
}

async function main() {
  const tempDb = join(tmpdir(), `hisn-azkar-${Date.now()}.db`);

  try {
    console.log(`Downloading ${DB_URL}...`);
    const res = await fetch(DB_URL);
    if (!res.ok) {
      throw new Error(`Failed to download azkar.db: HTTP ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(tempDb, buffer);

    const db = new DatabaseSync(tempDb, { readOnly: true });

    const getGroup = db.prepare(
      "SELECT azkar_ids FROM azkar_groups WHERE category = ? AND (? IS NULL OR source = ?) LIMIT 1"
    );
    const getZikr = db.prepare(`
      SELECT
        a.id,
        a.repeats,
        a.source,
        a.text AS arabic,
        r.title AS ru_title,
        r.text AS translation,
        r.transliteration AS transcription
      FROM azkar a
      JOIN azkar_ru r ON r.id = a.id
      WHERE a.id = ?
    `);

    const result = [];

    for (const { target, dbCategory, source } of CATEGORY_MAP) {
      const group = getGroup.get(dbCategory, source, source);
      if (!group?.azkar_ids) {
        throw new Error(`Group not found in azkar_groups: ${dbCategory}`);
      }

      const ids = String(group.azkar_ids)
        .split(",")
        .map((s) => Number(s.trim()))
        .filter(Boolean);

      for (const numId of ids) {
        const row = getZikr.get(numId);
        if (!row) continue;

        const translation = cleanText(row.translation);
        const arabic = cleanText(row.arabic);
        const transcription = cleanText(row.transcription);
        const title = cleanText(row.ru_title) || makeFallbackTitle(translation, `Зикр #${numId}`);
        const count = Math.max(1, Number(row.repeats) || 1);

        result.push({
          id: `${target}-${row.id}`,
          category: target,
          title,
          arabic,
          transcription,
          translation,
          count,
        });
      }
    }

    db.close();

    if (result.length === 0) {
      throw new Error("Parsed 0 items, aborting overwrite of src/data/azkar.json");
    }

    writeFileSync(OUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");

    const counts = result.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`Saved ${result.length} items to ${OUT_PATH}:`, counts);
  } finally {
    rmSync(tempDb, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
