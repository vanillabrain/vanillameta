import React, { ReactElement } from 'react';
import { Transition } from 'react-transition-group';
import loadingGif from '@/assets/images/loading.gif';

interface LoadingProps {
  in: boolean;
  style?: React.CSSProperties;
  rest?: any;
}

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

export const Loading = ({ in: inProp, style, ...rest }: LoadingProps): ReactElement => {
  return (
    <Transition in={inProp} timeout={duration}>
      {state => (
        <div
          className="flex items-center justify-center fixed w-full h-full bg-white opacity-0 rounded z-[100]"
          style={{
            ...defaultStyle,
            ...transitionStyles[state],
            ...style,
          }}
          {...rest}
        >
          <img src={loadingGif} alt="Logo" width="40px" height="40px" />
        </div>
      )}
    </Transition>
  );
};
