import fs from "node:fs";
import path from "node:path";

async function main() {
  console.log("Fetching quran-uthmani and ru.kuliev over HTTPS...");
  const [arRes, ruRes] = await Promise.all([
    fetch("https://api.alquran.cloud/v1/quran/quran-uthmani"),
    fetch("https://api.alquran.cloud/v1/quran/ru.kuliev"),
  ]);

  if (!arRes.ok || !ruRes.ok) {
    throw new Error(`HTTP error: ar=${arRes.status}, ru=${ruRes.status}`);
  }

  const arJson = await arRes.json();
  const ruJson = await ruRes.json();

  const arSurahs = arJson?.data?.surahs;
  const ruSurahs = ruJson?.data?.surahs;
  if (!Array.isArray(arSurahs) || arSurahs.length !== 114) {
    throw new Error("Invalid surahs count");
  }

  const dataDir = path.join(process.cwd(), "public", "data");
  const surahsDir = path.join(dataDir, "surahs");
  fs.mkdirSync(surahsDir, { recursive: true });

  const surahList = [];
  const allSurahs = [];

  for (let i = 0; i < 114; i++) {
    const ar = arSurahs[i];
    const ru = ruSurahs[i];
    const ruMap = new Map();
    for (const a of ru.ayahs) {
      ruMap.set(a.numberInSurah, a.text);
    }

    const ayahs = ar.ayahs.map((a) => ({
      number: a.number,
      numberInSurah: a.numberInSurah,
      arabic: a.text,
      translation: ruMap.get(a.numberInSurah) || "",
    }));

    surahList.push({
      number: ar.number,
      name: ar.name,
      englishName: ar.englishName,
      englishNameTranslation: ar.englishNameTranslation,
      numberOfAyahs: ar.ayahs.length,
      revelationType: ar.revelationType,
    });

    const fullSurah = {
      number: ar.number,
      name: ar.name,
      englishName: ar.englishName,
      englishNameTranslation: ar.englishNameTranslation,
      revelationType: ar.revelationType,
      numberOfAyahs: ar.ayahs.length,
      ayahs,
    };

    allSurahs.push(fullSurah);
    fs.writeFileSync(
      path.join(surahsDir, `${ar.number}.json`),
      JSON.stringify(fullSurah)
    );
  }

  fs.writeFileSync(path.join(dataDir, "surahs.json"), JSON.stringify(surahList));
  fs.writeFileSync(path.join(dataDir, "quran.json"), JSON.stringify(allSurahs));
  console.log("Saved public/data/surahs.json, public/data/quran.json, and 114 files in public/data/surahs/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
