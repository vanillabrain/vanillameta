import React from 'react';
import { FormControl, FormLabel, Grid, List, ListItem, ListItemText, styled, TextField } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import WidgetTitleForm from '@/components/widget/WidgetTitleForm';
import ColorPickerForm from '@/components/form/ColorPickerForm';
import { AGGREGATION_LIST, COLUMN_TYPE } from '@/constant';

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
const fontSizeList = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 40, 50, 60, 70, 80, 85, 90, 95, 100];

const NumericBoardSetting = props => {
  const { option, setOption, spec } = props;

  const handleChange = event => {
    console.log('event', event);
    setOption({ ...option, [event.target.name]: event.target.value });
  };

  const handleHeaderChange = event => {
    console.log('event', event);
    const newHeaderOption = { ...option };
    option.header[event.target.name] = event.target.value;
    setOption({ ...option, newHeaderOption });
  };

  const handleContentChange = event => {
    console.log('event', event);
    const newHeaderOption = { ...option };
    option.content[event.target.name] = event.target.value;
    setOption({ ...option, newHeaderOption });
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <WidgetTitleForm value={option.title} onChange={handleChange} />
      <StyledList>
        <ListItem divider>
          <ListItemText primary="Header" />
          <FormControl
            required
            fullWidth
            sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <FormLabel sx={{ width: '35%', pr: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              value
            </FormLabel>
            <TextField
              type="none"
              required
              fullWidth
              name="title"
              value={option.header.title}
              onChange={handleHeaderChange}
            />
          </FormControl>
          <SelectForm
            name="fontSize"
            label="글자 크기"
            optionList={fontSizeList}
            value={option.header.fontSize}
            onChange={handleHeaderChange}
            endButton={<ColorPickerForm color={option.header.color} name="color" onChange={handleHeaderChange} />}
          />
        </ListItem>
        <ListItem divider>
          <ListItemText primary="Content" />
          <SelectForm
            required={true}
            id="field"
            name="field"
            label="필드"
            labelField="columnName"
            valueField="columnType"
            optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
            value={option.content.field}
            onChange={handleContentChange}
          />
          <SelectForm
            id="aggregation"
            name="aggregation"
            label="집계 방식"
            optionList={AGGREGATION_LIST}
            value={option.content.aggregation}
            onChange={handleContentChange}
            disabledDefaultValue
          />
          <SelectForm
            name="fontSize"
            label="글자 크기"
            optionList={fontSizeList}
            value={option.content.fontSize}
            onChange={handleContentChange}
            endButton={<ColorPickerForm color={option.content.color} name="color" onChange={handleContentChange} />}
          />
          <FormControl
            required
            fullWidth
            sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <FormLabel sx={{ width: '35%', pr: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Prefix
            </FormLabel>
            <TextField type="none" fullWidth name="prefix" value={option.content.prefix} onChange={handleContentChange} />
          </FormControl>
          <FormControl
            required
            fullWidth
            sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <FormLabel sx={{ width: '35%', pr: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Suffix
            </FormLabel>
            <TextField type="none" fullWidth name="suffix" value={option.content.suffix} onChange={handleContentChange} />
          </FormControl>
        </ListItem>
      </StyledList>
    </Grid>
  );
};

export default NumericBoardSetting;
