import React from 'react';
import WidgetAttributeSelect from '../WidgetCreate/WidgetAttributeSelect';
import PageContainer from '../../components/PageContainer';
import PageTitleBox from '../../components/PageTitleBox';

function WidgetModify(props) {
  return (
    <PageContainer>
      <PageTitleBox title="위젯 조회">
        <WidgetAttributeSelect />
      </PageTitleBox>
    </PageContainer>
  );
}

export default WidgetModify;
