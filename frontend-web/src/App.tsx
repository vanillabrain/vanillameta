import React, { useEffect } from 'react';
import { CssBaseline } from '@mui/material';
import Layout from './layouts/Layout';
import Router from './router';
import 'tui-grid/dist/tui-grid.css';
import Grid from 'tui-grid';

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
    noData: '조회된 데이터가 없습니다.',
  },
});

function App() {
  return (
    <>
      <CssBaseline />
      <Layout>
        <Router />
      </Layout>
    </>
  );
}

export default App;
