import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Разрешаем открывать dev-сервер не только с localhost (виртуальные адаптеры, телефон по Wi‑Fi).
  // Без этого Next 16 блокирует /_next/* dev-ресурсы → страница не гидратируется и клики не работают.
  allowedDevOrigins: [
    "172.19.0.1",
    "172.*.*.*",
    "192.168.*.*",
    "10.*.*.*",
    "*.serveousercontent.com",
    "*.trycloudflare.com",
    "*.lhr.life",
    "*.loca.lt",
  ],
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
