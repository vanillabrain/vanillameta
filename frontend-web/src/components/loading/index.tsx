import { Transition } from 'react-transition-group';
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { connectSocket } from '@/helpers/socket';
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

const LoadingBox = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
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

export const Loading = ({ in: inProp, style, ...rest }: LoadingProps): ReactElement => {
  const { t } = useTranslation();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const s = connectSocket();
    const onProgress = (payload: { phase: string; elapsedMs: number }) => {
      setElapsedMs(payload.phase === 'running' ? payload.elapsedMs : 0);
    };
    s.on('query:progress', onProgress);
    return () => {
      s.off('query:progress', onProgress);
    };
  }, []);

  return (
    <Transition in={inProp} timeout={duration}>
      {state => (
        <LoadingBox
          style={{
            ...defaultStyle,
            ...transitionStyles[state],
            ...style,
          }}
          {...rest}
        >
          <img src={loadingGif} alt="Logo" width="40px" height="40px" />
          {elapsedMs > 0 && (
            <Box sx={{ fontSize: '12px', color: '#555' }}>
              {t('common.queryRunning', { sec: Math.floor(elapsedMs / 1000) })}
            </Box>
          )}
        </LoadingBox>
      )}
    </Transition>
  );
};
