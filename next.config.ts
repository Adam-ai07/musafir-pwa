import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGithubPages ? "/musafir-pwa" : "";

const nextConfig: NextConfig = {
  // Для бесплатного хостинга на GitHub Pages собираем статический экспорт в out/
  ...(isGithubPages
    ? {
        output: "export",
        basePath,
        assetPrefix: `${basePath}/`,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        // Разрешаем открывать dev-сервер не только с localhost (виртуальные адаптеры, телефон по Wi‑Fi).
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
      }),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
