import React, { createContext } from 'react';
import AlertTemplate, { SnackbarTemplate } from '@/components/alert';
import { positions, Provider, transitions } from 'react-alert';

export const SnackbarContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const defaultOp = {
    position: positions.BOTTOM_CENTER,
    offset: '30px',
    transition: transitions.SCALE,
  };
  const snackbarOp = {
    position: positions.BOTTOM_LEFT,
    timeout: 6000,
  };
  return (
    <Provider template={AlertTemplate} {...defaultOp}>
      <Provider template={SnackbarTemplate} context={SnackbarContext} {...snackbarOp}>
        {children}
      </Provider>
    </Provider>
  );
};
