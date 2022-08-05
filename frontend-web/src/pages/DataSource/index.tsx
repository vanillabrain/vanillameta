import React, { useState } from 'react';
import { Stack } from '@mui/material';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';
import TitleBox from '../../components/TitleBox';
import ImgCardList from '../../components/ImgCardList';
import LabelInputForm from '../../components/LabelInputForm';

const typeList = [
  { key: 0, value: 'MySQL', src: 'mysql-logo.svg' },
  { key: 1, value: 'MariaDB', src: 'mariadb-logo.svg' },
  { key: 2, value: 'PostgreSQL', src: 'pgsql-logo.svg' },
  { key: 3, value: 'Oracle', src: 'oracle-logo.svg' },
  { key: 4, value: 'Db2', src: 'db2-logo.svg' },
  { key: 5, value: 'Redshift', src: 'redshift-logo.svg' },
  { key: 6, value: 'BigQuery', src: 'bigquery-logo.svg' },
  { key: 7, value: 'SQLite', src: 'sqlite-logo.svg' },
  { key: 8, value: 'MSSQL', src: 'mssql-logo.svg' },
  { key: 9, value: 'AltiBase', src: 'altibase-logo.png' },
];

const formList = [
  { key: 0, label: '이름', id: 'userName' },
  { key: 1, label: 'HOST', id: 'userHost', width: '50%' },
  { key: 2, label: 'Port', id: 'userPort', width: '50%' },
  { key: 3, label: 'User', id: 'userId' },
  { key: 4, label: 'Password', id: 'userPassword', type: 'password' },
  { key: 5, label: 'Schema', id: 'userSchema' },
];

function DataSource(props) {
  const [isConnected, setIsConnected] = useState(false);

  // const [selectedSource, setSelectedSource] = useState(null);

  // const inputSourceValue = enteredValue => {
  //   const value = enteredValue;
  //   setSelectedSource(value);
  //   console.log(selectedSource);
  // };

  return (
    <PageContainer>
      <PageTitleBox title={'데이터 소스 연결'} disabled={!isConnected}>
        <Stack spacing={3}>
          <TitleBox title={'step.01 타입 설정'}>
            <ImgCardList
              data={typeList}
              // inputValue={inputSourceValue}
            />
          </TitleBox>
          <TitleBox title={'step.02 연결 정보 입력'}>
            <LabelInputForm data={formList} />
          </TitleBox>
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
}

export default DataSource;
