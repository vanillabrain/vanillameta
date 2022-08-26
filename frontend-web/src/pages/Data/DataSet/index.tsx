import React, { useState } from 'react';
import { Stack, TextField } from '@mui/material';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import SubmitButton from '@/components/button/SubmitButton';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';

function DataSet(props) {
  const [isConnected, setIsConnected] = useState(false);

  const handleSubmit = data => {
    data.preventDefault();
    const userData = {
      userSetName: data.target.userSetName.value,
      userSetContent: data.target.userSetContent.value,
    };
    console.log(userData);
    setIsConnected(true);
  };

  return (
    <PageContainer>
      <PageTitleBox title="데이터셋 생성" button={<ConfirmCancelButton confirmProps={{ disabled: !isConnected }} />}>
        <Stack component="form" flexDirection="column" spacing={3} sx={{ maxWidth: 800, m: 'auto' }} onSubmit={handleSubmit}>
          <TextField
            id="userSetName"
            label="데이터셋 이름"
            placeholder="데이터셋의 이름을 입력해 주세요"
            autoFocus
            required
            // helperText="데이터셋의 이름을 입력해 주세요"
          />
          <TextField
            id="userSetContent"
            label="데이터셋 입력"
            placeholder="데이터셋의 내용을 입력해 주세요"
            multiline
            minRows={10}
            required
            // helperText="데이터셋의 내용을 입력해 주세요"
          />
          <SubmitButton label="Test Connect" type="submit" />
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataSet;
