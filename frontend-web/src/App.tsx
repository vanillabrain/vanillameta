import React from 'react';
import { connectSocket } from '@/helpers/socket';
import Router from './router';
import Seo from '@/seo/Seo';

function App() {
  React.useEffect(() => {
    connectSocket();
  }, []);
  return (
    <>
      <Seo />
      <Router />
    </>
  );
}

export default App;
