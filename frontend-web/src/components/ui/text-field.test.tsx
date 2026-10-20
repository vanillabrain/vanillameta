import React, { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TextField } from './text-field';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('associates unique labels and error help with the native controls', () => {
  render(
    <>
      <TextField label="Calculation" defaultValue="SUM(amount)" error helperText="Invalid expression" />
      <TextField label="Name" />
    </>,
  );
  const calculation = screen.getByRole('textbox', { name: 'Calculation' });
  expect(calculation.id).not.toBe(screen.getByRole('textbox', { name: 'Name' }).id);
  expect(calculation.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(calculation.getAttribute('aria-describedby')).textContent).toBe('Invalid expression');
});
it('preserves input names, explicit accessibility labels and native change events', () => {
  const change = vi.fn();
  render(
    <TextField
      name="label"
      label="Name"
      inputProps={{ 'aria-label': 'Metric name' }}
      defaultValue="Old"
      onChange={event => change({ name: event.target.name, value: event.target.value })}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Metric name' }), { target: { value: 'Revenue' } });
  expect(change).toHaveBeenCalledWith({ name: 'label', value: 'Revenue' });
});
it('preserves native select and multiline change contracts', () => {
  const selectChange = vi.fn();
  const textChange = vi.fn();
  render(
    <>
      <TextField select label="Measure" defaultValue="count" onChange={event => selectChange(event.target.value)}>
        <option value="count">Count</option>
        <option value="sum">Sum</option>
      </TextField>
      <TextField multiline label="Question" onChange={event => textChange(event.target.value)} />
    </>,
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Measure' }), { target: { value: 'sum' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Question' }), { target: { value: 'Revenue by day' } });
  expect(selectChange).toHaveBeenCalledWith('sum');
  expect(textChange).toHaveBeenCalledWith('Revenue by day');
});
it('forwards React18 focus refs and opens a real Radix dialog through the shared button', () => {
  const errors = vi.spyOn(console, 'error');
  const ref = createRef<HTMLInputElement>();
  render(
    <>
      <TextField ref={ref} label="Title" />
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open editor</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Edit dashboard</DialogTitle>
          <DialogDescription>Change saved metadata.</DialogDescription>
        </DialogContent>
      </Dialog>
    </>,
  );
  ref.current.focus();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open editor' }));
  expect(screen.getByRole('dialog', { name: 'Edit dashboard' })).toBeTruthy();
  expect(errors.mock.calls.flat().join(' ')).not.toContain('Function components cannot be given refs');
});

it('does not accidentally submit surrounding forms for ordinary action buttons', () => {
  const submit = vi.fn(event => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <Button>Preview</Button>
      <Button type="submit">Save</Button>
    </form>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(submit).toHaveBeenCalledTimes(1);
});

it('forwards focus refs through multiline fields and native selects', () => {
  const errors = vi.spyOn(console, 'error');
  const ref = createRef<HTMLInputElement>();
  const { rerender } = render(<TextField multiline inputRef={ref} label="Prompt" />);
  ref.current.focus();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Prompt' }));
  rerender(
    <TextField select inputRef={ref} label="Measure">
      <option>Requests</option>
    </TextField>,
  );
  ref.current.focus();
  expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Measure' }));
  expect(errors.mock.calls.flat().join(' ')).not.toContain('Function components cannot be given refs');
});
