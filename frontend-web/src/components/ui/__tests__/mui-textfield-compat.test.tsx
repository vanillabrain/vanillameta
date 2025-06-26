import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextField, OutlinedInput } from '../mui-textfield-compat';

describe('MUI TextField Compatibility Layer', () => {
  describe('TextField Component', () => {
    it('renders text input with label', () => {
      render(<TextField label="Username" />);
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });

    it('renders text input with placeholder', () => {
      render(<TextField placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with value and handles changes', () => {
      const handleChange = jest.fn();
      render(
        <TextField
          value="initial"
          onChange={handleChange}
          label="Test Input"
        />
      );
      
      const input = screen.getByLabelText('Test Input');
      expect(input).toHaveValue('initial');
      
      fireEvent.change(input, { target: { value: 'updated' } });
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ value: 'updated' })
        })
      );
    });

    it('applies correct variant styles', () => {
      const { rerender } = render(<TextField variant="outlined" label="Outlined" />);
      let input = screen.getByLabelText('Outlined');
      expect(input).toHaveClass('border-input');

      rerender(<TextField variant="filled" label="Filled" />);
      input = screen.getByLabelText('Filled');
      expect(input).toHaveClass('bg-muted', 'border-0', 'border-b');

      rerender(<TextField variant="standard" label="Standard" />);
      input = screen.getByLabelText('Standard');
      expect(input).toHaveClass('border-0', 'border-b', 'rounded-none');
    });

    it('applies correct size classes', () => {
      const { rerender } = render(<TextField size="small" label="Small" />);
      let input = screen.getByLabelText('Small');
      expect(input).toHaveClass('h-8', 'text-sm');

      rerender(<TextField size="medium" label="Medium" />);
      input = screen.getByLabelText('Medium');
      expect(input).toHaveClass('h-10');
    });

    it('shows error state', () => {
      render(<TextField error label="Error Field" helperText="This field has an error" />);
      const input = screen.getByLabelText('Error Field');
      expect(input).toHaveClass('border-red-500', 'focus:border-red-500');
      expect(screen.getByText('This field has an error')).toHaveClass('text-red-500');
    });

    it('disables input when disabled prop is true', () => {
      render(<TextField disabled label="Disabled Field" />);
      expect(screen.getByLabelText('Disabled Field')).toBeDisabled();
    });

    it('renders as textarea when multiline is true', () => {
      render(<TextField multiline label="Comments" rows={4} />);
      const textarea = screen.getByLabelText('Comments');
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea).toHaveAttribute('rows', '4');
    });

    it('renders with fullWidth', () => {
      render(<TextField fullWidth label="Full Width" />);
      const container = screen.getByLabelText('Full Width').parentElement;
      expect(container).toHaveClass('w-full');
    });

    it('renders required field', () => {
      render(<TextField required label="Required Field" />);
      const input = screen.getByLabelText('Required Field *');
      expect(input).toHaveAttribute('required');
    });

    it('supports different input types', () => {
      const { rerender } = render(<TextField type="email" label="Email" />);
      expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');

      rerender(<TextField type="password" label="Password" />);
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');

      rerender(<TextField type="number" label="Age" />);
      expect(screen.getByLabelText('Age')).toHaveAttribute('type', 'number');
    });

    it('renders helper text', () => {
      render(<TextField label="Field" helperText="This is helper text" />);
      expect(screen.getByText('This is helper text')).toBeInTheDocument();
      expect(screen.getByText('This is helper text')).toHaveClass('text-sm', 'text-muted-foreground');
    });

    it('handles InputProps', () => {
      render(
        <TextField
          label="With Icon"
          InputProps={{
            startAdornment: <span data-testid="start-icon">$</span>,
            endAdornment: <span data-testid="end-icon">.00</span>,
          }}
        />
      );
      
      expect(screen.getByTestId('start-icon')).toBeInTheDocument();
      expect(screen.getByTestId('end-icon')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<TextField className="custom-class" label="Custom" />);
      const container = screen.getByLabelText('Custom').closest('.custom-class');
      expect(container).toBeInTheDocument();
    });

    it('supports autoComplete attribute', () => {
      render(<TextField autoComplete="username" label="Username" />);
      expect(screen.getByLabelText('Username')).toHaveAttribute('autoComplete', 'username');
    });

    it('supports autoFocus', () => {
      render(<TextField autoFocus label="Auto Focus" />);
      expect(screen.getByLabelText('Auto Focus')).toHaveFocus();
    });

    it('handles onBlur event', () => {
      const handleBlur = jest.fn();
      render(<TextField onBlur={handleBlur} label="Blur Test" />);
      
      const input = screen.getByLabelText('Blur Test');
      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalled();
    });

    it('handles onFocus event', () => {
      const handleFocus = jest.fn();
      render(<TextField onFocus={handleFocus} label="Focus Test" />);
      
      const input = screen.getByLabelText('Focus Test');
      fireEvent.focus(input);
      expect(handleFocus).toHaveBeenCalled();
    });
  });

  describe('OutlinedInput Component', () => {
    it('renders outlined input', () => {
      render(<OutlinedInput placeholder="Outlined" />);
      expect(screen.getByPlaceholderText('Outlined')).toBeInTheDocument();
    });

    it('renders with value', () => {
      render(<OutlinedInput value="test value" readOnly />);
      expect(screen.getByDisplayValue('test value')).toBeInTheDocument();
    });

    it('handles change events', () => {
      const handleChange = jest.fn();
      render(<OutlinedInput onChange={handleChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new value' } });
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ value: 'new value' })
        })
      );
    });

    it('applies error styles', () => {
      render(<OutlinedInput error />);
      expect(screen.getByRole('textbox')).toHaveClass('border-red-500');
    });

    it('applies size classes', () => {
      const { rerender } = render(<OutlinedInput size="small" />);
      expect(screen.getByRole('textbox')).toHaveClass('h-8');

      rerender(<OutlinedInput size="medium" />);
      expect(screen.getByRole('textbox')).toHaveClass('h-10');
    });

    it('renders as textarea when multiline', () => {
      render(<OutlinedInput multiline rows={3} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea).toHaveAttribute('rows', '3');
    });

    it('supports fullWidth', () => {
      render(<OutlinedInput fullWidth />);
      expect(screen.getByRole('textbox')).toHaveClass('w-full');
    });

    it('handles disabled state', () => {
      render(<OutlinedInput disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('supports different input types', () => {
      render(<OutlinedInput type="password" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'password');
    });

    it('renders with adornments', () => {
      render(
        <OutlinedInput
          startAdornment={<span data-testid="start">@</span>}
          endAdornment={<span data-testid="end">.com</span>}
        />
      );
      
      expect(screen.getByTestId('start')).toBeInTheDocument();
      expect(screen.getByTestId('end')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('associates label with input using htmlFor', () => {
      render(<TextField id="test-field" label="Test Label" />);
      const label = screen.getByText('Test Label');
      expect(label).toHaveAttribute('for', 'test-field');
    });

    it('supports aria-label', () => {
      render(<TextField aria-label="Custom aria label" />);
      expect(screen.getByLabelText('Custom aria label')).toBeInTheDocument();
    });

    it('supports aria-describedby for helper text', () => {
      render(<TextField label="Field" helperText="Help text" />);
      const input = screen.getByLabelText('Field');
      const helperId = input.getAttribute('aria-describedby');
      expect(helperId).toBeTruthy();
      
      const helperText = document.getElementById(helperId!);
      expect(helperText).toHaveTextContent('Help text');
    });

    it('indicates required fields', () => {
      render(<TextField required label="Required" />);
      expect(screen.getByLabelText('Required *')).toHaveAttribute('required');
    });

    it('indicates error state with aria-invalid', () => {
      render(<TextField error label="Error Field" />);
      expect(screen.getByLabelText('Error Field')).toHaveAttribute('aria-invalid', 'true');
    });
  });
});