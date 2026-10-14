import React, { useMemo } from 'react';
import { Button, ButtonProps } from '@mui/material';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';

/** Compact analysis controls, based on Rill's 28px / text-xs baseline. */
export const ANALYSIS_UI = {
  controlHeight: 28,
  inputHeight: 32,
  fontSize: 12,
  bodySize: 13,
  radius: 4,
  gap: 8,
  accent: '#4f46e5',
  selected: '#eef2ff',
  border: '#e2e8f0',
  muted: '#64748b',
  surface: '#f8fafc',
} as const;

export const analysisToggleSx = {
  textTransform: 'none',
  whiteSpace: 'nowrap',
  color: '#334155',
  border: '1px solid',
  borderColor: ANALYSIS_UI.border,
  '&:hover': { backgroundColor: ANALYSIS_UI.surface },
  '&[aria-pressed="true"]': {
    color: ANALYSIS_UI.accent,
    borderColor: ANALYSIS_UI.accent,
    backgroundColor: ANALYSIS_UI.selected,
    '&:hover': { backgroundColor: '#e0e7ff' },
  },
  '&.Mui-disabled': { color: '#94a3b8', backgroundColor: 'transparent', borderColor: 'transparent' },
} as const;

export const analysisFieldSx = {
  minWidth: 0,
  '& .MuiInputBase-root': { height: ANALYSIS_UI.inputHeight, fontSize: ANALYSIS_UI.fontSize },
  '& .MuiInputBase-input': {
    height: ANALYSIS_UI.inputHeight,
    boxSizing: 'border-box',
    paddingTop: 0,
    paddingBottom: 0,
    fontSize: ANALYSIS_UI.fontSize,
  },
  '& .MuiSelect-select, & .MuiInputLabel-root': { fontSize: ANALYSIS_UI.fontSize },
} as const;

export const analysisPanelSx = {
  p: 1.5,
  minWidth: 0,
  border: `1px solid ${ANALYSIS_UI.border}`,
  borderRadius: '4px',
  bgcolor: ANALYSIS_UI.surface,
} as const;

export const analysisModeGroupSx = {
  display: 'inline-flex',
  alignSelf: 'flex-start',
  p: '2px',
  gap: '2px',
  border: `1px solid ${ANALYSIS_UI.border}`,
  borderRadius: '4px',
  bgcolor: '#fff',
  '& .MuiButton-root': { borderColor: 'transparent' },
} as const;

export const analysisTableCellStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: `1px solid ${ANALYSIS_UI.border}`,
  borderRight: '1px solid #f1f5f9',
  fontSize: ANALYSIS_UI.fontSize,
  lineHeight: 1.5,
  fontVariantNumeric: 'tabular-nums',
};

/** Scoped theme also reaches analysis dialogs/menus through React portals. */
export function AnalysisUiProvider({ children }: React.PropsWithChildren) {
  const parent = useTheme();
  const theme = useMemo(
    () =>
      createTheme(parent, {
        typography: {
          body1: { fontSize: ANALYSIS_UI.bodySize },
          body2: { fontSize: ANALYSIS_UI.fontSize },
          subtitle2: { fontSize: ANALYSIS_UI.fontSize },
          h5: { fontSize: 20 },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                height: ANALYSIS_UI.controlHeight,
                minHeight: ANALYSIS_UI.controlHeight,
                minWidth: 0,
                padding: '4px 8px',
                fontSize: ANALYSIS_UI.fontSize,
                lineHeight: 1.4,
                borderRadius: `${ANALYSIS_UI.radius}px`,
                textTransform: 'none',
                '&.Mui-disabled': {
                  color: '#94a3b8',
                  backgroundColor: 'transparent',
                  border: '1px solid transparent',
                },
                '&:focus-visible': { outline: `2px solid ${ANALYSIS_UI.accent}`, outlineOffset: 2 },
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                minHeight: ANALYSIS_UI.inputHeight,
                borderRadius: `${ANALYSIS_UI.radius}px`,
                fontSize: ANALYSIS_UI.fontSize,
              },
              input: { padding: '6px 10px' },
              inputSizeSmall: { padding: '6px 10px' },
            },
          },
          MuiInputLabel: { styleOverrides: { root: { fontSize: ANALYSIS_UI.fontSize } } },
          MuiChip: {
            styleOverrides: {
              root: { height: 24, borderRadius: `${ANALYSIS_UI.radius}px`, fontSize: ANALYSIS_UI.fontSize },
              label: { paddingLeft: 8, paddingRight: 8 },
              deleteIcon: { fontSize: 16 },
            },
          },
          MuiCard: { styleOverrides: { root: { borderRadius: `${ANALYSIS_UI.radius}px`, boxShadow: 'none' } } },
        },
      }),
    [parent],
  );
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

export function AnalysisChoice({
  label,
  selected,
  ariaLabel,
  ...props
}: Omit<ButtonProps, 'children'> & {
  label: React.ReactNode;
  selected?: boolean;
  ariaLabel?: string;
}) {
  return (
    <Button type="button" aria-pressed={selected} aria-label={ariaLabel} sx={analysisToggleSx} {...props}>
      {label}
    </Button>
  );
}
