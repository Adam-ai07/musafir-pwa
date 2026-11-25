"use client";

import React, { useEffect, useRef, useState } from "react";

type ScrollDirection = "up" | "down";

/** Единый пассивный слушатель направления скролла для всех блоков перевода на странице */
const scrollListeners = new Set<(dir: ScrollDirection, scrollY: number) => void>();
let lastScrollY = 0;
let currentDirection: ScrollDirection = "up";
let scrollBound = false;

function onWindowScroll() {
  const y = window.scrollY;
  const delta = y - lastScrollY;
  if (Math.abs(delta) < 8 && y > 20) return;

  const nextDir: ScrollDirection = y <= 20 ? "up" : delta > 0 ? "down" : "up";
  lastScrollY = y;
  currentDirection = nextDir;

  scrollListeners.forEach((fn) => fn(nextDir, y));
}

function subscribeScroll(fn: (dir: ScrollDirection, scrollY: number) => void) {
  if (typeof window === "undefined") return () => {};
  if (!scrollBound) {
    lastScrollY = window.scrollY;
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    scrollBound = true;
  }
  scrollListeners.add(fn);

  return () => {
    scrollListeners.delete(fn);
    if (scrollListeners.size === 0 && scrollBound) {
      window.removeEventListener("scroll", onWindowScroll);
      scrollBound = false;
    }
  };
}

interface ScrollRevealTranslationProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Плавное скрытие блока с переводом при скролле вниз и плавное появление при возврате вверх
 * на базе IntersectionObserver.
 */
export default function ScrollRevealTranslation({
  children,
  className = "",
}: ScrollRevealTranslationProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isIntersectingRef = useRef(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isIntersectingRef.current = entry.isIntersecting;

          if (!entry.isIntersecting) {
            if (currentDirection === "down") {
              setVisible(false);
            }
          } else {
            if (currentDirection === "up" || window.scrollY <= 20) {
              setVisible(true);
            } else if (entry.intersectionRatio < 0.25 && entry.boundingClientRect.top < 140) {
              setVisible(false);
            }
          }
        }
      },
      {
        threshold: [0, 0.25, 0.6],
        rootMargin: "-48px 0px -24px 0px",
      }
    );

    observer.observe(el);

    const unsubscribe = subscribeScroll((dir, scrollY) => {
      if (scrollY <= 20 || dir === "up") {
        if (isIntersectingRef.current) {
          setVisible(true);
        }
        return;
      }

      // При скролле вниз плавно скрываем видимые блоки перевода
      if (dir === "down" && isIntersectingRef.current) {
        setVisible(false);
      }
    });

    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden={!visible}
      className={`transition-all duration-300 ease-in-out will-change-[opacity,transform] ${
        visible
          ? "translate-y-0 opacity-100"
          : "-translate-y-1.5 opacity-0 pointer-events-none"
      } ${className}`}
    >
      {children}
    </div>
  );
}
