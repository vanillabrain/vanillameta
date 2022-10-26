import React from 'react';
import { Avatar, Box, ListItem, ListItemIcon, Stack } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { styled } from '@mui/system';
import { WIDGET_TYPE } from '@/constant';

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
    return `${year}.${month >= 10 ? month : '0' + month}.${date >= 10 ? date : '0' + date}`;
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

  const getIconType = type => {
    if (type) {
      return WIDGET_TYPE[type].icon;
    }
  };

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
      {postItem.componentType ? (
        <ListItemIcon
          sx={{
            minWidth: '24px',
            ml: '20px',
            mr: '4px',
          }}
        >
          <Avatar
            alt={postItem.componentType}
            src={`static/images/${getIconType(postItem.componentType)}`}
            sx={{ width: 'auto', height: '24px', borderRadius: 0, objectFit: 'contain', backgroundColor: 'transparent' }}
          />
        </ListItemIcon>
      ) : (
        ''
      )}
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
            sx={{ padding: 0 }}
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              navigate(`modify?id=${postItem.id}&title=${postItem.title}`, { state: { from: pathname } });
            }}
          />
          <span style={{ width: '36px' }}></span>
          <DeleteButton
            size="medium"
            sx={{ padding: 0 }}
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
