import React, { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import WidgetService from '@/api/widgetService';
import { STATUS } from '@/constant';
import { useAlert } from 'react-alert';
import CloseButton from '@/components/button/CloseButton';
import { LoadingContext } from '@/contexts/LoadingContext';

function AddWidgetPopup({ label, useWidgetIds = [], widgetOpen = false, widgetSelect = null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(widgetOpen);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const { showLoading, hideLoading } = useContext(LoadingContext);
  const alert = useAlert();
  const getItems = () => {
    showLoading();
    WidgetService.selectWidgetList()
      .then(response => {
        if (response.data.status === STATUS.SUCCESS) {
          const widgetList = response.data.data.filter(item => {
            return !useWidgetIds.find(useItem => useItem == item.id);
          });
          setLoadedWidgetData(widgetList);
        } else {
          alert.error(t('common:messages.error'));
        }
      })
      .catch(() => alert.error(t('common:messages.error')))
      .finally(() => {
        hideLoading();
      });
  };

  const scrollRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(widgetOpen);
  }, [widgetOpen]);

  useEffect(() => {
    if (open) {
      scrollRegionRef.current?.focus();

      setSelectedIds([]);
      setLoadedWidgetData([]);
      getItems();
    }
  }, [open]);

  const handleClose = () => {
    if (widgetSelect) {
      widgetSelect(null);
    }
    setOpen(false);
  };

  const handleClick = item => {
    const isSelect = isItemSelection(item);
    const newIds = [...selectedIds];
    if (isSelect) {
      const index = newIds.indexOf(item.id);
      newIds.splice(index, 1);
      setSelectedIds(newIds);
    } else {
      newIds.push(item.id);
      setSelectedIds(newIds);
    }
  };

  const isItemSelection = item => {
    return !!selectedIds.find(id => id === item.id);
  };

  const handleSelect = () => {
    const widgets = [];
    for (let i = 0; i < loadedWidgetData.length; i++) {
      if (selectedIds.indexOf(loadedWidgetData[i].id) > -1) {
        widgets.push(loadedWidgetData[i]);
      }
    }

    if (widgets.length > 0) {
      if (widgetSelect) {
        widgetSelect(widgets);
      }
      setOpen(false);
    } else {
      alert.info(t('common.selectWidgetAlert'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90dvh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]"
        aria-labelledby="scroll-dialog-title"
      >
        <div className="flex w-full shrink-0 items-start justify-between pt-[13px] pl-[21px]">
          <div className="min-w-0">
            <DialogTitle id="scroll-dialog-title" className="text-xl leading-normal font-semibold text-foreground">
              {label}
            </DialogTitle>
            <DialogDescription className="pt-1.5 text-sm leading-normal text-muted-foreground">
              {t('common.addWidgetGuide')}{' '}
              <span className="font-bold text-[#0f5ab2]">{t('common.selectedCount', { count: selectedIds.length })}</span>
            </DialogDescription>
          </div>
          <CloseButton
            className="mt-3 mr-3 cursor-pointer"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              handleClose();
            }}
          />
        </div>

        <div
          ref={scrollRegionRef}
          id="scroll-dialog-description"
          tabIndex={-1}
          className="mt-3 h-[400px] min-h-0 w-full shrink overflow-y-auto border-t border-b border-border outline-none"
        >
          <ul className="w-full">
            {loadedWidgetData.map((item, index) => (
              <li key={index}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isItemSelection(item)}
                  className="flex h-[50px] w-full cursor-pointer items-center px-5 hover:bg-muted aria-pressed:bg-muted"
                  onClick={() => handleClick(item)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleClick(item);
                    }
                  }}
                >
                  <Checkbox
                    checked={isItemSelection(item)}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="pointer-events-none"
                  />
                  <span className="ml-4 inline-flex min-w-6 items-center">
                    <Avatar aria-hidden="true" className="h-[30px] w-auto rounded-none bg-transparent">
                      <AvatarImage
                        src={`/static/images/${item.icon}`}
                        alt=""
                        className="h-[30px] w-auto rounded-none object-contain"
                      />
                      <AvatarFallback className="h-[30px] w-[30px] rounded-none bg-muted text-xs font-medium text-muted-foreground">
                        {String(item.title ?? '').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </span>
                  <span className="ml-4 truncate text-sm leading-[1.14] font-medium text-foreground">{item.title}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex h-[63px] shrink-0 items-center justify-end pr-5">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-sm leading-[1.14] font-semibold text-muted-foreground"
          >
            {t('common.cancel')}
          </Button>
          <span className="w-1" />
          <Button
            variant="ghost"
            onClick={() => handleSelect()}
            className="text-sm leading-[1.14] font-semibold text-[#0057bd]"
          >
            {t('common.addWidget')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddWidgetPopup;
