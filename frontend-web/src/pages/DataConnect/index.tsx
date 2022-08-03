import React from 'react';
import { Button, Stack } from '@mui/material';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';
import TitleBox from '../../components/TitleBox';
import ImgCardList from '../../components/ImgCardList';
import LabelInputForm from '../../components/LabelInputForm';

const typeList = [
  { key: 0, label: 'MySQL', src: 'mysql-logo.svg' },
  { key: 1, label: 'MariaDB', src: 'mariadb-logo.svg' },
  { key: 2, label: 'PostgreSQL', src: 'pgsql-logo.svg' },
  { key: 3, label: 'Oracle', src: 'oracle-logo.svg' },
  { key: 4, label: 'Db2', src: 'db2-logo.svg' },
  { key: 5, label: 'Redshift', src: 'redshift-logo.svg' },
  { key: 6, label: 'BigQuery', src: 'bigquery-logo.svg' },
  { key: 7, label: 'SQLite', src: 'sqlite-logo.svg' },
  { key: 8, label: 'MSSQL', src: 'mssql-logo.svg' },
  { key: 9, label: 'AltiBase', src: 'altibase-logo.png' },
];

const formList = [
  { key: 0, label: '이름', id: 'userName' },
  { key: 1, label: 'HOST', id: 'userHost', width: '50%' },
  { key: 2, label: 'Port', id: 'userPort', width: '50%' },
  { key: 3, label: 'User', id: 'userId' },
  { key: 4, label: 'Password', id: 'userPassword', type: 'password' },
  { key: 5, label: 'Schema', id: 'userSchema' },
];

function DataConnect(props) {
  return (
    <PageContainer>
      <PageTitleBox title={'데이터 소스 연결'} dropmenu>
        <Stack spacing={3}>
          <TitleBox title={'step.01 타입 설정'}>
            <ImgCardList data={typeList} />
          </TitleBox>
          <TitleBox title={'step.02 연결 정보 입력'}>
            <Stack component="form" sx={{ maxWidth: 500, mx: 'auto', mt: 3 }}>
              <LabelInputForm data={formList} />
              <Button variant="contained" size="large" sx={{ mt: 3, mx: 2 }}>
                Test Connect
              </Button>
            </Stack>
          </TitleBox>
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataConnect;
