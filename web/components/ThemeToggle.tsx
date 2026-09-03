"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null;

    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const initialTheme: Theme =
      savedTheme ?? (systemPrefersDark ? "dark" : "light");

    setTheme(initialTheme);

    document.documentElement.classList.toggle(
      "dark",
      initialTheme === "dark"
    );

    setMounted(true);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme =
      theme === "light" ? "dark" : "light";

    setTheme(nextTheme);

    localStorage.setItem("theme", nextTheme);

    document.documentElement.classList.toggle(
      "dark",
      nextTheme === "dark"
    );
  }

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Змінити тему"
        className="h-10 w-10 rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Змінити тему"
      title={
        theme === "light"
          ? "Увімкнути темну тему"
          : "Увімкнути світлу тему"
      }
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}