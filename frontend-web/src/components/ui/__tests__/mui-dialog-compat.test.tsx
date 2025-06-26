import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  ButtonBase,
} from '../mui-dialog-compat';
import { Button } from '../mui-button-compat';

// Test component that manages dialog state
const TestDialog = ({ children, ...props }: any) => {
  const [open, setOpen] = useState(props.open || false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open Dialog</button>
      <Dialog {...props} open={open} onClose={() => setOpen(false)}>
        {children}
      </Dialog>
    </>
  );
};

describe('MUI Dialog Compatibility Layer', () => {
  describe('Dialog Component', () => {
    it('renders dialog when open', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogContent>
            <DialogContentText>Dialog content</DialogContentText>
          </DialogContent>
        </Dialog>
      );
      
      expect(screen.getByText('Dialog content')).toBeInTheDocument();
    });

    it('does not render dialog when closed', () => {
      render(
        <Dialog open={false} onClose={() => {}}>
          <DialogContent>
            <DialogContentText>Dialog content</DialogContentText>
          </DialogContent>
        </Dialog>
      );
      
      expect(screen.queryByText('Dialog content')).not.toBeInTheDocument();
    });

    it('calls onClose when backdrop is clicked', async () => {
      const handleClose = jest.fn();
      render(
        <Dialog open={true} onClose={handleClose}>
          <DialogContent>
            <DialogContentText>Dialog content</DialogContentText>
          </DialogContent>
        </Dialog>
      );
      
      // Click on the backdrop (overlay)
      const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
      if (backdrop) {
        fireEvent.click(backdrop);
        await waitFor(() => {
          expect(handleClose).toHaveBeenCalledWith({}, 'backdropClick');
        });
      }
    });

    it('calls onClose when escape key is pressed', async () => {
      const handleClose = jest.fn();
      render(
        <Dialog open={true} onClose={handleClose}>
          <DialogContent>
            <DialogContentText>Dialog content</DialogContentText>
          </DialogContent>
        </Dialog>
      );
      
      fireEvent.keyDown(document.body, { key: 'Escape' });
      
      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it('applies maxWidth classes', () => {
      const { rerender } = render(
        <Dialog open={true} onClose={() => {}} maxWidth="sm">
          <DialogContent>Small</DialogContent>
        </Dialog>
      );
      
      let content = document.querySelector('[data-slot="dialog-content"]');
      expect(content).toHaveClass('max-w-lg');

      rerender(
        <Dialog open={true} onClose={() => {}} maxWidth="md">
          <DialogContent>Medium</DialogContent>
        </Dialog>
      );
      
      content = document.querySelector('[data-slot="dialog-content"]');
      expect(content).toHaveClass('max-w-2xl');

      rerender(
        <Dialog open={true} onClose={() => {}} maxWidth="lg">
          <DialogContent>Large</DialogContent>
        </Dialog>
      );
      
      content = document.querySelector('[data-slot="dialog-content"]');
      expect(content).toHaveClass('max-w-4xl');
    });

    it('applies fullWidth class', () => {
      render(
        <Dialog open={true} onClose={() => {}} fullWidth>
          <DialogContent>Full width</DialogContent>
        </Dialog>
      );
      
      const content = document.querySelector('[data-slot="dialog-content"]');
      expect(content).toHaveClass('w-full');
    });

    it('supports aria attributes', () => {
      render(
        <Dialog
          open={true}
          onClose={() => {}}
          aria-labelledby="dialog-title"
          aria-describedby="dialog-description"
        >
          <DialogTitle id="dialog-title">Title</DialogTitle>
          <DialogContent>
            <DialogContentText id="dialog-description">
              Description
            </DialogContentText>
          </DialogContent>
        </Dialog>
      );
      
      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-description');
    });
  });

  describe('DialogTitle Component', () => {
    it('renders dialog title', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogTitle>Dialog Title</DialogTitle>
        </Dialog>
      );
      
      expect(screen.getByText('Dialog Title')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogTitle className="custom-title">Title</DialogTitle>
        </Dialog>
      );
      
      const header = document.querySelector('[data-slot="dialog-header"]');
      expect(header).toHaveClass('custom-title');
    });

    it('applies margin bottom from sx prop', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogTitle sx={{ mb: 2 }}>Title with margin</DialogTitle>
        </Dialog>
      );
      
      const title = screen.getByText('Title with margin');
      expect(title).toHaveClass('mb-8'); // mb-2 * 4 = mb-8
    });
  });

  describe('DialogContent Component', () => {
    it('renders dialog content', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogContent>
            <div>Content area</div>
          </DialogContent>
        </Dialog>
      );
      
      expect(screen.getByText('Content area')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogContent className="custom-content">
            Content
          </DialogContent>
        </Dialog>
      );
      
      const content = screen.getByText('Content').parentElement;
      expect(content).toHaveClass('custom-content');
    });
  });

  describe('DialogContentText Component', () => {
    it('renders dialog content text', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogContent>
            <DialogContentText>
              This is the dialog content text
            </DialogContentText>
          </DialogContent>
        </Dialog>
      );
      
      expect(screen.getByText('This is the dialog content text')).toBeInTheDocument();
    });

    it('applies muted text styles', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogContent>
            <DialogContentText>Muted text</DialogContentText>
          </DialogContent>
        </Dialog>
      );
      
      expect(screen.getByText('Muted text')).toHaveClass('text-sm', 'text-muted-foreground');
    });

    it('supports id attribute', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogContent>
            <DialogContentText id="dialog-desc">
              Description
            </DialogContentText>
          </DialogContent>
        </Dialog>
      );
      
      expect(screen.getByText('Description')).toHaveAttribute('id', 'dialog-desc');
    });
  });

  describe('DialogActions Component', () => {
    it('renders dialog actions', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogActions>
            <Button>Cancel</Button>
            <Button>OK</Button>
          </DialogActions>
        </Dialog>
      );
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('OK')).toBeInTheDocument();
    });

    it('applies correct layout styles', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogActions>
            <Button>Action</Button>
          </DialogActions>
        </Dialog>
      );
      
      const footer = document.querySelector('[data-slot="dialog-footer"]');
      expect(footer).toHaveClass('px-6', 'pb-6', 'pt-4');
    });

    it('applies spacing when disableSpacing is false', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogActions disableSpacing={false}>
            <Button>Action</Button>
          </DialogActions>
        </Dialog>
      );
      
      const footer = document.querySelector('[data-slot="dialog-footer"]');
      expect(footer).toHaveClass('gap-2');
    });

    it('removes spacing when disableSpacing is true', () => {
      render(
        <Dialog open={true} onClose={() => {}}>
          <DialogActions disableSpacing={true}>
            <Button>Action</Button>
          </DialogActions>
        </Dialog>
      );
      
      const footer = document.querySelector('[data-slot="dialog-footer"]');
      expect(footer).not.toHaveClass('gap-2');
    });
  });

  describe('ButtonBase Component', () => {
    it('renders button base', () => {
      render(<ButtonBase>Click me</ButtonBase>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<ButtonBase onClick={handleClick}>Click me</ButtonBase>);
      
      fireEvent.click(screen.getByText('Click me'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('can be disabled', () => {
      render(<ButtonBase disabled>Disabled</ButtonBase>);
      expect(screen.getByText('Disabled')).toBeDisabled();
    });

    it('applies custom className', () => {
      render(<ButtonBase className="custom-button">Custom</ButtonBase>);
      expect(screen.getByText('Custom')).toHaveClass('custom-button');
    });

    it('supports type attribute', () => {
      render(<ButtonBase type="submit">Submit</ButtonBase>);
      expect(screen.getByText('Submit')).toHaveAttribute('type', 'submit');
    });
  });

  describe('Integration', () => {
    it('works with complete dialog structure', () => {
      const handleClose = jest.fn();
      const handleConfirm = jest.fn();
      
      render(
        <Dialog open={true} onClose={handleClose}>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to proceed with this action?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleConfirm} variant="contained">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      );
      
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed with this action?')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Cancel'));
      expect(handleClose).toHaveBeenCalled();
      
      fireEvent.click(screen.getByText('Confirm'));
      expect(handleConfirm).toHaveBeenCalled();
    });

    it('manages dialog state correctly', async () => {
      render(
        <TestDialog>
          <DialogTitle>Test Dialog</DialogTitle>
          <DialogContent>
            <DialogContentText>Dialog is open</DialogContentText>
          </DialogContent>
        </TestDialog>
      );
      
      // Dialog should be closed initially
      expect(screen.queryByText('Dialog is open')).not.toBeInTheDocument();
      
      // Open dialog
      fireEvent.click(screen.getByText('Open Dialog'));
      await waitFor(() => {
        expect(screen.getByText('Dialog is open')).toBeInTheDocument();
      });
      
      // Close dialog by clicking backdrop
      const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
      if (backdrop) {
        fireEvent.click(backdrop);
        await waitFor(() => {
          expect(screen.queryByText('Dialog is open')).not.toBeInTheDocument();
        });
      }
    });
  });
});