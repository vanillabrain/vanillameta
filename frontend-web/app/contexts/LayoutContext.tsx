'use client';

import { createContext, useState, useContext, ReactNode } from 'react';

interface LayoutContextType {
  fixed: boolean;
  fixLayout: (visible: boolean) => void;
  footerBg: string | null;
  changeFooterBg: (color: string) => void;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

interface LayoutProviderProps {
  children: ReactNode;
}

export const LayoutProvider = ({ children }: LayoutProviderProps) => {
  const [fixed, setLayoutFix] = useState(false);
  const [footerBg, setFooterBg] = useState<string | null>(null);

  const fixLayout = (visible: boolean) => {
    setLayoutFix(visible);
  };

  const changeFooterBg = (color: string) => {
    setFooterBg(color);
  };

  const value: LayoutContextType = {
    fixed,
    fixLayout,
    footerBg,
    changeFooterBg,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return context;
};

// Backward compatibility
export { LayoutContext };