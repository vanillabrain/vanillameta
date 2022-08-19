import React, { useEffect, useState } from 'react';
import { Box, Stack, TextField } from '@mui/material';
import PageContainer from '../../../components/PageContainer';
import PageTitleBox from '../../../components/PageTitleBox';
import AddWidgetPopupButton from './AddWidgetPopupButton';
import ConfirmCancelButton, { CancelButton } from '../../../components/button/ConfirmCancelButton';
import DialogAlertButton from '../../../components/button/DialogAlertButton';

function DashboardModify(props) {
  return (
    <PageContainer>
      <PageTitleBox
        title="대시보드 편집"
        button={
          <React.Fragment>
            <ConfirmCancelButton
              confirmProps={{ disabled: true }}
              cancelButton={
                <DialogAlertButton button={<CancelButton cancelLabel="취소" cancelProps={{ component: 'div' }} />}>
                  변경사항을 저장하지 않고 작업을 취소하시겠습니까?
                </DialogAlertButton>
              }
            />
          </React.Fragment>
        }
      >
        <Stack flexDirection="row" justifyContent="space-between" alignItems="baseline" mb={3}>
          <TextField
            id="userDashboardName"
            label=""
            placeholder="대시보드의 이름을 입력해 주세요"
            required
            autoFocus
            sx={{ width: '50%' }}
          />
          <AddWidgetPopupButton label="위젯 추가" />
        </Stack>
        <Box sx={{ width: '100%', height: '46.875vw', maxHeight: '70vh', borderRadius: 1, backgroundColor: '#eee' }} />
      </PageTitleBox>
    </PageContainer>
  );
}

export default DashboardModify;
