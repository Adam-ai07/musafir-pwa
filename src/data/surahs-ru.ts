export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: "Meccan" | "Medinan" | string;
}

export interface LastReadSurah {
  number: number;
  ruName: string;
  arabicName?: string;
  englishName?: string;
  ayah?: number;
}

export const LAST_READ_SURAH_KEY = "lastReadSurah";

/** Русские названия и смысловой перевод названий всех 114 сур Корана */
export const SURAH_RU: Record<number, { name: string; meaning: string }> = {
  1: { name: "Аль-Фатиха", meaning: "Открывающая Коран" },
  2: { name: "Аль-Бакара", meaning: "Корова" },
  3: { name: "Аль Имран", meaning: "Семейство Имрана" },
  4: { name: "Ан-Ниса", meaning: "Женщины" },
  5: { name: "Аль-Маида", meaning: "Трапеза" },
  6: { name: "Аль-Анам", meaning: "Скот" },
  7: { name: "Аль-Араф", meaning: "Ограды" },
  8: { name: "Аль-Анфаль", meaning: "Трофеи" },
  9: { name: "Ат-Тауба", meaning: "Покаяние" },
  10: { name: "Юнус", meaning: "Иона" },
  11: { name: "Худ", meaning: "Худ" },
  12: { name: "Юсуф", meaning: "Иосиф" },
  13: { name: "Ар-Раад", meaning: "Гром" },
  14: { name: "Ибрахим", meaning: "Авраам" },
  15: { name: "Аль-Хиджр", meaning: "Хиджр" },
  16: { name: "Ан-Нахль", meaning: "Пчёлы" },
  17: { name: "Аль-Исра", meaning: "Ночной перенос" },
  18: { name: "Аль-Кахф", meaning: "Пещера" },
  19: { name: "Марьям", meaning: "Мария" },
  20: { name: "Та Ха", meaning: "Та Ха" },
  21: { name: "Аль-Анбия", meaning: "Пророки" },
  22: { name: "Аль-Хадж", meaning: "Паломничество" },
  23: { name: "Аль-Муминун", meaning: "Верующие" },
  24: { name: "Ан-Нур", meaning: "Свет" },
  25: { name: "Аль-Фуркан", meaning: "Различение" },
  26: { name: "Аш-Шуара", meaning: "Поэты" },
  27: { name: "Ан-Намль", meaning: "Муравьи" },
  28: { name: "Аль-Касас", meaning: "Рассказ" },
  29: { name: "Аль-Анкабут", meaning: "Паук" },
  30: { name: "Ар-Рум", meaning: "Римляне" },
  31: { name: "Лукман", meaning: "Лукман" },
  32: { name: "Ас-Саджда", meaning: "Земной поклон" },
  33: { name: "Аль-Ахзаб", meaning: "Союзники" },
  34: { name: "Саба", meaning: "Сава" },
  35: { name: "Фатыр", meaning: "Творец" },
  36: { name: "Ясин", meaning: "Йа Син" },
  37: { name: "Ас-Саффат", meaning: "Выстроившиеся в ряды" },
  38: { name: "Сад", meaning: "Сад" },
  39: { name: "Аз-Зумар", meaning: "Толпы" },
  40: { name: "Гафир", meaning: "Прощающий" },
  41: { name: "Фуссылят", meaning: "Разъяснены" },
  42: { name: "Аш-Шура", meaning: "Совет" },
  43: { name: "Аз-Зухруф", meaning: "Украшения" },
  44: { name: "Ад-Духан", meaning: "Дым" },
  45: { name: "Аль-Джасия", meaning: "Коленопреклонённые" },
  46: { name: "Аль-Ахкаф", meaning: "Барханы" },
  47: { name: "Мухаммад", meaning: "Мухаммад" },
  48: { name: "Аль-Фатх", meaning: "Победа" },
  49: { name: "Аль-Худжурат", meaning: "Комнаты" },
  50: { name: "Каф", meaning: "Каф" },
  51: { name: "Аз-Зарият", meaning: "Рассеивающие прах" },
  52: { name: "Ат-Тур", meaning: "Гора" },
  53: { name: "Ан-Наджм", meaning: "Звезда" },
  54: { name: "Аль-Камар", meaning: "Луна" },
  55: { name: "Ар-Рахман", meaning: "Милостивый" },
  56: { name: "Аль-Вакиа", meaning: "Событие" },
  57: { name: "Аль-Хадид", meaning: "Железо" },
  58: { name: "Аль-Муджадиля", meaning: "Препирающаяся" },
  59: { name: "Аль-Хашр", meaning: "Сбор" },
  60: { name: "Аль-Мумтахана", meaning: "Испытуемая" },
  61: { name: "Ас-Сафф", meaning: "Ряды" },
  62: { name: "Аль-Джумуа", meaning: "Собрание" },
  63: { name: "Аль-Мунафикун", meaning: "Лицемеры" },
  64: { name: "Ат-Тагабун", meaning: "Взаимное обделение" },
  65: { name: "Ат-Таляк", meaning: "Развод" },
  66: { name: "Ат-Тахрим", meaning: "Запрещение" },
  67: { name: "Аль-Мульк", meaning: "Власть" },
  68: { name: "Аль-Калям", meaning: "Письменная трость" },
  69: { name: "Аль-Хакка", meaning: "Неминуемое" },
  70: { name: "Аль-Мааридж", meaning: "Ступени" },
  71: { name: "Нух", meaning: "Ной" },
  72: { name: "Аль-Джинн", meaning: "Джинны" },
  73: { name: "Аль-Муззаммиль", meaning: "Закутавшийся" },
  74: { name: "Аль-Муддассир", meaning: "Завернувшийся" },
  75: { name: "Аль-Кияма", meaning: "Воскресение" },
  76: { name: "Аль-Инсан", meaning: "Человек" },
  77: { name: "Аль-Мурсалят", meaning: "Посылаемые" },
  78: { name: "Ан-Наба", meaning: "Весть" },
  79: { name: "Ан-Назиат", meaning: "Исторгающие" },
  80: { name: "Абаса", meaning: "Нахмурился" },
  81: { name: "Ат-Таквир", meaning: "Скручивание" },
  82: { name: "Аль-Инфитар", meaning: "Раскалывание" },
  83: { name: "Аль-Мутаффифин", meaning: "Обвешивающие" },
  84: { name: "Аль-Иншикак", meaning: "Разверзнется" },
  85: { name: "Аль-Бурудж", meaning: "Созвездия Зодиака" },
  86: { name: "Ат-Тарик", meaning: "Ночной путник" },
  87: { name: "Аль-Аля", meaning: "Всевышний" },
  88: { name: "Аль-Гашия", meaning: "Покрывающее" },
  89: { name: "Аль-Фаджр", meaning: "Заря" },
  90: { name: "Аль-Баляд", meaning: "Город" },
  91: { name: "Аш-Шамс", meaning: "Солнце" },
  92: { name: "Аль-Ляйль", meaning: "Ночь" },
  93: { name: "Ад-Духа", meaning: "Утро" },
  94: { name: "Аш-Шарх", meaning: "Раскрытие" },
  95: { name: "Ат-Тин", meaning: "Смоковница" },
  96: { name: "Аль-Аляк", meaning: "Сгусток крови" },
  97: { name: "Аль-Кадр", meaning: "Предопределение" },
  98: { name: "Аль-Баййина", meaning: "Ясное знамение" },
  99: { name: "Аз-Зальзаля", meaning: "Сотрясение" },
  100: { name: "Аль-Адият", meaning: "Скачущие" },
  101: { name: "Аль-Кариа", meaning: "Великое бедствие" },
  102: { name: "Ат-Такасур", meaning: "Страсть к приумножению" },
  103: { name: "Аль-Аср", meaning: "Предвечернее время" },
  104: { name: "Аль-Хумаза", meaning: "Хулитель" },
  105: { name: "Аль-Филь", meaning: "Слон" },
  106: { name: "Курайш", meaning: "Курайшиты" },
  107: { name: "Аль-Маун", meaning: "Мелочь" },
  108: { name: "Аль-Каусар", meaning: "Изобилие" },
  109: { name: "Аль-Кафирун", meaning: "Неверующие" },
  110: { name: "Ан-Наср", meaning: "Помощь" },
  111: { name: "Аль-Масад", meaning: "Пальмовые волокна" },
  112: { name: "Аль-Ихлас", meaning: "Искренность" },
  113: { name: "Аль-Фаляк", meaning: "Рассвет" },
  114: { name: "Ан-Нас", meaning: "Люди" },
};

export function getSurahRuName(number: number, fallbackEnglish?: string): string {
  return SURAH_RU[number]?.name ?? fallbackEnglish ?? `Сура ${number}`;
}

export function getSurahRuMeaning(number: number, fallbackTranslation?: string): string {
  return SURAH_RU[number]?.meaning ?? fallbackTranslation ?? "";
}

export function formatAyahCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} аят`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} аята`;
  return `${count} аятов`;
}

export function formatRevelationType(type: string): string {
  return type === "Medinan" ? "Мединская" : "Мекканская";
}
