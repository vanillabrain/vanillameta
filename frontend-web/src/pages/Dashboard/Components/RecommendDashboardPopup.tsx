import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAlert } from 'react-alert';
import TemplateService from '@/api/templateService';
import WidgetService from '@/api/widgetService';
import { STATUS } from '@/constant';
import CloseButton from '@/components/button/CloseButton';
import TemplateIcon01 from '@/assets/images/template/template01.svg?react';
import TemplateIcon02 from '@/assets/images/template/template02.svg?react';
import TemplateIcon03 from '@/assets/images/template/template03.svg?react';
import TemplateIcon04 from '@/assets/images/template/template04.svg?react';
import TemplateIcon05 from '@/assets/images/template/template05.svg?react';
import TemplateIcon06 from '@/assets/images/template/template06.svg?react';
import TemplateIcon07 from '@/assets/images/template/template07.svg?react';
import TemplateIcon08 from '@/assets/images/template/template08.svg?react';
import TemplateIcon09 from '@/assets/images/template/template09.svg?react';
import TemplateIcon10 from '@/assets/images/template/template10.svg?react';
import CheckIcon from '@/assets/images/icon/ic-check.svg?react';
import { LoadingContext } from '@/contexts/LoadingContext';
import { cn } from '@/lib/utils';

const getTemplateIcon = id => {
  let icon = null;
  switch (id) {
    case 7:
      icon = <TemplateIcon01 className="h-full w-full" />;
      break;
    case 8:
      icon = <TemplateIcon02 className="h-full w-full" />;
      break;
    case 9:
      icon = <TemplateIcon03 className="h-full w-full" />;
      break;
    case 10:
      icon = <TemplateIcon04 className="h-full w-full" />;
      break;
    case 11:
      icon = <TemplateIcon05 className="h-full w-full" />;
      break;
    case 12:
      icon = <TemplateIcon06 className="h-full w-full" />;
      break;
    case 13:
      icon = <TemplateIcon07 className="h-full w-full" />;
      break;
    case 14:
      icon = <TemplateIcon08 className="h-full w-full" />;
      break;
    case 15:
      icon = <TemplateIcon09 className="h-full w-full" />;
      break;
    case 16:
      icon = <TemplateIcon10 className="h-full w-full" />;
      break;
  }
  return icon;
};

const footerButtonClassName = 'text-sm leading-[1.14] font-semibold text-muted-foreground';
const confirmButtonClassName = 'text-sm leading-[1.14] font-semibold text-[#0057bd]';

export const WidgetList = ({
  handleWidgetConfirm = null,
  handleWidgetCancel = null,
  selectedWidgetIds = [],
  selectedChange = null,
}) => {
  const { t } = useTranslation();
  const alert = useAlert();
  const [loadedWidgetData, setLoadedWidgetData] = useState([]);
  const [selectedIds, setSelectedIds] = useState(selectedWidgetIds);
  const { showLoading, hideLoading } = useContext(LoadingContext);

  useEffect(() => {
    getItems();
  }, []);

  useEffect(() => {
    setSelectedIds(selectedWidgetIds);
  }, [selectedWidgetIds]);

  useEffect(() => {
    selectedChange(selectedIds.length);
  }, [selectedIds]);

  const getItems = () => {
    showLoading();
    WidgetService.selectWidgetList()
      .then(response => {
        if (response.data.status == STATUS.SUCCESS) {
          setLoadedWidgetData(response.data.data);
        } else {
          console.log('조회 실패!!!!');
        }
      })
      .finally(() => {
        hideLoading();
      });
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

  // 취소 버튼 클릭
  const handleCancelClick = () => {
    if (handleWidgetCancel) {
      handleWidgetCancel();
    }
  };

  // 다음 버튼 클릭
  const handleConfirmClick = () => {
    const widgets = [];
    for (let i = 0; i < loadedWidgetData.length; i++) {
      if (selectedIds.indexOf(loadedWidgetData[i].id) > -1) {
        widgets.push(loadedWidgetData[i]);
      }
    }

    if (widgets.length > 0) {
      if (handleWidgetConfirm) {
        handleWidgetConfirm(widgets);
      }
    } else {
      alert.info(t('recommend.selectWidgetAlert'));
    }
  };

  return (
    <>
      <div
        id="scroll-dialog-description"
        tabIndex={-1}
        className="min-h-0 w-full shrink overflow-y-auto border-t border-b border-border p-0"
      >
        <ul className="h-[400px] w-full">
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
                <Checkbox checked={isItemSelection(item)} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />
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
                <span className="ml-4 truncate text-sm leading-[1.14] font-medium text-[#333333]">{item.title}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex h-[63px] shrink-0 items-center justify-end gap-1 px-5">
        <Button variant="ghost" onClick={handleCancelClick} className={footerButtonClassName}>
          {t('recommend.cancel')}
        </Button>
        <span className="w-1" />
        <Button variant="ghost" onClick={() => handleConfirmClick()} className={confirmButtonClassName}>
          {t('recommend.next')}
        </Button>
      </div>
    </>
  );
};

export const TemplateList = ({ handleWidgetConfirm = null, handleWidgetCancel = null, selectedWidgetIds = null }) => {
  const { t } = useTranslation();
  const alert = useAlert();
  const [loadedTemplateDataList, setLoadedTemplateDataList] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  const getItems = () => {
    TemplateService.selectRecommendTemplateList({ widgets: selectedWidgetIds }).then(response => {
      // TemplateService.selectRecommendTemplateList({ widgets: [1, 2] }).then(response => {
      if (response.data.status == STATUS.SUCCESS) {
        setLoadedTemplateDataList(response.data.data);
      } else {
        console.log('조회 실패!!');
      }
    });
  };

  useEffect(() => {
    setSelectedItem(null);
    getItems();
  }, []);

  // 취소 버튼 클릭
  const handleCancelClick = () => {
    if (handleWidgetCancel) {
      handleWidgetCancel();
    }
  };

  // 선택완료 버튼 클릭
  const handleConfirmClick = () => {
    // 선택된 템플릿을 대시보드에 넘겨준다.
    if (selectedItem) {
      if (handleWidgetConfirm) {
        handleWidgetConfirm(selectedItem);
      }
    } else {
      alert.info(t('recommend.selectTemplateAlert'));
    }
  };

  const handleItemClick = item => {
    setSelectedItem(item);
  };

  return (
    <>
      <div className="h-[602px] min-h-0 w-full shrink overflow-y-auto border-t border-b border-border p-6">
        <div className="grid h-full grid-cols-5 gap-6">
          {loadedTemplateDataList.map(item => {
            const selected = selectedItem?.id === item.id;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                className={cn(
                  'relative flex h-[266px] cursor-pointer flex-col items-start justify-start gap-3 rounded-md border p-3 pb-5',
                  selected ? 'border-[#0f5ab2] bg-[#edf8ff]' : 'border-[#f5f6f8] bg-[#f5f6f8] hover:bg-[#ebfbff]',
                )}
                onClick={() => handleItemClick(item)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleItemClick(item);
                  }
                }}
              >
                <div className="m-0 w-full">{getTemplateIcon(item.id)}</div>
                {selected ? <CheckIcon className="absolute top-5 right-5 h-7 w-[33px]" /> : <></>}
                <span
                  className={cn(
                    'h-5 w-[224px] max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-[1.43] font-bold',
                    selected ? 'text-[#0f5ab2]' : 'text-[#333333]',
                  )}
                >
                  {item.title}
                </span>
                <span className="line-clamp-2 h-11 overflow-hidden text-sm leading-[1.57] break-words text-[#767676]">
                  {item.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex h-[63px] shrink-0 items-center justify-end gap-1 px-5">
        <Button variant="ghost" onClick={handleCancelClick} className={footerButtonClassName}>
          {t('recommend.back')}
        </Button>
        <span className="w-1" />
        <Button variant="ghost" onClick={() => handleConfirmClick()} className={confirmButtonClassName}>
          {t('recommend.done')}
        </Button>
      </div>
    </>
  );
};

function RecommendDashboardPopup({ recommendOpen = false, handleComplete = null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(recommendOpen);
  const title = t('recommend.title');
  const [subTitle, setSubTitle] = useState(t('recommend.selectWidget'));
  const [step, setStep] = useState(1);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState([]);
  const [selectedWidgetCount, setSelectedWidgetCount] = useState(0);

  useEffect(() => {
    setOpen(recommendOpen);
  }, [recommendOpen]);

  useEffect(() => {
    if (open) {
      setStep(1);
    }
  }, [open]);

  useEffect(() => {
    if (step == 1) {
      setSubTitle(t('recommend.selectWidget'));
    } else if (step == 2) {
      setSubTitle(t('recommend.selectTemplate'));
    }
  }, [step]);

  // 창 닫기
  const handleClose = () => {
    setOpen(false);
  };

  // 취소 버튼
  const handleCancelClick = () => {
    if (step == 1) {
      // 위젯 선택화면에서 다음 버튼 클릭
      handleClose();
    } else if (step == 2) {
      // 템플릿 선택화면에서 완료 클릭
      setStep(1); // step 1 로 이동
    }
  };

  // 다음 버튼
  const handleConfirmClick = items => {
    if (step == 1) {
      // 위젯 선택화면에서 다음 버튼 클릭
      const tempIds = [];
      items.map(item => {
        tempIds.push(item.id);
      });

      setSelectedWidgetIds(tempIds);
      setStep(2); // step 2 로 이동
    } else if (step == 2) {
      // 템플릿 선택화면에서 완료 클릭
      // todo 대시보드에 layout, widgets 정보 전달
      if (handleComplete) {
        const item = {
          templateId: items.id,
          widgets: selectedWidgetIds,
        };
        getTemplateResult(item);
      }
    }
  };

  const selectedWidgetChange = count => {
    setSelectedWidgetCount(count);
  };

  const getTemplateResult = item => {
    TemplateService.selectRecommendTemplateListDashboard(item).then(response => {
      if (response.data.status == STATUS.SUCCESS) {
        handleComplete(response.data.data);
      } else {
        console.log('조회 실패!!');
      }
    });
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
        aria-labelledby="scroll-dialog-title"
        className={cn(
          'flex max-h-[90dvh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0',
          step == 2 ? 'sm:max-w-[1392px]' : 'sm:max-w-[600px]',
        )}
      >
        <div className="relative w-full shrink-0 pt-[13px] pl-[21px]">
          <DialogTitle id="scroll-dialog-title" className="text-xl leading-normal font-semibold text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="pt-1.5 text-sm leading-normal text-muted-foreground">
            {step == 1 ? (
              <>
                <span>{t('common.addWidgetGuide')} (</span>
                <span className="font-bold text-[#0f5ab2]">{selectedWidgetCount}</span>
                <span>{t('common.selectedCount', { count: 0 })}</span>
              </>
            ) : (
              subTitle
            )}
          </DialogDescription>
          <CloseButton
            className="absolute top-0 right-0 mt-3 mr-3 cursor-pointer"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              handleClose();
            }}
          />
        </div>
        {step == 1 ? (
          <WidgetList
            handleWidgetConfirm={handleConfirmClick}
            handleWidgetCancel={handleCancelClick}
            selectedWidgetIds={selectedWidgetIds}
            selectedChange={selectedWidgetChange}
          />
        ) : (
          <TemplateList
            handleWidgetConfirm={handleConfirmClick}
            handleWidgetCancel={handleCancelClick}
            selectedWidgetIds={selectedWidgetIds}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
export default RecommendDashboardPopup;
