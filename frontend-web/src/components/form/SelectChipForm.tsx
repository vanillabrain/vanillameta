import React from 'react';
import {
  Box,
  Chip,
  FormControl,
  FormLabel,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Theme,
  useTheme,
} from '@mui/material';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

function getStyles(name: string, personName: readonly string[], theme: Theme) {
  return {
    fontWeight: personName.indexOf(name) === -1 ? theme.typography.fontWeightRegular : theme.typography.fontWeightMedium,
  };
}

function SelectChipForm(props) {
  const theme = useTheme();
  const [personName, setPersonName] = React.useState<string[]>([]);

  const handleChange = (event: SelectChangeEvent<typeof personName>) => {
    const {
      target: { value },
    } = event;
    setPersonName(
      // On autofill we get a stringified value.
      typeof value === 'string' ? value.split(',') : value,
    );
  };

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      {props.label && (
        <FormLabel htmlFor="userInputSelect" sx={{ width: '40%' }}>
          {props.label}
        </FormLabel>
      )}
      <Select
        multiple
        id="userInputSelect"
        // value={props.value || ''}
        // onChange={props.onChange || undefined}
        value={personName}
        onChange={handleChange}
        size="small"
        sx={{ width: '60%' }}
        renderValue={selected => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map(value => (
              <Chip key={value} label={value} />
            ))}
          </Box>
        )}
        MenuProps={MenuProps}
      >
        {props.option.map(item => (
          <MenuItem key={item} value={item}>
            {item}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default SelectChipForm;
