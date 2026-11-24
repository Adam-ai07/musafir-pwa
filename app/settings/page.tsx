'use client';

import React, { useEffect, useState } from 'react';
import OfflineManager from '../../components/OfflineManager';
import { useSettings, FontSizeType } from '../../src/context/SettingsContext';
import {
    Moon,
    Sun,
    Volume2,
    Type,
    Smartphone,
    MapPin,
    Share2,
    RotateCcw,
    Check,
    Download,
    Share,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const RECITERS = [
    { id: 'ar.alafasy', name: 'Мишари Рашид аль-Афаси' },
    { id: 'ar.mahermuaiqly', name: 'Махер аль-Муайкли' },
    { id: 'ar.abdurrahmaansudais', name: 'Абдуррахман ас-Судайс' },
    { id: 'ar.husary', name: 'Махмуд Халиль аль-Хусари' },
    { id: 'ar.abdulbasitmurattal', name: 'Абдуль-Басит Абдус-Самад' },
];

const CITIES = [
    { id: 'Grozny', label: 'Грозный' },
    { id: 'Nazran', label: 'Назрань' },
    { id: 'Makhachkala', label: 'Махачкала' },
    { id: 'Moscow', label: 'Москва' },
    { id: 'Kazan', label: 'Казань' },
];

export default function SettingsPage() {
    const { settings, updateSetting, resetSettings } = useSettings();
    const [copied, setCopied] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [showIosGuide, setShowIosGuide] = useState(false);
    const [showAndroidFallback, setShowAndroidFallback] = useState(false);

    const isDark = settings.theme === 'dark';

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        setIsInstalled(standalone);

        const ua = window.navigator.userAgent;
        const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
        if (isIos && !standalone) {
            setShowIosGuide(true);
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowAndroidFallback(false);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            setShowAndroidFallback(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleAndroidInstall = async () => {
        if (!deferredPrompt) {
            setShowAndroidFallback((prev) => !prev);
            return;
        }
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
        }
        setDeferredPrompt(null);
    };

    const handleShare = async () => {
        const shareData = {
            title: 'مُسَافِر — Путник в этом мире',
            text: 'مُسَافِر (Путник в этом мире) — Коран, Азкары и Хадисы.',
            url: typeof window !== 'undefined' ? window.location.origin : '',
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (err) {
            console.log('Отмена отправки', err);
        }
    };

    const cardClass = isDark
        ? 'bg-slate-900/90 border-slate-800 text-slate-100'
        : 'bg-white border-stone-200 text-stone-900 shadow-sm';

    return (
        <div
            className={`min-h-screen pb-28 px-4 pt-6 transition-colors ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-stone-100 text-stone-900'
                }`}
        >
            <div className="max-w-lg mx-auto space-y-5">
                <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>

                {/* 1. Тема оформления */}
                <div className={`p-4 rounded-2xl border ${cardClass}`}>
                    <div className="flex items-center gap-2.5 mb-3 font-medium">
                        {isDark ? (
                            <Moon className="w-5 h-5 text-emerald-400" />
                        ) : (
                            <Sun className="w-5 h-5 text-emerald-600" />
                        )}
                        <span>Тема оформления</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => updateSetting('theme', 'dark')}
                            className={`py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition ${isDark
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-stone-100 text-stone-700 border-stone-200'
                                }`}
                        >
                            <Moon className="w-4 h-4" /> Тёмная
                        </button>
                        <button
                            onClick={() => updateSetting('theme', 'light')}
                            className={`py-2.5 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition ${!isDark
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                        >
                            <Sun className="w-4 h-4" /> Светлая
                        </button>
                    </div>
                </div>

                {/* 2. Выбор чтеца Корана */}
                <div className={`p-4 rounded-2xl border ${cardClass}`}>
                    <div className="flex items-center gap-2.5 mb-3 font-medium">
                        <Volume2 className="w-5 h-5 text-emerald-500" />
                        <span>Чтец Корана</span>
                    </div>
                    <select
                        value={settings.reciter}
                        onChange={(e) => updateSetting('reciter', e.target.value)}
                        className={`w-full p-3 rounded-xl border text-sm outline-none ${isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-100'
                                : 'bg-stone-50 border-stone-300 text-stone-900'
                            }`}
                    >
                        {RECITERS.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 3. Размер шрифта и отображение текста */}
                <div className={`p-4 rounded-2xl border space-y-4 ${cardClass}`}>
                    <div>
                        <div className="flex items-center gap-2.5 mb-3 font-medium">
                            <Type className="w-5 h-5 text-emerald-500" />
                            <span>Размер шрифта</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {(
                                [
                                    { id: 'sm', label: 'Мелкий' },
                                    { id: 'md', label: 'Средний' },
                                    { id: 'lg', label: 'Крупный' },
                                ] as { id: FontSizeType; label: string }[]
                            ).map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => updateSetting('fontSize', item.id)}
                                    className={`py-2 rounded-xl text-sm font-medium border transition ${settings.fontSize === item.id
                                            ? 'bg-emerald-600 text-white border-emerald-500'
                                            : isDark
                                                ? 'bg-slate-800 border-slate-700 text-slate-300'
                                                : 'bg-stone-100 border-stone-200 text-stone-700'
                                        }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/40 space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm">Показывать транскрипцию</span>
                            <input
                                type="checkbox"
                                checked={settings.showTranscription}
                                onChange={(e) => updateSetting('showTranscription', e.target.checked)}
                                className="w-5 h-5 accent-emerald-500 rounded"
                            />
                        </label>

                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm">Показывать перевод</span>
                            <input
                                type="checkbox"
                                checked={settings.showTranslation}
                                onChange={(e) => updateSetting('showTranslation', e.target.checked)}
                                className="w-5 h-5 accent-emerald-500 rounded"
                            />
                        </label>
                    </div>
                </div>

                {/* 4. Вибрация в тасбихе и Город */}
                <div className={`p-4 rounded-2xl border space-y-4 ${cardClass}`}>
                    <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2.5">
                            <Smartphone className="w-5 h-5 text-emerald-500" />
                            <span className="text-sm font-medium">Вибрация при счёте зикров</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.vibration}
                            onChange={(e) => updateSetting('vibration', e.target.checked)}
                            className="w-5 h-5 accent-emerald-500 rounded"
                        />
                    </label>

                    <div className="pt-3 border-t border-slate-800/40">
                        <div className="flex items-center gap-2.5 mb-2 text-sm font-medium">
                            <MapPin className="w-5 h-5 text-emerald-500" />
                            <span>Город для времени намаза</span>
                        </div>
                        <select
                            value={settings.city}
                            onChange={(e) => updateSetting('city', e.target.value)}
                            className={`w-full p-2.5 rounded-xl border text-sm outline-none ${isDark
                                    ? 'bg-slate-800 border-slate-700 text-slate-100'
                                    : 'bg-stone-50 border-stone-300 text-stone-900'
                                }`}
                        >
                            {CITIES.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 5. Менеджер оффлайн-контента */}
                <OfflineManager />

                {/* 6. Установка приложения */}
                <div className={`p-4 rounded-2xl border space-y-3 ${cardClass}`}>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 font-medium">
                            <Download className="w-5 h-5 text-emerald-500" />
                            <span>Установка приложения</span>
                        </div>
                        {isInstalled && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-500">
                                <Check className="w-3.5 h-3.5" />
                                Установлено
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                            type="button"
                            onClick={handleAndroidInstall}
                            className={`w-full py-2.5 px-3.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition active:scale-[0.98] ${
                                deferredPrompt
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                                    : isDark
                                    ? 'bg-slate-800 hover:bg-slate-700/80 text-slate-100 border-slate-700'
                                    : 'bg-stone-100 hover:bg-stone-200/80 text-stone-800 border-stone-200'
                            }`}
                        >
                            <Download className="w-4 h-4 shrink-0" />
                            <span>Установить на Android</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowIosGuide((prev) => !prev)}
                            className={`w-full py-2.5 px-3.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition active:scale-[0.98] ${
                                showIosGuide
                                    ? 'bg-emerald-600/15 text-emerald-500 border-emerald-500/50'
                                    : isDark
                                    ? 'bg-slate-800 hover:bg-slate-700/80 text-slate-100 border-slate-700'
                                    : 'bg-stone-100 hover:bg-stone-200/80 text-stone-800 border-stone-200'
                            }`}
                        >
                            <Share className="w-4 h-4 shrink-0" />
                            <span>Установить на iOS</span>
                        </button>
                    </div>

                    {showAndroidFallback && !deferredPrompt && !isInstalled && (
                        <div
                            className={`rounded-xl border p-3 text-xs leading-relaxed ${
                                isDark
                                    ? 'border-slate-800 bg-slate-950/70 text-slate-300'
                                    : 'border-stone-200 bg-stone-50 text-stone-600'
                            }`}
                        >
                            Откройте меню браузера (⋮) и выберите «Установить приложение» или «Добавить на главный экран».
                        </div>
                    )}

                    {showIosGuide && (
                        <div
                            className={`rounded-xl border p-3.5 text-sm leading-relaxed flex items-start gap-2.5 animate-[fadeIn_0.2s_ease-out] ${
                                isDark
                                    ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
                                    : 'border-emerald-500/30 bg-emerald-50 text-emerald-900'
                            }`}
                        >
                            <Share className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                            <p>
                                Нажмите кнопку «Поделиться» в браузере и выберите «На экран Домой».
                            </p>
                        </div>
                    )}
                </div>

                {/* 6. Поделиться и Сброс */}
                <div className="space-y-2.5 pt-1">
                    <button
                        onClick={handleShare}
                        className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 transition"
                    >
                        {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                        <span>{copied ? 'Ссылка скопирована!' : 'Поделиться приложением'}</span>
                    </button>

                    <button
                        onClick={resetSettings}
                        className={`w-full py-3 px-4 rounded-2xl border text-sm font-medium flex items-center justify-center gap-2 transition ${isDark
                                ? 'border-slate-800 text-slate-400 hover:text-slate-200'
                                : 'border-stone-300 text-stone-600 hover:text-stone-900'
                            }`}
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>Сбросить настройки по умолчанию</span>
                    </button>
                </div>
            </div>
        </div>
    );
}