import React from 'react';
import {
  Divider,
  FormControl,
  FormLabel,
  Grid,
  IconButton,
  IconButtonProps,
  List,
  ListItem,
  ListItemText,
  styled,
  SvgIcon,
  TextField,
} from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import { ALIGN_LIST, TABLE_ALIGN } from '@/constant';

const StyledList = styled(List)({
  position: 'relative',
  display: 'flex',
  flexWrap: 'wrap',
  '& .MuiListItemText-root': {
    width: '100%',
    marginBottom: 10,
  },
  '& .MuiListItemText-primary': {
    mb: 1,
    textAlign: 'left',
    fontWeight: 500,
    fontSize: 14,
  },
  '& .MuiListItem-root': {
    display: 'flex',
    flexDirection: ' column',
    rowGap: 8,
    width: '100%',
    padding: '30px 0 30px',
  },
});
const DefaultIconButton = icon =>
  styled((props: IconButtonProps) => (
    <IconButton size="small" sx={{ width: '38px', height: '38px' }} {...props}>
      <SvgIcon fontSize="small">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
          {icon}
        </svg>
      </SvgIcon>
    </IconButton>
  ))({ flex: 'none' });

const AddIconButton = DefaultIconButton(
  <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />,
);

const RemoveIconButton = DefaultIconButton(
  <path d="M432 256c0 17.7-14.3 32-32 32L48 288c-17.7 0-32-14.3-32-32s14.3-32 32-32l352 0c17.7 0 32 14.3 32 32z" />,
);

const TableBoardSetting = props => {
  const { option, setOption, seriesItem, axisReverse } = props;

  // props로부터 받기 ------------------------------------
  const typeOption = { series: ['high', 'low', 'avg'], [!axisReverse ? 'xField' : 'yField']: ['name', 'color'] }; // series type
  // ----------------------------------------------------

  const handleChange = event => {
    console.log('event', event);
    setOption({ ...option, [event.target.name]: event.target.value });
  };

  const handleColumnChange = event => {
    const key = event.target.name.slice(0, -1);
    const index = Number(event.target.name.slice(-1)[0]) - 1;

    setOption(prevState => {
      const tempOption = { ...prevState };

      // onChange 일어난 요소 key와 index로 식별해서 value 주기
      tempOption.columns.forEach((item, idx) => {
        console.log('item', item);
        console.log('key: ', key, ', value: ', event.target.value);
        if (index === idx) {
          item[key] = event.target.value;
        }
      });
      return tempOption;
    });
  };

  const handleAddClick = () => {
    setOption(prevState => {
      const tempOption = { ...prevState };
      const newItem = {
        name: '',
        header: '',
        align: TABLE_ALIGN.LEFT,
        sortable: true,
      };
      tempOption.columns.push(newItem);
      return tempOption;
    });
  };

  const handleRemoveClick = (event, index) => {
    if (option.columns.length === 1) {
      return;
    }

    setOption(prevState => {
      const obj = { ...prevState };
      obj.columns.splice(index, 1);
      return obj;
    });
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <WidgetTitleForm value={option.title} onChange={handleChange} />
      <StyledList>
        <ListItem divider>
          <ListItemText primary="Columns" />
          <AddIconButton
            onClick={handleAddClick}
            sx={{
              position: 'absolute',
              top: 30,
              right: 0,
            }}
          />
          {option.columns.map((item, index) => (
            <React.Fragment key={index}>
              <SelectForm
                required={true}
                id={`name${index + 1}`}
                name={`name${index + 1}`}
                label={`필드 ${index + 1}`}
                optionList={typeOption.series}
                value={item.name}
                onChange={handleColumnChange}
              />
              <FormControl
                required
                fullWidth
                sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <FormLabel sx={{ width: '35%', pr: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Header
                </FormLabel>
                <TextField
                  type="none"
                  required
                  fullWidth
                  name={`header${index + 1}`}
                  value={item.header}
                  onChange={handleColumnChange}
                />
              </FormControl>
              <SelectForm
                id={`align${index + 1}`}
                name={`align${index + 1}`}
                label="Align"
                optionList={ALIGN_LIST}
                value={item.align}
                onChange={handleColumnChange}
                colorButton={
                  0 < index ? <RemoveIconButton onClick={event => handleRemoveClick(event, index)} id={index} /> : ' '
                }
              />
              <Divider />
            </React.Fragment>
          ))}
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default TableBoardSetting;
