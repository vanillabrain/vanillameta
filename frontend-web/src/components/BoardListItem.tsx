import React from 'react';
import { Avatar, Hidden, ListItem, ListItemIcon, Stack, useMediaQuery, useTheme } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { styled } from '@mui/system';
import { dateData } from '@/utils/util';

const tableBorder = '1px solid #DADDDD';

function BoardListItem(props) {
  const { postItem, handleDeleteSelect } = props;
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));

  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const MobileTitleSpan = styled('span')({
    display: 'block',
    width: 'calc(100vw - 150px)',
    fontFamily: 'Pretendard',
    fontSize: '14px',
    fontWeight: '600',
    fontStretch: 'normal',
    fontStyle: 'normal',
    lineHeight: '1.43',
    letterSpacing: 'normal',
    textAlign: 'left',
    color: '#333333',
  });

  const TitleSpan = styled('span')({
    display: 'block',
    width: 'calc(100vw - 430px)',
    height: '14px',
    fontFamily: 'Pretendard',
    fontSize: '14px',
    fontWeight: '600',
    fontStretch: 'normal',
    fontStyle: 'normal',
    lineHeight: '1.14',
    letterSpacing: 'normal',
    textAlign: 'left',
    color: '#333333',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  });

  const SubTitleSpan = styled('span')({
    display: 'flex',
    height: '14px',
    justifyContent: 'space-between',
    fontFamily: 'Pretendard',
    fontSize: matches ? '14px' : '10px',
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
        py: matches ? '13px' : '20px',
        paddingRight: 0,
      }}
      component={RouterLink}
      to={`${postItem.id}`}
      state={{ from: pathname }}
    >
      {matches && postItem.componentType ? (
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
        sx={{ x: 0, paddingLeft: { xs: '16px', sm: '20px' }, width: '100%' }}
      >
        {matches ? <TitleSpan>{postItem.title}</TitleSpan> : <MobileTitleSpan>{postItem.title}</MobileTitleSpan>}
        <Stack alignItems="center" direction="row" sx={{ paddingRight: matches ? '36px' : '16px' }}>
          <SubTitleSpan>{dateData(postItem.updatedAt)}</SubTitleSpan>
          <Hidden smDown>
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
          </Hidden>
        </Stack>
      </Stack>
    </ListItem>
  );
}

export default BoardListItem;
