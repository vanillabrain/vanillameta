import React, { forwardRef, Ref, useRef } from 'react';
import { ReactComponent as IconShare } from '@/assets/images/icon/ic-share.svg';
import { ReactComponent as IconToggleOn } from '@/assets/images/icon/toggle-on.svg';
import { ReactComponent as IconToggleOff } from '@/assets/images/icon/toggle-off.svg';
import { ReactComponent as IconLink } from '@/assets/images/icon/ic-link.svg';
import { useAlert } from 'react-alert';
import DatePicker from '@/components/form/DatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ShareButtonProps {
  handleShareToggle?: () => void;
  isShareOn?: boolean;
  shareId?: string;
  shareLimitDate?: string;
  setShareLimitDate?: React.Dispatch<React.SetStateAction<string>>;
}

interface SharePopupProps extends ShareButtonProps {
  matches: boolean;
}

const paperStyles = "mt-[3px] border border-[#ddd] rounded-md shadow-[2px_2px_9px_0_rgba(42,50,62,0.1),0_4px_4px_0_rgba(0,0,0,0.02)]";

const ShareOnPopup = forwardRef((props: SharePopupProps, ref: Ref<HTMLDivElement>) => {
  const { matches, handleShareToggle, shareLimitDate, shareId } = props;
  const alert = useAlert();
  const shareLink = `${window.location.origin}/share/${shareId ? shareId : ''}`;

  const handleCopyClick = async () => {
    await navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        alert.success('클립보드에 링크가 복사되었습니다.');
      })
      .catch(error => {
        console.log(error);
        alert.error('링크 복사에 실패했습니다.\n다시 시도해 주세요.');
      });
  };

  return matches ? (
    <div className={`${paperStyles} min-w-[410px] bg-white`} ref={ref}>
      <div className="w-full p-6">
        <h3 className="mb-[6px] text-base font-semibold text-[#141414]">페이지 공유</h3>
        <form
          onSubmit={event => {
            event.preventDefault();
            handleShareToggle();
          }}
          className="flex flex-row justify-between items-center mb-[3px]"
        >
          <p className="mr-3 text-sm text-[#141414]">링크를 통한 읽기를 허용합니다.</p>
          <button type="submit" className="min-w-[44px] w-11 h-6 m-0 p-0 bg-transparent border-0 cursor-pointer">
            <IconToggleOn />
          </button>
        </form>
        <p className="text-sm text-[#141414]">
          설정하신&nbsp;
          <span className="text-[#0f5ab2]">
            {shareLimitDate}
          </span>
          까지&nbsp;
          <span className="font-semibold text-[#0f5ab2]">
            공유중
          </span>
          입니다.
        </p>
        <div className="flex flex-row justify-between mt-[18px] gap-3">
          <Input className="w-[298px] h-8" disabled value={shareLink} />
          <Button size="sm" onClick={handleCopyClick}>
            복사
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div className={`${paperStyles} w-[243px] bg-white`} ref={ref}>
      <div className="w-full py-[22px] px-6">
        <form
          onSubmit={event => {
            event.preventDefault();
            handleShareToggle();
          }}
          className="flex flex-row justify-between items-center mb-[22px]"
        >
          <h3 className="text-base font-semibold text-[#141414]">페이지 공유 중</h3>
          <button type="submit" className="min-w-[44px] w-11 h-6 m-0 p-0 bg-transparent border-0 cursor-pointer">
            <IconToggleOn />
          </button>
        </form>
        <div className="flex flex-row justify-between items-center">
          <p className="text-sm text-[#141414]">
            공유 기한:
            <span className="ml-1 font-bold text-[#333]">
              {shareLimitDate}
            </span>
          </p>
          <Button
            size="icon"
            className="w-8 h-8"
            onClick={handleCopyClick}
          >
            <IconLink />
          </Button>
        </div>
      </div>
    </div>
  );
});

const ShareOffPopup = forwardRef((props: SharePopupProps, ref: Ref<HTMLDivElement>) => {
  const { matches, handleShareToggle, shareLimitDate, setShareLimitDate } = props;

  return matches ? (
    <div className={`${paperStyles} min-w-[410px] bg-white`} ref={ref}>
      <div className="w-full p-6">
        <h3 className="mb-[6px] text-base font-semibold text-[#141414]">페이지 공유</h3>
        <form
          onSubmit={event => {
            event.preventDefault();
            handleShareToggle();
          }}
          className="flex flex-row justify-between items-center mb-4"
        >
          <p className="mr-3 text-sm text-[#141414]">
            링크를 통한 읽기를 허용하지 않습니다.
          </p>
          <button type="submit" className="min-w-[44px] w-11 h-6 m-0 p-0 bg-transparent border-0 cursor-pointer">
            <IconToggleOff />
          </button>
        </form>
        <div className="flex flex-row items-center">
          <span className="mr-2">
            공유 기한:
          </span>
          <DatePicker shareLimitDate={shareLimitDate} setShareLimitDate={setShareLimitDate} />
        </div>
      </div>
    </div>
  ) : (
    <div className={`${paperStyles} w-[243px] bg-white`} ref={ref}>
      <div className="w-full py-[22px] px-6">
        <form
          onSubmit={event => {
            event.preventDefault();
            handleShareToggle();
          }}
          className="flex flex-row justify-between items-center mb-[22px]"
        >
          <h3 className="text-base font-semibold text-[#141414]">페이지 공유하지 않음</h3>
          <button type="submit" className="min-w-[44px] w-11 h-6 m-0 p-0 bg-transparent border-0 cursor-pointer">
            <IconToggleOff />
          </button>
        </form>
        <div className="flex flex-row justify-between items-center">
          <p className="text-sm text-[#141414]">공유 기한:</p>
          <DatePicker shareLimitDate={shareLimitDate} setShareLimitDate={setShareLimitDate} />
        </div>
      </div>
    </div>
  );
});


function ShareButton(props: ShareButtonProps) {
  const { handleShareToggle, isShareOn, shareId, shareLimitDate, setShareLimitDate } = props;
  const [open, setOpen] = React.useState(false);
  const matches = typeof window !== 'undefined' ? window.innerWidth >= 640 : true;
  const ref: Ref<HTMLDivElement> = useRef();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {isShareOn ? (
          <Button
            variant="outline"
            className="flex-shrink-0 border-[#0f5ab2] bg-white text-[#0f5ab2] hover:bg-[#0f5ab2] hover:text-white px-2 sm:px-3 gap-1.5"
          >
            <IconShare className="w-4 h-4 fill-current" />
            공유중
          </Button>
        ) : (
          <Button
            variant="default"
            className="flex-shrink-0 px-2 sm:px-3 gap-1.5"
          >
            <IconShare className="w-4 h-4 fill-white" />
            공유
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0 border-0 shadow-none">
        {isShareOn ? (
          <ShareOnPopup
            ref={ref}
            matches={matches}
            handleShareToggle={handleShareToggle}
            shareLimitDate={shareLimitDate}
            shareId={shareId}
          />
        ) : (
          <ShareOffPopup
            ref={ref}
            matches={matches}
            handleShareToggle={handleShareToggle}
            shareLimitDate={shareLimitDate}
            setShareLimitDate={setShareLimitDate}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

export default ShareButton;
