import React from 'react';
import { ListItem, ListItemButton, ListItemIcon, Stack } from '@mui/material';
import { BarChart, BubbleChart, Dashboard, PieChart, ScatterPlot, StackedLineChart } from '@mui/icons-material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DonutChart from '@/widget/modules/piechart/DonutChart';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { styled } from '@mui/system';

const tableBorder = '1px solid #DADDDD';

function BoardListItem(props) {
  const { postItem, message, handleDeleteSelect } = props;

  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const dateData = data => {
    const userDate = new Date(data);
    const year = userDate.getFullYear();
    const month = userDate.getMonth() + 1;
    const date = userDate.getDate();
    return `${year}-${month >= 10 ? month : '0' + month}-${date >= 10 ? date : '0' + date}`;
  };

  const TitleSpan = styled('span')({
    display: 'flex',
    height: '14px',
    justifyContent: 'space-between',
    fontFamily: 'Pretendard',
    fontSize: '14px',
    fontWeight: '600',
    fontStretch: 'normal',
    fontStyle: 'normal',
    lineHeight: '1.14',
    letterSpacing: 'normal',
    textAlign: 'left',
    color: '#333333',
  });

  const SubTitleSpan = styled('span')({
    display: 'flex',
    height: '14px',
    justifyContent: 'space-between',
    fontFamily: 'Pretendard',
    fontSize: '14px',
    fontWeight: '500',
    fontStretch: 'normal',
    fontStyle: 'normal',
    lineHeight: '1.14',
    letterSpacing: 'normal',
    textAlign: 'left',
    color: '#333333',
  });

  let iconType;
  switch (postItem.componentType) {
    case 'DASHBOARD':
      iconType = <Dashboard />;
      break;
    case 'CHART_LINE':
      iconType = <StackedLineChart />;
      break;
    case 'CHART_BAR':
      iconType = <BarChart />;
      break;
    case 'CHART_BUBBLE':
      iconType = <BubbleChart />;
      break;
    case 'CHART_SCATTER':
      iconType = <ScatterPlot />;
      break;
    case 'CHART_PIE':
      iconType = <PieChart />;
      break;
    case 'CHART_DONUT':
      iconType = <DonutChart />;
      break;
    default:
      break;
  }

  return (
    <ListItem
      key={postItem.id}
      disablePadding
      sx={{
        borderBottom: tableBorder,
        '&:last-of-type': { borderBottom: 0 },
        height: '56px',
        paddingRight: 0,
      }}
      component={RouterLink}
      to={`${postItem.id}`}
      state={{ from: pathname }}
    >
      {postItem.type ? <ListItemIcon>{iconType}</ListItemIcon> : ''}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ x: 0, paddingLeft: '20px', width: '100%' }}
      >
        <TitleSpan>{postItem.title}</TitleSpan>
        <Stack alignItems="center" direction="row" sx={{ paddingRight: '36px' }}>
          <SubTitleSpan>{dateData(postItem.updatedAt)}</SubTitleSpan>
          <span style={{ width: '56px' }}></span>
          <ModifyButton
            size="medium"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              navigate(`modify?id=${postItem.id}&title=${postItem.title}`, { state: { from: pathname } });
            }}
          />
          <span style={{ width: '36px' }}></span>
          <DeleteButton
            size="medium"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              handleDeleteSelect(postItem);
            }}
          />
        </Stack>
      </Stack>
    </ListItem>
  );
}

export default BoardListItem;
