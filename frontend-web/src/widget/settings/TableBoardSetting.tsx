import React from 'react';
import { Divider, FormControl, FormLabel, Grid, List, ListItem, ListItemText, styled, TextField } from '@mui/material';
import SelectForm from '@/components/form/SelectForm';
import { ALIGN_LIST, COLUMN_TYPE, TABLE_ALIGN } from '@/constant';
import { AddButton, RemoveButton } from '@/components/button/AddIconButton';
import { handleAddClick, handleRemoveClick, handleSeriesChange } from '@/widget/utils/handler';

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

const TableBoardSetting = props => {
  const { option, setOption, spec } = props;

  const defaultSeries = {
    name: '',
    header: '',
    align: TABLE_ALIGN.LEFT,
    sortable: true,
  };

  return (
    <Grid item xs={10} md={4} lg={3} sx={{ display: 'flex', flexDirection: 'column' }}>
      <StyledList>
        <ListItem divider>
          <ListItemText primary="Columns" />
          <AddButton
            onClick={event => handleAddClick(event, option, setOption, defaultSeries, 'columns')}
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
                labelField="columnName"
                valueField="columnType"
                optionList={spec.filter(item => item.columnType === COLUMN_TYPE.NUMBER).map(item => item.columnName)}
                value={item.name}
                onChange={event => handleSeriesChange(event, setOption, 'columns')}
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
                  onChange={event => handleSeriesChange(event, setOption, 'columns')}
                />
              </FormControl>
              <SelectForm
                id={`align${index + 1}`}
                name={`align${index + 1}`}
                label="Align"
                optionList={ALIGN_LIST}
                value={item.align}
                onChange={event => handleSeriesChange(event, setOption, 'columns')}
                endButton={
                  0 < index ? (
                    <RemoveButton
                      onClick={event => handleRemoveClick(event, index, option, setOption, 'columns')}
                      id={index}
                    />
                  ) : (
                    ' '
                  )
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
