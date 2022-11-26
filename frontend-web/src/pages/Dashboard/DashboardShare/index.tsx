import React from 'react';
import { useParams } from 'react-router-dom';

const DashboardShare = () => {
  const { dashboardToken } = useParams();
  console.log(dashboardToken);

  return <div>대시보드</div>;
};

export default DashboardShare;
