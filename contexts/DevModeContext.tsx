"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DevModeContextType {
  isDevMode: boolean;
  setDevMode: (enabled: boolean) => void;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hrDashboard.devMode');
      if (saved === 'true') {
        setIsDevMode(true);
      }
    }
  }, []);

  const setDevMode = (enabled: boolean) => {
    setIsDevMode(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrDashboard.devMode', enabled.toString());
    }
  };

  return (
    <DevModeContext.Provider value={{ isDevMode, setDevMode }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (context === undefined) {
    throw new Error('useDevMode must be used within a DevModeProvider');
  }
  return context;
}