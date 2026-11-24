import type { LucideIcon } from "lucide-react";

export default function SectionStub({
  title,
  ar,
  icon: Icon,
  text,
}: {
  title: string;
  ar: string;
  icon: LucideIcon;
  text: string;
}) {
  return (
    <main className="px-4 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <span className="font-arabic text-2xl text-emerald-400" dir="rtl">
          {ar}
        </span>
      </header>
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-emerald-800/50 bg-slate-900/40 px-6 py-16 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <Icon className="h-8 w-8" />
        </span>
        <p className="text-slate-300">{text}</p>
        <p className="mt-1 text-sm text-slate-500">Раздел в разработке</p>
      </div>
    </main>
  );
}
