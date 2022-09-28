import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Stack, TextField } from '@mui/material';
import PageContainer from '@/components/PageContainer';
import PageTitleBox from '@/components/PageTitleBox';
import SubmitButton from '@/components/button/SubmitButton';
import ConfirmCancelButton from '@/components/button/ConfirmCancelButton';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-mysql';
import 'ace-builds/src-noconflict/theme-tomorrow';
import 'ace-builds/src-noconflict/snippets/mysql';
import 'ace-builds/src-min-noconflict/ext-language_tools';
import { get, post } from '@/helpers/apiHelper';
import DataGrid from '@/components/dataGrid';
import { OptColumn } from 'tui-grid/types/options';

const DataSet = props => {
  const [isConnected, setIsConnected] = useState(false);
  const [editorValue, setEditorValue] = useState<string>('');
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);

  const testColumns = [
    { name: 'accountName', header: '쇼핑몰', align: 'center', width: 200, sortable: true },
    { name: 'productId', header: '상품ID', align: 'center', width: 150, className: 'numberCell', sortable: true },
    { name: 'productName', header: '상품명', align: 'left', minWidth: 300, sortable: true },
    { name: 'productGroupName', header: '상품그룹명', align: 'left', width: 200, sortable: true },
    { name: 'saleStatusName', header: '판매상태', align: 'center', width: 120, sortable: true },
    {
      name: 'price',
      header: '판매가',
      align: 'right',
      width: 120,
      className: 'numberCell',
      sortable: true,
    },
    {
      name: 'pcSalePrice',
      header: 'PC 할인가',
      align: 'right',
      width: 120,
      className: 'numberCell',
      sortable: true,
    },
    {
      name: 'mobileSalePrice',
      header: '모바일 할인가',
      align: 'right',
      width: 120,
      className: 'numberCell',
      sortable: true,
    },
    {
      name: 'deliveryPrice',
      header: '배송비',
      align: 'right',
      width: 120,
      className: 'numberCell',
      sortable: true,
    },
    {
      name: 'productRegDate',
      header: '상품 등록일',
      align: 'center',
      width: 110,
      className: 'numberCell',
      sortable: true,
    },
    {
      name: 'productModDate',
      header: '상품 수정',
      align: 'center',
      width: 110,
      className: 'numberCell',
      sortable: true,
    },
  ];

  useLayoutEffect(() => {
    getData();
  }, []);

  useEffect(() => {
    if (data.length > 0) {
      // setColumns(createColumns());
    }
  }, [data]);

  const getData = () => {
    console.log(editorValue);
    get('/data/sample/chart.json').then(response => {
      setData(response.data);
      setColumns(createColumns(response.data));
    });
  };

  const createColumns = data => {
    let target = null;
    if (data instanceof Array && data.length > 0) {
      target = data[0];
    } else if (data instanceof Object) {
      target = data;
    }
    const columns = Object.keys(target).map(key => {
      return { name: key, header: key, align: key, width: 200, sortable: true };
    });
    return columns;
  };

  const handleSubmit = data => {
    data.preventDefault();
    const userData = {
      userSetName: data.target.userSetName.value,
      userSetContent: data.target.userSetContent.value,
    };
    console.log(userData);
    setIsConnected(true);
  };

  const onLoad = e => {
    console.log(e);
  };

  const onChange = newValue => {
    console.log('change', newValue);
    setEditorValue(newValue);
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
            // helperText="데이터셋의 이름을 입력해 주세요"
          />
          <AceEditor
            placeholder="Please enter a query."
            style={{ width: '100%', height: '200px' }}
            mode="mysql"
            theme="tomorrow"
            name="codeInput"
            onLoad={onLoad}
            onChange={onChange}
            fontSize={14}
            showPrintMargin={true}
            showGutter={true}
            highlightActiveLine={true}
            value={editorValue}
            setOptions={{
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              enableSnippets: true,
              showLineNumbers: true,
              tabSize: 2,
            }}
          />
          <SubmitButton label="Run" type="button" onClick={getData} />
          <DataGrid
            minBodyHeight={300}
            bodyHeight={500}
            data={data}
            columns={columns}
            columnOptions={{
              resizable: true,
            }}
          />
        </Stack>
      </PageTitleBox>
    </PageContainer>
  );
};

export default DataSet;
