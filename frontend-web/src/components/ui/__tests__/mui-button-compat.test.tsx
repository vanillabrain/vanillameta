import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button, IconButton, LoadingButton } from '../mui-button-compat';

describe('MUI Button Compatibility Layer', () => {
  describe('Button Component', () => {
    it('renders button with text', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('applies correct variant classes', () => {
      const { rerender } = render(<Button variant="contained">Contained</Button>);
      expect(screen.getByText('Contained')).toHaveClass('bg-primary');
      expect(screen.getByText('Contained')).toHaveClass('text-primary-foreground');

      rerender(<Button variant="outlined">Outlined</Button>);
      expect(screen.getByText('Outlined')).toHaveClass('border');
      expect(screen.getByText('Outlined')).toHaveClass('border-input');

      rerender(<Button variant="text">Text</Button>);
      expect(screen.getByText('Text')).toHaveClass('hover:bg-accent');

      rerender(<Button variant="text">Text</Button>);
      expect(screen.getByText('Text')).toHaveClass('hover:bg-accent');
    });

    it('applies correct size classes', () => {
      const { rerender } = render(<Button size="small">Small</Button>);
      expect(screen.getByText('Small')).toHaveClass('h-8');
      expect(screen.getByText('Small')).toHaveClass('px-3');

      rerender(<Button size="medium">Medium</Button>);
      expect(screen.getByText('Medium')).toHaveClass('h-9');
      expect(screen.getByText('Medium')).toHaveClass('px-4');

      rerender(<Button size="large">Large</Button>);
      expect(screen.getByText('Large')).toHaveClass('h-10');
      expect(screen.getByText('Large')).toHaveClass('px-8');
    });

    it('applies correct color classes', () => {
      const { rerender } = render(<Button color="primary">Primary</Button>);
      expect(screen.getByText('Primary')).toBeInTheDocument();

      rerender(<Button color="error" variant="contained">Error</Button>);
      expect(screen.getByText('Error')).toHaveClass('bg-red-600');

      rerender(<Button color="success" variant="contained">Success</Button>);
      expect(screen.getByText('Success')).toHaveClass('bg-green-600');
    });

    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      fireEvent.click(screen.getByText('Click me'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('disables button when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByText('Disabled')).toBeDisabled();
    });

    it('applies fullWidth class when fullWidth prop is true', () => {
      render(<Button fullWidth>Full Width</Button>);
      expect(screen.getByText('Full Width')).toHaveClass('w-full');
    });

    it('renders with startIcon', () => {
      const Icon = () => <span data-testid="start-icon">→</span>;
      render(<Button startIcon={<Icon />}>With Icon</Button>);
      
      expect(screen.getByTestId('start-icon')).toBeInTheDocument();
      expect(screen.getByText('With Icon')).toBeInTheDocument();
    });

    it('renders with endIcon', () => {
      const Icon = () => <span data-testid="end-icon">←</span>;
      render(<Button endIcon={<Icon />}>With Icon</Button>);
      
      expect(screen.getByTestId('end-icon')).toBeInTheDocument();
      expect(screen.getByText('With Icon')).toBeInTheDocument();
    });

    it('renders as a link when href is provided', () => {
      render(<Button href="https://example.com">Link Button</Button>);
      const link = screen.getByText('Link Button').closest('a');
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('uses custom component when provided', () => {
      const CustomComponent = React.forwardRef<HTMLDivElement, any>((props, ref) => (
        <div ref={ref} data-testid="custom-component" {...props} />
      ));
      
      render(<Button component={CustomComponent}>Custom</Button>);
      expect(screen.getByTestId('custom-component')).toBeInTheDocument();
    });
  });

  describe('IconButton Component', () => {
    it('renders icon button with child content', () => {
      render(
        <IconButton aria-label="delete">
          <span data-testid="icon">🗑️</span>
        </IconButton>
      );
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('applies correct size classes for icon button', () => {
      const { rerender } = render(
        <IconButton size="small">
          <span>S</span>
        </IconButton>
      );
      expect(screen.getByRole('button')).toHaveClass('h-8');
      expect(screen.getByRole('button')).toHaveClass('w-8');

      rerender(
        <IconButton size="medium">
          <span>M</span>
        </IconButton>
      );
      expect(screen.getByRole('button')).toHaveClass('h-9');
      expect(screen.getByRole('button')).toHaveClass('w-9');

      rerender(
        <IconButton size="large">
          <span>L</span>
        </IconButton>
      );
      expect(screen.getByRole('button')).toHaveClass('h-10');
      expect(screen.getByRole('button')).toHaveClass('w-10');
    });

    it('applies edge positioning classes', () => {
      const { rerender } = render(<IconButton edge="start">S</IconButton>);
      expect(screen.getByRole('button')).toHaveClass('-ml-2');

      rerender(<IconButton edge="end">E</IconButton>);
      expect(screen.getByRole('button')).toHaveClass('-mr-2');
    });

    it('handles click events for icon button', () => {
      const handleClick = jest.fn();
      render(
        <IconButton onClick={handleClick}>
          <span>Click</span>
        </IconButton>
      );
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('LoadingButton Component', () => {
    it('renders loading button with text', () => {
      render(<LoadingButton>Save</LoadingButton>);
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(<LoadingButton loading>Saving...</LoadingButton>);
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('uses custom loadingIndicator', () => {
      render(
        <LoadingButton
          loading
          loadingIndicator={<span data-testid="custom-loader">Loading...</span>}
        >
          Save
        </LoadingButton>
      );
      expect(screen.getByTestId('custom-loader')).toBeInTheDocument();
    });

    it('shows text with loadingPosition="start"', () => {
      render(
        <LoadingButton loading loadingPosition="start">
          Save
        </LoadingButton>
      );
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('shows text with loadingPosition="end"', () => {
      render(
        <LoadingButton loading loadingPosition="end">
          Save
        </LoadingButton>
      );
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('hides text with loadingPosition="center"', () => {
      render(
        <LoadingButton loading loadingPosition="center">
          Save
        </LoadingButton>
      );
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });

    it('is disabled when loading', () => {
      render(<LoadingButton loading>Save</LoadingButton>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('handles click events when not loading', () => {
      const handleClick = jest.fn();
      render(
        <LoadingButton onClick={handleClick} loading={false}>
          Save
        </LoadingButton>
      );
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not handle click events when loading', () => {
      const handleClick = jest.fn();
      render(
        <LoadingButton onClick={handleClick} loading>
          Save
        </LoadingButton>
      );
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('supports aria-label', () => {
      render(<Button aria-label="Save document">Save</Button>);
      expect(screen.getByLabelText('Save document')).toBeInTheDocument();
    });

    it('supports aria-describedby', () => {
      render(
        <>
          <Button aria-describedby="help-text">Save</Button>
          <span id="help-text">This will save your changes</span>
        </>
      );
      expect(screen.getByText('Save')).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('maintains focus behavior', () => {
      render(<Button>Focusable</Button>);
      const button = screen.getByText('Focusable');
      
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });
});