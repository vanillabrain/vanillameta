import React, { useEffect, useState } from 'react';
import { Snackbar } from '@mui/material';
import { Button } from '@/components/ui/mui-button-compat';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import * as serviceWorkerRegistration from '../serviceWorkerRegistration';

interface ServiceWorkerUpdatePromptProps {
  registration?: ServiceWorkerRegistration;
}

const ServiceWorkerUpdatePrompt: React.FC<ServiceWorkerUpdatePromptProps> = () => {
  const [showReload, setShowReload] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const onSWUpdate = (registration: ServiceWorkerRegistration) => {
    setShowReload(true);
    setWaitingWorker(registration.waiting);
  };

  useEffect(() => {
    serviceWorkerRegistration.register({ onUpdate: onSWUpdate });
  }, []);

  const reloadPage = () => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
    setShowReload(false);
    window.location.reload();
  };

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setShowReload(false);
  };

  return (
    <Snackbar
      open={showReload}
      message="새로운 버전이 있습니다!"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      action={
        <React.Fragment>
          <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={reloadPage}>
            업데이트
          </Button>
          <Button
            variant="text"
            size="small"
            aria-label="close"
            color="inherit"
            onClick={handleClose}
            sx={{ minWidth: 'auto', padding: '8px' }}
          >
            <CloseIcon fontSize="small" />
          </Button>
        </React.Fragment>
      }
    />
  );
};

export default ServiceWorkerUpdatePrompt;
