import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/notice';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
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

export const stripColorHash = value => String(value ?? '').replace(/^#/, '');
const isValidHexText = value => /^#?(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(String(value ?? ''));
const toHexColor = value => '#' + stripColorHash(value);

/** Native color inputs only accept 6-digit values, so three digit colors expand first. */
const toNativeColorValue = value => {
  const raw = stripColorHash(value).toLowerCase();
  if (/^[a-f\d]{3}$/.test(raw)) {
    return (
      '#' +
      raw
        .split('')
        .map(character => character + character)
        .join('')
    );
  }
  if (/^[a-f\d]{6}$/.test(raw)) {
    return '#' + raw;
  }
  return '#000000';
};

const CHANNEL_KEYS = ['r', 'g', 'b'] as const;

const channelsOf = value => {
  const hex = toNativeColorValue(value);
  return {
    r: String(parseInt(hex.slice(1, 3), 16)),
    g: String(parseInt(hex.slice(3, 5), 16)),
    b: String(parseInt(hex.slice(5, 7), 16)),
  };
};

const isValidChannel = value => /^\d{1,3}$/.test(String(value)) && Number(value) <= 255;

const channelsToHex = channels =>
  '#' + CHANNEL_KEYS.map(channel => Number(channels[channel]).toString(16).padStart(2, '0')).join('');

const ColorPickerForm = props => {
  const { t } = useTranslation();
  const { name, color, onChange, label = t('common.colorPicker'), className } = props;
  const popoverId = useId();

  const [open, setOpen] = useState(false);
  const [draftColor, setDraftColor] = useState(color);
  const [hexText, setHexText] = useState(stripColorHash(color));
  const [channels, setChannels] = useState(() => channelsOf(color));
  const [hexValid, setHexValid] = useState(true);
  const [channelsValid, setChannelsValid] = useState(true);
  const validInput = hexValid && channelsValid;

  const syncColor = next => {
    setDraftColor(next);
    setHexText(stripColorHash(next));
    setChannels(channelsOf(next));
    setHexValid(true);
    setChannelsValid(true);
  };

  const handleOpenChange = next => {
    if (next) {
      syncColor(color);
    }
    setOpen(next);
  };

  const handleHexChange = event => {
    const raw = event.target.value;
    setHexText(raw);
    const valid = isValidHexText(raw);
    setHexValid(valid);
    if (valid) {
      const next = toHexColor(raw);
      setDraftColor(next);
      setChannels(channelsOf(next));
    }
  };

  const handleChannelChange = (channel, event) => {
    const raw = event.target.value;
    const next = { ...channels, [channel]: raw };
    setChannels(next);
    const valid = CHANNEL_KEYS.every(key => isValidChannel(next[key]));
    setChannelsValid(valid);
    if (valid) {
      const nextHex = channelsToHex(next);
      setDraftColor(nextHex);
      setHexText(stripColorHash(nextHex));
    }
  };

  const handleApply = () => {
    if (!validInput) {
      return;
    }
    setOpen(false);
    onChange({ target: { name: name, value: draftColor } });
  };

  return (
    <div className={cn('flex flex-col items-end justify-center', className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? popoverId : undefined}
            className="h-auto w-auto p-1"
          >
            <PaintButton color={color} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          id={popoverId}
          role="dialog"
          aria-modal="true"
          aria-label={t('common.colorPicker')}
          aria-describedby={popoverId + '-help'}
          className="w-[248px] max-w-[calc(100vw-32px)] gap-2 p-3"
        >
          <p id={popoverId + '-help'} className="text-xs text-muted-foreground">
            {t('common.colorPickerHelp')}
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              aria-label={t('common.colorPicker')}
              value={toNativeColorValue(draftColor)}
              onChange={event => syncColor(event.target.value)}
              className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
            />
            <Input
              aria-label="hex"
              aria-invalid={!hexValid || undefined}
              value={hexText}
              onChange={handleHexChange}
              className="h-8 min-w-0 flex-1 font-mono text-xs"
            />
          </div>
          <div role="group" aria-label={t('common.colorValue')} className="flex items-center gap-2">
            {CHANNEL_KEYS.map(channel => (
              <Input
                key={channel}
                aria-label={channel}
                aria-invalid={isValidChannel(channels[channel]) ? undefined : true}
                value={channels[channel]}
                onChange={event => handleChannelChange(channel, event)}
                inputMode="numeric"
                className="h-8 min-w-0 flex-1 px-2 font-mono text-xs"
              />
            ))}
          </div>
          <div role="group" aria-label={t('common.presetColors')} className="grid grid-cols-5 gap-1.5">
            {PRESET_COLORS.map(preset => {
              const selectedPreset = String(draftColor).toLowerCase() === preset.toLowerCase();
              return (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  aria-label={preset}
                  aria-pressed={selectedPreset}
                  onClick={() => syncColor(preset)}
                  className={cn('h-8 w-full rounded-md border border-[#858585] p-0', selectedPreset && 'ring-2 ring-ring')}
                  style={{ backgroundColor: preset }}
                />
              );
            })}
          </div>
          {!validInput && <Notice severity="error">{t('common.invalidColor')}</Notice>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleApply} disabled={!validInput}>
              {t('common.apply')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ColorPickerForm;
