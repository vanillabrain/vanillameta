import { Transition } from 'react-transition-group';
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { ReactElement } from 'react';
import loadingGif from '@/assets/images/loading.gif';

const duration = 100;

const defaultStyle = {
  transition: `opacity ${duration}ms ease-in`,
  opacity: 0,
};

const transitionStyles = {
  entering: { opacity: 0.4 },
  entered: { opacity: 0.4 },
  exiting: { opacity: 0, delay: 1000 },
  exited: { opacity: 0, display: 'none' },
};

const LoadingBox = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'fixed',
  width: '100%',
  height: '100%',
  background: '#FFFFFF',
  opacity: 0,
  boxSizing: 'border-box',
  borderRadius: '4px',
  zIndex: 100,
}));

export const Loading = ({ in: inProp, ...rest }): ReactElement => {
  return (
    <Transition in={inProp} timeout={duration}>
      {state => (
        <LoadingBox
          style={{
            ...defaultStyle,
            ...transitionStyles[state],
          }}
          {...rest}
        >
          <img src={loadingGif} alt="Logo" width="40px" height="40px" />
        </LoadingBox>
      )}
    </Transition>
  );
};
