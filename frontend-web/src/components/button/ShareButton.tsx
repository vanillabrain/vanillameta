import React from 'react';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { cn } from '@/lib/utils';
import IconShare from '@/assets/images/icon/ic-share.svg?react';
import IconLink from '@/assets/images/icon/ic-link.svg?react';
import DatePicker from '@/components/form/DatePicker';
import { useMinWidth } from '@/components/PageViewBox';

interface ShareButtonProps {
  handleShareToggle?: () => void;
  isShareOn?: boolean;
  shareId?: string;
  shareLimitDate?: string;
  setShareLimitDate?: React.Dispatch<React.SetStateAction<string>>;
  className?: string;
}

interface SharePopupProps extends ShareButtonProps {
  matches: boolean;
}

const panelClassName = 'mt-[3px] max-h-[calc(100dvh-96px)] gap-0 overflow-y-auto rounded-md p-0';

const ShareToggle = ({ checked, label, description, onToggle }) => (
  <div className="flex flex-row items-center justify-between">
    <span className="mr-3 text-sm text-foreground">{description}</span>
    <Switch checked={checked} onCheckedChange={() => onToggle?.()} aria-label={label} />
  </div>
);

const ShareOnPopup = (props: SharePopupProps) => {
  const { t } = useTranslation();
  const { matches, handleShareToggle, shareLimitDate, shareId } = props;
  const alert = useAlert();
  const shareLink = window.location.origin + '/share/' + (shareId ? shareId : '');
  const embedCode =
    '<iframe src="' +
    window.location.origin +
    '/embed/' +
    (shareId ? shareId : '') +
    '" width="100%" height="600" frameborder="0"></iframe>';

  const handleCopyClick = async () => {
    await navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        alert.success(t('share.linkCopied'));
      })
      .catch(error => {
        console.log(error);
        alert.error(t('share.linkCopyFailed'));
      });
  };

  const handleEmbedCopyClick = async () => {
    await navigator.clipboard
      .writeText(embedCode)
      .then(() => {
        alert.success(t('share.embedCopied'));
      })
      .catch(error => {
        console.log(error);
        alert.error(t('share.embedCopyFailed'));
      });
  };

  return matches ? (
    <div className="w-full p-6">
      <p className="mb-1.5 text-base font-semibold text-foreground">{t('share.pageShare')}</p>
      <ShareToggle checked label={t('share.allowRead')} description={t('share.allowRead')} onToggle={handleShareToggle} />
      <p className="mb-[3px] text-sm text-foreground">
        {t('share.untilPrefix')}
        <span className="text-[#0f5ab2]">{shareLimitDate}</span>
        {t('share.untilMiddle')}
        <span className="font-semibold text-[#0f5ab2]">{t('share.sharingTag')}</span>
        {t('share.untilSuffix')}
      </p>
      <div className="mt-[18px] flex flex-row items-center gap-2">
        <TextField
          className="flex-1"
          inputProps={{ readOnly: true, 'aria-label': t('share.pageShare') }}
          value={shareLink}
        />
        <Button type="button" onClick={handleCopyClick} className="min-w-[55px] shrink-0">
          {t('share.copy')}
        </Button>
      </div>
      <p className="mt-4 mb-1.5 text-[13px] font-semibold text-foreground">{t('share.embedCode')}</p>
      <div className="flex flex-row items-start gap-2">
        <TextField
          className="flex-1"
          multiline
          minRows={3}
          rows={3}
          inputProps={{ readOnly: true, 'aria-label': t('share.embedCode'), className: 'break-words h-auto py-2' }}
          value={embedCode}
        />
        <Button type="button" onClick={handleEmbedCopyClick} className="min-w-[55px] shrink-0">
          {t('share.copy')}
        </Button>
      </div>
    </div>
  ) : (
    <div className="w-full px-6 pt-[22px] pb-5">
      <div className="mb-[22px] flex flex-row items-center justify-between">
        <p className="text-base font-semibold text-foreground">{t('share.sharing')}</p>
        <ShareToggle checked label={t('share.allowRead')} description="" onToggle={handleShareToggle} />
      </div>
      <div className="flex flex-row items-center justify-between">
        <p className="text-sm text-foreground">
          {t('share.expiry')}
          <span className="ml-1 font-bold text-[#333]">{shareLimitDate}</span>
        </p>
        <Button
          type="button"
          onClick={handleCopyClick}
          aria-label={t('share.pageShare') + ' ' + t('share.copy')}
          className="h-8 w-8 min-w-8 p-0"
        >
          <IconLink />
        </Button>
      </div>
    </div>
  );
};

const ShareOffPopup = (props: SharePopupProps) => {
  const { t } = useTranslation();
  const { matches, handleShareToggle, shareLimitDate, setShareLimitDate } = props;

  return matches ? (
    <div className="w-full p-6">
      <p className="mb-1.5 text-base font-semibold text-foreground">{t('share.pageShare')}</p>
      <div className="mb-4">
        <ShareToggle
          checked={false}
          label={t('share.allowRead')}
          description={t('share.disallowRead')}
          onToggle={handleShareToggle}
        />
      </div>
      <div className="flex flex-row items-center">
        <span className="mr-2 text-foreground">{t('share.expiry')}</span>
        <DatePicker shareLimitDate={shareLimitDate} setShareLimitDate={setShareLimitDate} />
      </div>
    </div>
  ) : (
    <div className="w-full px-6 pt-[22px] pb-5">
      <div className="mb-[22px] flex flex-row items-center justify-between">
        <p className="text-base font-semibold text-foreground">{t('share.notSharing')}</p>
        <ShareToggle checked={false} label={t('share.allowRead')} description="" onToggle={handleShareToggle} />
      </div>
      <div className="flex flex-row items-center justify-between">
        <p className="text-sm text-foreground">{t('share.expiry')}</p>
        <DatePicker shareLimitDate={shareLimitDate} setShareLimitDate={setShareLimitDate} />
      </div>
    </div>
  );
};

function ShareButton(props: ShareButtonProps) {
  const { handleShareToggle, isShareOn, shareId, shareLimitDate, setShareLimitDate, className } = props;
  const { t } = useTranslation();
  const matches = useMinWidth(600);
  const popoverId = React.useId();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={isShareOn ? 'outline' : 'default'}
          aria-haspopup="dialog"
          aria-controls={popoverId}
          className={cn('shrink-0 gap-1.5 px-2 sm:px-3', className)}
        >
          <IconShare fill="currentColor" />
          {isShareOn ? t('share.buttonActive') : t('share.button')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={popoverId}
        role="dialog"
        aria-modal="true"
        aria-label={t('share.pageShare')}
        align="end"
        className={cn(panelClassName, matches ? 'w-[410px] max-w-[calc(100vw-32px)]' : 'w-[calc(100vw-32px)]')}
      >
        {isShareOn ? (
          <ShareOnPopup
            matches={matches}
            handleShareToggle={handleShareToggle}
            shareLimitDate={shareLimitDate}
            shareId={shareId}
          />
        ) : (
          <ShareOffPopup
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
