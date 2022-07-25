import React from 'react';
import Header from './Header/Header';
import Footer from './Footer/Footer';

function Layout(props) {
  return (
    <React.Fragment>
      <Header />
      {props.children}
      <Footer />
    </React.Fragment>
  );
}

export default Layout;
