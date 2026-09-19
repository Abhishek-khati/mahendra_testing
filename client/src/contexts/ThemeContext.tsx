import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

// Initialize theme immediately to prevent flash
function getInitialTheme(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;
  
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  
  // Check system preference
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  
  return defaultTheme;
}

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme(defaultTheme));
  const [mounted, setMounted] = useState(false);

  // Apply theme on mount and when it changes
  useEffect(() => {
    setMounted(true);
    applyTheme(theme);
  }, [theme]);

  // Apply initial theme immediately on mount (before paint)
  useEffect(() => {
    applyTheme(getInitialTheme(defaultTheme));
  }, [defaultTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    if (switchable) {
      localStorage.setItem("theme", newTheme);
    }
    applyTheme(newTheme);
  }, [switchable]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!switchable) return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("theme");
      if (!stored) {
        const newTheme = e.matches ? "dark" : "light";
        setThemeState(newTheme);
        applyTheme(newTheme);
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [switchable]);

  // Don't render children until theme is applied (prevents flash)
  if (!mounted && switchable) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
