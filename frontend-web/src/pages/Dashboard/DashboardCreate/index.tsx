import React, { useEffect } from 'react';
import DashboardModify from '@/pages/Dashboard/DashboardModify';
// 지우지 마세요 DashboardModify 에서 가져다 써야함
import { useSearchParams } from 'react-router-dom';

function DashboardCreate(props) {
  return <DashboardModify />;
}

export default DashboardCreate;
