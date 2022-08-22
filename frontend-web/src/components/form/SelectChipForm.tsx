import React, { useEffect, useState } from 'react';
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
  Popover,
} from '@mui/material';
import { SketchPicker, SwatchesPicker } from 'react-color';
import PaletteIcon from '@mui/icons-material/Palette';

interface SelectChipForm {
  label: string;
  color: string;
  props: object;
}

function SelectChipForm(props) {
  const { label, color, option, ...rest } = props;
  const [chipColor, setChipColor] = useState('');
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (color) {
      setChipColor('#eee');
    }
  }, [color]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChangeComplete = color => {
    setChipColor(color.hex);
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const popoverId = open ? '색상 선택 팝업' : undefined;

  return (
    <FormControl fullWidth sx={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      {label && (
        <FormLabel htmlFor="userInputSelect" sx={{ width: '40%' }}>
          {label}
        </FormLabel>
      )}
      <Stack flexDirection="row" justifyContent="space-between" sx={{ width: '60%' }}>
        <Select
          multiple
          size="small"
          // sx={{ width: '60%', }}
          sx={{ height: 'auto', width: color ? 'calc(100% - 38px)' : '100%' }}
          renderValue={(selected: any) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {selected.map(item => (
                <Chip key={item} label={item} size="small" sx={{ px: 0.5, bgcolor: chipColor ? chipColor : '#eee' }} />
              ))}
            </Box>
            // <Chip
            //   label={option.map(item => item.value === selected && item.label)}
            //   size="small"
            //   sx={{ px: 0.5, bgcolor: chipColor ? chipColor : '#eee' }}
            // />
          )}
          {...rest}
        >
          {option.map(item => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </Select>
        {color && (
          <React.Fragment>
            <IconButton aria-label="색상 선택" onClick={handleClick}>
              <PaletteIcon />
            </IconButton>
            <Popover
              id={popoverId}
              open={open}
              anchorEl={anchorEl}
              onClose={handleClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
            >
              <SketchPicker color={chipColor} onChangeComplete={handleChangeComplete} />
            </Popover>
          </React.Fragment>
        )}
      </Stack>
    </FormControl>
  );
}

SelectChipForm.defaultProps = {
  label: 'label',
  option: [],
  color: undefined,
};

export default SelectChipForm;
