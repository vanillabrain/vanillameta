import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SelectForm from './SelectForm';
import TextFieldForm from './TextFieldForm';
import RadioForm from './RadioForm';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

it('names repeated select controls with distinct label associations', () => {
  render(
    <>
      <SelectForm label="Header size" value={20} optionList={[20]} />
      <SelectForm label="Value size" value={50} optionList={[50]} />
    </>,
  );
  const controls = [/^Header size/, /^Value size/].map(name => screen.getByRole('combobox', { name }));
  expect(controls[0].id).not.toBe(controls[1].id);
  expect(controls[0].getAttribute('aria-labelledby')).not.toBe(controls[1].getAttribute('aria-labelledby'));
});

it('keeps caller ids and explicit accessible names on select controls', () => {
  render(
    <SelectForm
      id="field-choice"
      label="Field"
      inputProps={{ 'aria-label': 'Numeric field' }}
      value="amount"
      optionList={['amount']}
    />,
  );
  const control = screen.getByRole('combobox', { name: 'Numeric field' });
  expect(control.id).toBe('field-choice');
  expect(screen.getByText('Field').getAttribute('for')).toBe('field-choice');
});

it('labels text inputs without caller ids and preserves explicit ids', () => {
  render(
    <>
      <TextFieldForm label="Prefix" value="" onChange={vi.fn()} />
      <TextFieldForm label="Suffix" value="" onChange={vi.fn()} />
      <TextFieldForm id="message" label="Message" value="" onChange={vi.fn()} />
    </>,
  );
  const prefix = screen.getByRole('textbox', { name: 'Prefix' });
  const suffix = screen.getByRole('textbox', { name: 'Suffix' });
  expect(prefix.id).not.toBe(suffix.id);
  expect(screen.getByRole('textbox', { name: 'Message' }).id).toBe('message');
});

it('names repeated radio groups without duplicate ids and keeps boolean choices', () => {
  const onChange = vi.fn();
  render(
    <>
      <RadioForm
        label="First merge"
        option={[
          { label: 'Merge', value: true },
          { label: 'Split', value: false },
        ]}
        value={true}
        onChange={onChange}
      />
      <RadioForm
        label="Second merge"
        option={[
          { label: 'Merge', value: true },
          { label: 'Split', value: false },
        ]}
        value={false}
        onChange={onChange}
      />
    </>,
  );
  const groups = ['First merge', 'Second merge'].map(name => screen.getByRole('radiogroup', { name }));
  expect(groups[0].getAttribute('aria-labelledby')).not.toBe(groups[1].getAttribute('aria-labelledby'));
  expect(within(groups[0]).getByRole('radio', { name: 'Merge' }).getAttribute('aria-checked')).toBe('true');
  expect(within(groups[1]).getByRole('radio', { name: 'Split' }).getAttribute('aria-checked')).toBe('true');
  const ids = Array.from(document.querySelectorAll('[id]')).map(element => element.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it('hands the original option value back when a radio choice changes', () => {
  const onChange = vi.fn();
  render(
    <RadioForm
      label="Merge"
      option={[
        { label: 'Merge', value: true },
        { label: 'Split', value: false },
      ]}
      value={true}
      name="rowSpan1"
      onChange={onChange}
    />,
  );
  const { getByRole } = within(screen.getByRole('radiogroup', { name: 'Merge' }));
  getByRole('radio', { name: 'Split' }).click();
  expect(onChange.mock.calls[0][0].target).toMatchObject({ name: 'rowSpan1', value: false });
});
