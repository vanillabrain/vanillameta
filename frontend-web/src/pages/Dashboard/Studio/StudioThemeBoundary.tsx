import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import theme from './studioTheme';

/** Transitional Studio-only theme. React context also reaches portaled drawers/dialogs. */
export default function StudioThemeBoundary({ children }: React.PropsWithChildren) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
