import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AddButton, RemoveButton } from './AddIconButton';
import { handleRemoveClick } from '@/widget/utils/handler';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

it('names icon actions and preserves caller-specific names', () => {
  render(
    <>
      <AddButton />
      <RemoveButton />
      <AddButton aria-label="Add series" />
    </>,
  );
  expect(screen.getByRole('button', { name: 'common.addItem' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'common.removeItem' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add series' })).toBeTruthy();
});

it.each(['series', 'columns'])('returns focus to add after removing the final %s item', prop => {
  function Settings() {
    const [option, setOption] = useState({ [prop]: [{ name: 'keep' }, { name: 'remove' }] });
    return (
      <ul>
        <li>
          <AddButton aria-label="Add item" />
          {option[prop].map((item, index) => (
            <div key={index}>
              {item.name}
              {index > 0 && (
                <RemoveButton
                  aria-label="Remove item"
                  onClick={event => handleRemoveClick(event, index, option, setOption, prop)}
                />
              )}
            </div>
          ))}
        </li>
      </ul>
    );
  }
  render(<Settings />);
  const remove = screen.getByRole('button', { name: 'Remove item' });
  remove.focus();
  fireEvent.click(remove);
  expect(screen.queryByRole('button', { name: 'Remove item' })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add item' }));
  expect(screen.getByText('keep')).toBeTruthy();
});
