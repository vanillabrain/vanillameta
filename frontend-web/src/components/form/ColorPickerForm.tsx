import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, ButtonBase, FormControl, IconButton, Popover, Stack, Typography } from '@mui/material';
import { SketchPicker } from 'react-color';
import PaintButton from '@/components/button/PaintButton';

const PRESET_COLORS = [
  '#D0021B',
  '#F5A623',
  '#F8E71C',
  '#8B572A',
  '#7ED321',
  '#417505',
  '#BD10E0',
  '#9013FE',
  '#4A90E2',
  '#50E3C2',
  '#B8E986',
  '#000000',
  '#4A4A4A',
  '#9B9B9B',
  '#FFFFFF',
];

const ColorPickerForm = props => {
  const { t } = useTranslation();
  const { name, color, onChange } = props;
  const popoverId = useId();

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [draftColor, setDraftColor] = useState(color);
  const [validInput, setValidInput] = useState(true);
  const [pickerRevision, setPickerRevision] = useState(0);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setDraftColor(color);
    setValidInput(true);
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleApply = () => {
    if (!validInput) return;
    setAnchorEl(null);
    const event = { target: { name: name, value: draftColor } };
    onChange(event);
  };

  const open = Boolean(anchorEl);

  return (
    <FormControl sx={{ alignItems: 'flex-end', justifyContent: 'center' }}>
      <IconButton
        aria-label={t('common.colorPicker')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={handleClick}
      >
        <PaintButton color={color} />
      </IconButton>
      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        PaperProps={{
          role: 'dialog',
          'aria-label': t('common.colorPicker'),
          'aria-modal': true,
          'aria-describedby': `${popoverId}-help`,
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 1.5, width: 248, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box' }}>
          <Typography id={`${popoverId}-help`} variant="caption" display="block" mb={1}>
            {t('common.colorPickerHelp')}
          </Typography>
          <Box
            onChangeCapture={event => {
              // react-color retains raw text while reporting only valid color changes.
              const inputs = event.currentTarget.querySelectorAll('input');
              setValidInput(
                Array.from(inputs).every(input =>
                  input.labels?.[0]?.textContent?.toLowerCase() === 'hex'
                    ? /^#?(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(input.value)
                    : /^\d{1,3}$/.test(input.value) && Number(input.value) <= 255,
                ),
              );
            }}
          >
            <SketchPicker
              key={pickerRevision}
              color={draftColor}
              onChange={selection => setDraftColor(selection.hex)}
              disableAlpha
              presetColors={[]}
              width="100%"
              styles={{ default: { picker: { boxShadow: 'none', padding: 0 } } }}
            />
          </Box>
          <Box
            role="group"
            aria-label={t('common.presetColors')}
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.75, mt: 1 }}
          >
            {PRESET_COLORS.map(preset => (
              <ButtonBase
                key={preset}
                aria-label={preset}
                aria-pressed={String(draftColor).toLowerCase() === preset.toLowerCase()}
                onClick={() => {
                  setDraftColor(preset);
                  setValidInput(true);
                  setPickerRevision(value => value + 1);
                }}
                sx={{
                  height: 32,
                  borderRadius: 1,
                  bgcolor: preset,
                  border: '1px solid #858585',
                  boxShadow: String(draftColor).toLowerCase() === preset.toLowerCase() ? '0 0 0 2px #17324d' : 'none',
                }}
              />
            ))}
          </Box>
          {!validInput && (
            <Typography role="alert" variant="caption" color="error.dark">
              {t('common.invalidColor')}
            </Typography>
          )}
          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={1.5}>
            <Button onClick={handleClose}>{t('common.cancel')}</Button>
            <Button variant="contained" onClick={handleApply} disabled={!validInput}>
              {t('common.apply')}
            </Button>
          </Stack>
        </Box>
      </Popover>
    </FormControl>
  );
};

export default ColorPickerForm;
