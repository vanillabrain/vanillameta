import React, { useState } from 'react';
import WidgetAttributeSelect from '../WidgetCreate/WidgetAttributeSelect';
import PageContainer from '../../../components/PageContainer';
import PageTitleBox from '../../../components/PageTitleBox';
import ConfirmCancelButton from '../../../components/button/ConfirmCancelButton';

function WidgetModify(props) {
  const [data, setData] = useState({});

  const handleUpdate = enteredData => {
    return setData(prevState => ({ ...prevState, ...enteredData }));
  };

  const handleSubmit = event => {
    event.preventDefault();
    console.log(data, 'submit!');
  };

  return (
    <PageContainer>
      <PageTitleBox title="위젯 수정" button={<ConfirmCancelButton confirmProps={{ onClick: handleSubmit }} />}>
        <WidgetAttributeSelect onUpdate={handleUpdate} />
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetModify;
