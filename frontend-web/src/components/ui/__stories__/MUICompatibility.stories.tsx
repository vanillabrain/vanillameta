import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, IconButton, LoadingButton } from '../mui-button-compat';
import { TextField, OutlinedInput } from '../mui-textfield-compat';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions 
} from '../mui-dialog-compat';
import { Modal, Paper } from '../mui-modal-compat';
import { Checkbox, FormControlLabel } from '../mui-checkbox-compat';
import { Select, MenuItem } from '../mui-select-compat';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  TablePagination 
} from '../mui-table-compat';

// Button Stories
export default {
  title: 'UI/MUI Compatibility',
} as Meta;

export const Buttons: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <div className="space-x-2">
        <Button variant="contained">Contained</Button>
        <Button variant="outlined">Outlined</Button>
        <Button variant="text">Text</Button>
      </div>
      
      <div className="space-x-2">
        <Button variant="contained" color="primary">Primary</Button>
        <Button variant="contained" color="error">Error</Button>
        <Button variant="contained" color="success">Success</Button>
        <Button variant="contained" color="warning">Warning</Button>
      </div>
      
      <div className="space-x-2">
        <Button size="small">Small</Button>
        <Button size="medium">Medium</Button>
        <Button size="large">Large</Button>
      </div>
      
      <div className="space-x-2">
        <Button startIcon={<span>→</span>}>With Start Icon</Button>
        <Button endIcon={<span>←</span>}>With End Icon</Button>
      </div>
      
      <div className="space-x-2">
        <Button disabled>Disabled</Button>
        <Button fullWidth>Full Width</Button>
      </div>
    </div>
  ),
};

export const IconButtons: StoryObj = {
  render: () => (
    <div className="space-x-2">
      <IconButton size="small" aria-label="small">
        <span>S</span>
      </IconButton>
      <IconButton size="medium" aria-label="medium">
        <span>M</span>
      </IconButton>
      <IconButton size="large" aria-label="large">
        <span>L</span>
      </IconButton>
      <IconButton color="primary" aria-label="primary">
        <span>P</span>
      </IconButton>
      <IconButton color="error" aria-label="error">
        <span>E</span>
      </IconButton>
      <IconButton disabled aria-label="disabled">
        <span>D</span>
      </IconButton>
    </div>
  ),
};

export const LoadingButtons: StoryObj = {
  render: () => {
    const [loading, setLoading] = React.useState(false);
    
    return (
      <div className="space-y-4">
        <div className="space-x-2">
          <LoadingButton loading>Loading</LoadingButton>
          <LoadingButton loading loadingPosition="start">
            Start
          </LoadingButton>
          <LoadingButton loading loadingPosition="end">
            End
          </LoadingButton>
          <LoadingButton loading loadingPosition="center">
            Center
          </LoadingButton>
        </div>
        
        <div className="space-x-2">
          <LoadingButton
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 2000);
            }}
          >
            Click to Load
          </LoadingButton>
        </div>
      </div>
    );
  },
};

export const TextFields: StoryObj = {
  render: () => (
    <div className="space-y-4 max-w-md">
      <TextField label="Standard" variant="standard" />
      <TextField label="Filled" variant="filled" />
      <TextField label="Outlined" variant="outlined" />
      
      <TextField label="Small" size="small" />
      <TextField label="Medium" size="medium" />
      
      <TextField label="With Helper Text" helperText="This is helper text" />
      <TextField label="Error" error helperText="This field has an error" />
      <TextField label="Disabled" disabled />
      <TextField label="Required" required />
      
      <TextField label="Password" type="password" />
      <TextField label="Number" type="number" />
      <TextField label="Email" type="email" />
      
      <TextField
        label="Multiline"
        multiline
        rows={4}
        defaultValue="This is a multiline text field"
      />
      
      <TextField
        label="With Adornments"
        InputProps={{
          startAdornment: <span className="mr-2">$</span>,
          endAdornment: <span className="ml-2">.00</span>,
        }}
      />
      
      <OutlinedInput placeholder="Outlined Input" />
      <OutlinedInput placeholder="With Error" error />
    </div>
  ),
};

export const Dialogs: StoryObj = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    
    return (
      <>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Open Dialog
        </Button>
        
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This is the dialog content. It can contain any content you want.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)} variant="contained">
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  },
};

export const Modals: StoryObj = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    
    return (
      <>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Open Modal
        </Button>
        
        <Modal open={open} onClose={() => setOpen(false)}>
          <Paper
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 400,
              bgcolor: 'background.paper',
              boxShadow: 24,
              p: 4,
            }}
          >
            <h2 className="text-xl font-semibold mb-4">Modal Title</h2>
            <p className="mb-4">This is the modal content.</p>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </Paper>
        </Modal>
      </>
    );
  },
};

export const FormControls: StoryObj = {
  render: () => {
    const [checked, setChecked] = React.useState(false);
    const [selectedValue, setSelectedValue] = React.useState('');
    
    return (
      <div className="space-y-4">
        <div>
          <Checkbox
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <FormControlLabel
            control={<Checkbox />}
            label="Checkbox with label"
          />
        </div>
        
        <div className="w-64">
          <Select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            displayEmpty
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            <MenuItem value="option1">Option 1</MenuItem>
            <MenuItem value="option2">Option 2</MenuItem>
            <MenuItem value="option3">Option 3</MenuItem>
          </Select>
        </div>
        
        <div className="w-64">
          <Select
            value={selectedValue}
            onChange={(e) => setSelectedValue(e.target.value)}
            label="With Label"
          >
            <MenuItem value="option1">Option 1</MenuItem>
            <MenuItem value="option2">Option 2</MenuItem>
            <MenuItem value="option3">Option 3</MenuItem>
          </Select>
        </div>
      </div>
    );
  },
};

export const Tables: StoryObj = {
  render: () => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(5);
    
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      value: Math.floor(Math.random() * 100),
      status: i % 3 === 0 ? 'Active' : 'Inactive',
    }));
    
    const displayedRows = rows.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
    
    return (
      <div>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Value</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedRows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{row.value}</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          count={rows.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </div>
    );
  },
};

export const CompleteForm: StoryObj = {
  render: () => {
    const [formData, setFormData] = React.useState({
      name: '',
      email: '',
      role: '',
      subscribe: false,
      comments: '',
    });
    
    return (
      <form className="space-y-4 max-w-md">
        <TextField
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          fullWidth
        />
        
        <TextField
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          fullWidth
        />
        
        <Select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          fullWidth
          displayEmpty
        >
          <MenuItem value="">Select Role</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
          <MenuItem value="user">User</MenuItem>
          <MenuItem value="guest">Guest</MenuItem>
        </Select>
        
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.subscribe}
              onChange={(e) => setFormData({ ...formData, subscribe: e.target.checked })}
            />
          }
          label="Subscribe to newsletter"
        />
        
        <TextField
          label="Comments"
          multiline
          rows={4}
          value={formData.comments}
          onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
          fullWidth
        />
        
        <div className="space-x-2">
          <Button variant="contained" type="submit">
            Submit
          </Button>
          <Button variant="outlined" type="reset">
            Reset
          </Button>
        </div>
        
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">Form Data:</h3>
          <pre>{JSON.stringify(formData, null, 2)}</pre>
        </div>
      </form>
    );
  },
};