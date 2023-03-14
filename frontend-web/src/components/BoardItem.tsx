import React from 'react';
import { Box, Hidden, ListItem, ListItemIcon, Stack, useMediaQuery, useTheme } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { styled } from '@mui/system';
import { dateData } from '@/utils/util';

interface BoardItemDataProps {
  id: string;
  title: string;
  updatedAt: string;
  componentType?: string;
  icon?: string;
}

interface BoardItemProps {
  data: BoardItemDataProps;
  handleDeleteSelect: (id, title) => void;
}

const tableBorder = '1px solid #DADDDD';

const MobileTitleSpan = styled('span')({
  display: 'block',
  flexGrow: 0,
  width: '100%',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1.43',
  color: '#333333',
});

const TitleSpan = styled('span')({
  display: 'block',
  flexGrow: 0,
  width: '100%',
  height: '14px',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1.14',
  color: '#333333',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

interface SubTitleSpanProps {
  children: React.ReactNode;
  matches?: boolean;
}

const SubTitleSpan = styled('span')<SubTitleSpanProps>(matches => ({
  display: 'flex',
  height: '14px',
  justifyContent: 'space-between',
  fontSize: matches ? '14px' : '10px',
  fontWeight: '500',
  lineHeight: '1.14',
  color: '#333333',
}));

const IconRowHeader = ({ icon }) => {
  return (
    <ListItemIcon
      sx={{
        minWidth: '24px',
        mr: '18px',
      }}
    >
      <Box
        component="img"
        src={`static/images/${icon}`}
        sx={{ width: 'auto', height: '30px', borderRadius: 0, objectFit: 'contain', backgroundColor: 'transparent' }}
      />
    </ListItemIcon>
  );
};

function BoardItem(props: BoardItemProps) {
  const { data, handleDeleteSelect } = props;
  const { id, title, componentType, icon, updatedAt } = data;

  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <ListItem
      disablePadding
      sx={{
        borderBottom: tableBorder,
        '&:last-of-type': { borderBottom: 0 },
        py: matches ? '13px' : '20px',
        paddingRight: 0,
      }}
      component={RouterLink}
      to={`${id}`}
      state={{ from: pathname }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ x: 0, paddingLeft: { xs: '16px', sm: '20px' }, width: '100%' }}
      >
        <Stack direction="row" alignItems="center" width="100%" sx={{ maxWidth: `calc(100% - ${matches ? 300 : 110}px)` }}>
          {matches && componentType && <IconRowHeader icon={icon} />}
          {matches ? <TitleSpan>{title}</TitleSpan> : <MobileTitleSpan>{title}</MobileTitleSpan>}
        </Stack>
        <Stack alignItems="center" direction="row" sx={{ paddingRight: matches ? '36px' : '16px' }}>
          <SubTitleSpan matches={matches}>{dateData(updatedAt)}</SubTitleSpan>
          <Hidden smDown>
            <Stack direction="row" gap="36px" ml="56px">
              <ModifyButton
                size="medium"
                sx={{ padding: 0 }}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  navigate(`modify?id=${id}&title=${title}`, { state: { from: pathname } });
                }}
              />
              <DeleteButton
                size="medium"
                sx={{ padding: 0 }}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleDeleteSelect(id, title);
                }}
              />
            </Stack>
          </Hidden>
        </Stack>
      </Stack>
    </ListItem>
  );
}

export default BoardItem;
