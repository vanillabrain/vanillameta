import React from 'react';
import { IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import {
  BarChart,
  PieChart,
  Dashboard,
  StackedLineChart,
  Delete,
  Edit,
  BubbleChart,
  ScatterPlot,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { DialogAlertIconButton } from './button/DialogAlertButton';
import DonutChart from '@/modules/piechart/DonutChart';

const tableBorder = '1px solid #DADDDD';

function BoardListItem(props) {
  const { postItem, message, handleDeleteSelect } = props;

  const dateData = data => {
    const userDate = new Date(data);
    const year = userDate.getFullYear();
    const month = userDate.getMonth() + 1;
    const date = userDate.getDate();
    return `${year}-${month >= 10 ? month : '0' + month}-${date >= 10 ? date : '0' + date}`;
  };

  let iconType;
  switch (postItem.type) {
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

  const handleDialogSelect = detail => {
    if (detail == 1) {
      if (handleDeleteSelect) {
        console.log('삭제를 눌러버렸어');
        handleDeleteSelect(postItem);
      }
    }
  };

  return (
    <ListItem
      key={postItem.id}
      secondaryAction={
        <React.Fragment>
          <IconButton size="large" component={RouterLink} to={`modify?id=${postItem.id}&title=${postItem.title}`}>
            <Edit />
          </IconButton>
          <DialogAlertIconButton
            icon={<Delete />}
            size="large"
            confirmLabel="삭제"
            cancelLabel="취소"
            handleDialogSelect={handleDialogSelect}
          >
            {message ? message : ``}
            {message ? <br /> : ``}
            {`'<${postItem.title}>'을(를) 삭제하시겠습니까?`}
          </DialogAlertIconButton>
        </React.Fragment>
      }
      disablePadding
      sx={{
        borderBottom: tableBorder,
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <ListItemButton sx={{ py: 0.8 }} component={RouterLink} to={`${postItem.id}`}>
        {postItem.type ? <ListItemIcon>{iconType}</ListItemIcon> : ''}
        <ListItemText
          primary={postItem.title}
          primaryTypographyProps={{ fontWeight: 500 }}
          secondary={dateData(postItem.createDate)}
          sx={{
            display: { xs: 'block', sm: 'flex' },
            justifyContent: 'space-between',
            ml: { xs: 0, sm: 2 },
            mr: 12,
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}

export default BoardListItem;
