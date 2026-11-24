'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeType = 'dark' | 'light';
export type FontSizeType = 'sm' | 'md' | 'lg';

export interface AppSettings {
    theme: ThemeType;
    reciter: string;
    fontSize: FontSizeType;
    showTranscription: boolean;
    showTranslation: boolean;
    vibration: boolean;
    city: string;
}

const DEFAULT_SETTINGS: AppSettings = {
    theme: 'dark',
    reciter: 'ar.alafasy',
    fontSize: 'md',
    showTranscription: true,
    showTranslation: true,
    vibration: true,
    city: 'Grozny',
};

interface SettingsContextType {
    settings: AppSettings;
    updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
    resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [isLoaded, setIsLoaded] = useState(false);

    // Загружаем сохранённые настройки при старте
    useEffect(() => {
        try {
            const saved = localStorage.getItem('noor_app_settings');
            if (saved) {
                setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
            }
        } catch (e) {
            console.error('Ошибка чтения настроек:', e);
        }
        setIsLoaded(true);
    }, []);

    // Сохраняем при каждом изменении и применяем тему к <html>
    useEffect(() => {
        if (!isLoaded) return;
        try {
            localStorage.setItem('noor_app_settings', JSON.stringify(settings));
            const root = document.documentElement;
            if (settings.theme === 'dark') {
                root.classList.add('dark');
                root.classList.remove('light');
                root.style.colorScheme = 'dark';
            } else {
                root.classList.remove('dark');
                root.classList.add('light');
                root.style.colorScheme = 'light';
            }
        } catch (e) {
            console.error('Ошибка сохранения настроек:', e);
        }
    }, [settings, isLoaded]);

    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
        localStorage.removeItem('noor_app_settings');
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings должен использоваться внутри SettingsProvider');
    }
    return context;
}