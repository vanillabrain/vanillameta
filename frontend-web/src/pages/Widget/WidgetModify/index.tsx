import React, { useState } from 'react';
import WidgetAttributeSelect from '../WidgetCreate/WidgetAttributeSelect';
import PageContainer from '../../../components/PageContainer';
import PageTitleBox from '../../../components/PageTitleBox';
import ConfirmCancelButton from '../../../components/button/ConfirmCancelButton';
import { useParams } from 'react-router-dom';

function WidgetModify(props) {
  const [data, setData] = useState({});

  const handleUpdate = enteredData => {
    return setData(prevState => ({ ...prevState, ...enteredData }));
  };

  const handleSubmit = event => {
    event.preventDefault();
    console.log(data, 'submit!');
  };

  const { widget_id } = useParams();

  return (
    <PageContainer>
      <PageTitleBox title="위젯 수정" button={<ConfirmCancelButton confirmProps={{ onClick: handleSubmit }} />}>
        <WidgetAttributeSelect data={data} onUpdate={handleUpdate} />
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetModify;
