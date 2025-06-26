import { Modal, Paper } from '@/components/ui/mui-modal-compat';
import { Button } from '@/components/ui/mui-button-compat';
import { ReactComponent as CloseIcon } from '@/assets/images/icon/ic-xmark.svg';
import React from 'react';
import { MAX_WIDTH } from '@/constant';

interface ModalPopupProps {
  open: boolean;
  handleClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
}

const ModalPopup = (props: ModalPopupProps) => {
  const { open, handleClose, title, children } = props;
  return (
    <Modal
      open={open}
      onClose={handleClose}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      BackdropProps={{
        sx: {
          boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)',
          backgroundColor: 'rgba(122, 130, 144, 0.45)',
        },
      }}
    >
      <Paper
        className={`flex flex-col w-[90%] sm:w-[80%] h-[70%] max-h-[754px] rounded-lg p-2.5 pt-0`}
        sx={{
          maxWidth: MAX_WIDTH,
          boxShadow: '5px 5px 8px 0 rgba(0, 28, 71, 0.15)',
          border: 'solid 1px #ddd',
        }}
      >
        <div className="flex flex-row justify-between items-center m-5 mr-2.5">
          <h2 className="text-xl font-semibold text-[#141414]">{title}</h2>
          <Button variant="ghost" onClick={handleClose} className="p-2.5 min-w-0">
            <CloseIcon width="16" height="16" />
          </Button>
        </div>
        <div className="w-full h-full flex justify-center items-center flex-1">
          {children}
        </div>
      </Paper>
    </Modal>
  );
};

export default ModalPopup;
