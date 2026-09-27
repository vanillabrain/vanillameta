import React from 'react';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { CssBaseline } from '@mui/material';
import Router from './router';
import 'tui-grid/dist/tui-grid.css';
import Grid from 'tui-grid';
import Seo from '@/seo/Seo';

Grid.applyTheme('default', {
  outline: {
    border: '#63778a',
  },
  row: {
    hover: {
      background: '#E8F1FF',
    },
  },
  selection: {
    background: '#3AABFD',
  },
  area: {
    header: {
      background: '#fff',
    },
    body: {
      background: '#fff',
    },
  },
  cell: {
    normal: {
      background: 'rgba(0, 0, 0, 0)',
      border: '#D9DFE6',
      showVerticalBorder: true,
      showHorizontalBorder: true,
    },
    header: {
      background: '#fff',
      text: '#63778A',
      border: '#D9DFE6',
    },
    selectedHeader: {
      background: '#DBF1FC',
    },
    currentRow: {
      background: '#EBF9FF',
    },
  },
  scrollbar: {
    emptySpace: '#F2F4F7',
  },
});
Grid.setLanguage('ko', {
  // set new language
  display: {
    noData: i18n.t('common.noData'),
  },
});

function App() {
  const { t } = useTranslation();
  return (
    <>
      <Seo />
      <CssBaseline />
      <Router />
    </>
  );
}

export default App;
