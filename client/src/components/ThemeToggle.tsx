import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-foreground/70 transition-colors duration-fast hover:bg-accent hover:text-foreground"
    >
      {/* Both icons are always mounted and cross-fade, so the button never
          changes size between states. */}
      <Sun className="h-[1.05rem] w-[1.05rem] rotate-0 scale-100 transition-transform duration-base ease-emphasized dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.05rem] w-[1.05rem] rotate-90 scale-0 transition-transform duration-base ease-emphasized dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
