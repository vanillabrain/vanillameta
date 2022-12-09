import React from 'react';
import { Avatar, ListItem, ListItemIcon, Stack } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { styled } from '@mui/system';
import { dateData } from '@/utils/util';

const tableBorder = '1px solid #DADDDD';

function BoardListItem(props) {
  const { postItem, handleDeleteSelect } = props;

  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

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
            mr: '-2px',
          }}
        >
          <Avatar
            src={`static/images/${postItem.icon}`}
            sx={{ width: 'auto', height: '30px', borderRadius: 0, objectFit: 'contain', backgroundColor: 'transparent' }}
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
          <span style={{ width: '56px' }} />
          <ModifyButton
            size="medium"
            sx={{ padding: 0 }}
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              navigate(`modify?id=${postItem.id}&title=${postItem.title}`, { state: { from: pathname } });
            }}
          />
          <span style={{ width: '36px' }} />
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
