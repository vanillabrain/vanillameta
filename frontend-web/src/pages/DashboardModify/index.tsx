import React from 'react';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';
import { Box, Button, Stack, TextField } from '@mui/material';
import TitleBox from '@/components/TitleBox';
import { Add } from '@mui/icons-material';
import ModalButton from '../../components/ModalButton';

const naviUrl = '/dashboard/addwidget';
// DashboardCreate.tsx 와 동일

function DashboardModify(props) {
  return (
    <PageContainer>
      <PageTitleBox title="대시보드 편집" button="confirm" disabled>
        <Stack flexDirection="row" justifyContent="space-between" alignItems="baseline" mb={3}>
          <TextField
            id="userDashboardName"
            label="대시보드 이름"
            placeholder="대시보드의 이름을 입력해 주세요"
            required
            autoFocus
            sx={{ width: '50%' }}
          />
          <ModalButton label="위젯 선택" />
        </Stack>
        <Box sx={{ width: '100%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }} />
      </PageTitleBox>
    </PageContainer>
  );
}

export default DashboardModify;
