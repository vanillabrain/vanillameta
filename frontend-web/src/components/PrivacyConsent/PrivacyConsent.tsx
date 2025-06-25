import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  FormControlLabel,
  Checkbox,
  Link,
  Box,
  Snackbar,
  Alert,
} from '@mui/material';
import { Button } from '@/components/ui/mui-button-compat';
import { useAnalytics } from '../../utils/enhanced-analytics';

interface PrivacyConsentProps {
  onConsentUpdate?: (consent: boolean) => void;
}

export const PrivacyConsent: React.FC<PrivacyConsentProps> = ({ onConsentUpdate }) => {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState({
    analytics: false,
    performance: false,
    functional: true, // 필수 쿠키는 항상 활성화
  });
  const [showSnackbar, setShowSnackbar] = useState(false);
  const analytics = useAnalytics();

  useEffect(() => {
    // 기존 동의 상태 확인
    const savedConsent = localStorage.getItem('privacy_consent');
    if (!savedConsent) {
      // 첫 방문자에게 동의 요청
      setOpen(true);
    } else {
      const parsed = JSON.parse(savedConsent);
      setConsent(parsed);
      analytics.updateConsent(parsed.analytics);
    }
  }, [analytics]);

  const handleAcceptAll = () => {
    const newConsent = {
      analytics: true,
      performance: true,
      functional: true,
    };
    saveConsent(newConsent);
    setOpen(false);
  };

  const handleAcceptSelected = () => {
    saveConsent(consent);
    setOpen(false);
  };

  const handleRejectAll = () => {
    const newConsent = {
      analytics: false,
      performance: false,
      functional: true,
    };
    saveConsent(newConsent);
    setOpen(false);
  };

  const saveConsent = (consentData: typeof consent) => {
    localStorage.setItem('privacy_consent', JSON.stringify(consentData));
    localStorage.setItem('privacy_consent_date', new Date().toISOString());
    analytics.updateConsent(consentData.analytics);
    setConsent(consentData);
    setShowSnackbar(true);
    onConsentUpdate?.(consentData.analytics);
  };

  const handleManageConsent = () => {
    setOpen(true);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={() => {
          // Dialog는 ESC 키와 backdrop 클릭으로 닫히지 않도록 설정됨
        }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h5" fontWeight="bold">
            개인정보 처리 및 쿠키 사용 동의
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            VanillaMeta는 사용자 경험 개선과 서비스 품질 향상을 위해 쿠키와 유사한 기술을 사용합니다. 아래에서 각 유형별로
            동의 여부를 선택하실 수 있습니다.
          </Typography>

          <Box sx={{ mt: 3 }}>
            <FormControlLabel
              control={<Checkbox checked={consent.functional} disabled color="primary" />}
              label={
                <Box>
                  <Typography variant="subtitle2" fontWeight="medium">
                    필수 쿠키
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    로그인 상태 유지, 보안 등 서비스 이용에 필수적인 기능
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={consent.analytics}
                  onChange={e => setConsent({ ...consent, analytics: e.target.checked })}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2" fontWeight="medium">
                    분석 쿠키
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    사용자 행동 분석을 통한 서비스 개선 (Google Analytics 등)
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={consent.performance}
                  onChange={e => setConsent({ ...consent, performance: e.target.checked })}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="subtitle2" fontWeight="medium">
                    성능 쿠키
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    페이지 로딩 속도, 오류 추적 등 성능 모니터링
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" color="text.secondary">
              자세한 내용은{' '}
              <Link href="/privacy-policy" target="_blank" underline="hover">
                개인정보처리방침
              </Link>
              에서 확인하실 수 있습니다. 동의는 언제든지 변경하실 수 있습니다.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleRejectAll} color="inherit" variant="outlined">
            모두 거부
          </Button>
          <Button onClick={handleAcceptSelected} color="primary" variant="outlined">
            선택 항목만 동의
          </Button>
          <Button onClick={handleAcceptAll} color="primary" variant="contained">
            모두 동의
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={showSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowSnackbar(false)} severity="success">
          개인정보 처리 동의가 저장되었습니다.
        </Alert>
      </Snackbar>

      {/* 플로팅 설정 버튼 (화면 우하단) */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <Button
          size="small"
          variant="text"
          color="inherit"
          onClick={handleManageConsent}
          sx={{
            fontSize: '0.75rem',
            textDecoration: 'underline',
            opacity: 0.7,
            '&:hover': {
              opacity: 1,
            },
          }}
        >
          개인정보 설정
        </Button>
      </Box>
    </>
  );
};

// 쿠키 배너 컴포넌트 (간단한 버전)
export const CookieBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  const analytics = useAnalytics();

  useEffect(() => {
    const consent = localStorage.getItem('privacy_consent');
    if (!consent) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    const consent = {
      analytics: true,
      performance: true,
      functional: true,
    };
    localStorage.setItem('privacy_consent', JSON.stringify(consent));
    localStorage.setItem('privacy_consent_date', new Date().toISOString());
    analytics.updateConsent(true);
    setShow(false);
  };

  const handleReject = () => {
    const consent = {
      analytics: false,
      performance: false,
      functional: true,
    };
    localStorage.setItem('privacy_consent', JSON.stringify(consent));
    localStorage.setItem('privacy_consent_date', new Date().toISOString());
    analytics.updateConsent(false);
    setShow(false);
  };

  if (!show) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        bgcolor: 'background.paper',
        boxShadow: 3,
        p: 2,
        zIndex: 1300,
      }}
    >
      <Box sx={{ maxWidth: 'lg', mx: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          더 나은 서비스 제공을 위해 쿠키를 사용합니다.{' '}
          <Link href="/privacy-policy" target="_blank" underline="hover">
            자세히 보기
          </Link>
        </Typography>
        <Button size="small" variant="outlined" color="inherit" onClick={handleReject}>
          거부
        </Button>
        <Button size="small" variant="contained" color="primary" onClick={handleAccept}>
          동의
        </Button>
      </Box>
    </Box>
  );
};
