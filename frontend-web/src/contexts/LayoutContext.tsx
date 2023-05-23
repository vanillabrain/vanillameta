import { createContext, useState } from 'react';

type LayoutContext = {
  fixed: boolean;
  fixLayout: (visible: boolean) => void;
  footerBg: string | null;
  changeFooterBg: (color: string) => void;
};

export const LayoutContext = createContext<LayoutContext>({} as LayoutContext);

export const LayoutProvider = ({ children }) => {
  const [fixed, setLayoutFix] = useState(false);
  const [footerBg, setFooterBg] = useState(null);

  const fixLayout = (visible: boolean) => {
    setLayoutFix(visible);
  };

  const changeFooterBg = (color: string) => {
    setFooterBg(color);
  };

  return <LayoutContext.Provider value={{ fixed, fixLayout, footerBg, changeFooterBg }}>{children}</LayoutContext.Provider>;
};
