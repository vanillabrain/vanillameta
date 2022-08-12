import React, { useEffect, useState } from 'react';
import { Box, Stack, TextField } from '@mui/material';
import PageContainer from '../../../components/PageContainer';
import PageTitleBox from '../../../components/PageTitleBox';
import DialogButton from '../../../components/DialogButton';

function DashboardModify(props) {
  return (
    <PageContainer>
      <PageTitleBox title="대시보드 편집" button="confirm" disabled>
        <Stack flexDirection="row" justifyContent="space-between" alignItems="baseline" mb={3}>
          <TextField
            id="userDashboardName"
            label=""
            placeholder="대시보드의 이름을 입력해 주세요"
            required
            autoFocus
            sx={{ width: '50%' }}
          />
          <DialogButton label="위젯 추가" />
        </Stack>
        <Box sx={{ width: '80%', height: '50vw', borderRadius: 1, backgroundColor: '#eee' }} />
      </PageTitleBox>
    </PageContainer>
  );
}

export default DashboardModify;
