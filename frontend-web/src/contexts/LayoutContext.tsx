import { createContext, FC, useState } from 'react';

type LayoutContext = { fixed: boolean; fixLayout: (visible: boolean) => void };

export const LayoutContext = createContext<LayoutContext>({} as LayoutContext);

export const LayoutProvider = ({ children }) => {
  const [fixed, setLayoutFix] = useState(false);

  const fixLayout = (visible: boolean) => {
    setLayoutFix(visible);
  };

  return <LayoutContext.Provider value={{ fixed, fixLayout }}>{children}</LayoutContext.Provider>;
};
