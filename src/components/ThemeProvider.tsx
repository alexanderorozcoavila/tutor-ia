"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { userService } from '@/lib/userService';

interface ThemeContextType {
  themeSlug: string;
  themeConfig: any;
  setTheme: (slug: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [themeSlug, setThemeSlug] = useState('default');
  const [themeConfig, setThemeConfig] = useState<any>({});

  useEffect(() => {
    if (user?.theme) {
      setThemeSlug(user.theme.slug || 'default');
      setThemeConfig(user.theme.config || {});
    } else {
      setThemeSlug('default');
      setThemeConfig({});
    }
  }, [user]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-theme', themeSlug);
      
      // Reset previous theme variables to avoid bleeding
      const style = root.style;
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if (prop.startsWith('--theme-')) {
          style.removeProperty(prop);
        }
      }

      // Inject CSS variables from config
      if (themeConfig) {
        Object.entries(themeConfig).forEach(([key, value]) => {
          if (typeof value === 'string' || typeof value === 'number') {
            const cssKey = key === 'bgOpacity' ? '--theme-bg-opacity' : `--theme-${key}`;
            root.style.setProperty(cssKey, value.toString());
          }
        });
      }
    }
  }, [themeSlug, themeConfig]);

  return (
    <ThemeContext.Provider value={{ themeSlug, themeConfig, setTheme: setThemeSlug }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
