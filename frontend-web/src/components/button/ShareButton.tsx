import React from 'react';
import { useAlert } from 'react-alert';
import { useTranslation } from 'react-i18next';
import { get, post } from '@/helpers/apiHelper';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Notice } from '@/components/ui/notice';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { TextField } from '@/components/ui/text-field';
import { cn } from '@/lib/utils';
import { errorMessage, responseData } from '@/pages/Dashboard/dashboardPreview';
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
  dashboardId?: string;
  className?: string;
}

interface ReuseAccessProps {
  allowReuse: boolean;
  reuseState: 'loading' | 'ready' | 'saving' | 'error';
  reuseError: string;
  onReuseToggle: (next: boolean) => void;
}

interface SharePopupProps extends ShareButtonProps, ReuseAccessProps {
  matches: boolean;
  showReuseSetting: boolean;
}

const panelClassName = 'mt-[3px] max-h-[calc(100dvh-96px)] gap-0 overflow-y-auto rounded-md p-0';

const ShareToggle = ({ checked, label, description, onToggle }) => (
  <div className="flex flex-row items-center justify-between">
    <span className="mr-3 text-sm text-foreground">{description}</span>
    <Switch checked={checked} onCheckedChange={() => onToggle?.()} aria-label={label} />
  </div>
);

const ReuseAccessSetting = ({ allowReuse, reuseState, reuseError, onReuseToggle }: ReuseAccessProps) => {
  const { t } = useTranslation();
  const busy = reuseState === 'loading' || reuseState === 'saving';
  return (
    <div className="mt-3 border-t border-border pt-3">
      <label className="flex w-full items-start gap-2">
        <Checkbox
          className="mt-1"
          checked={allowReuse}
          disabled={busy}
          onCheckedChange={checked => onReuseToggle(checked === true)}
          aria-label={t('share.allowReuse')}
        />
        <span className="min-w-0 text-sm text-foreground">
          {t('share.allowReuse')}
          <span className="mt-1 block text-xs text-muted-foreground">{t('share.allowReuseHint')}</span>
        </span>
      </label>
      {reuseState === 'loading' && <p className="mt-1 text-xs text-muted-foreground">{t('share.allowReuseLoading')}</p>}
      {reuseState === 'saving' && <p className="mt-1 text-xs text-muted-foreground">{t('share.allowReuseSaving')}</p>}
      {reuseState === 'error' && reuseError && (
        <Notice severity="error" className="mt-2">
          {reuseError}
        </Notice>
      )}
    </div>
  );
};

const ShareOnPopup = (props: SharePopupProps) => {
  const { t } = useTranslation();
  const {
    matches,
    handleShareToggle,
    shareLimitDate,
    shareId,
    showReuseSetting,
    allowReuse,
    reuseState,
    reuseError,
    onReuseToggle,
  } = props;
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
      {showReuseSetting && (
        <ReuseAccessSetting
          allowReuse={allowReuse}
          reuseState={reuseState}
          reuseError={reuseError}
          onReuseToggle={onReuseToggle}
        />
      )}
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
      {showReuseSetting && (
        <ReuseAccessSetting
          allowReuse={allowReuse}
          reuseState={reuseState}
          reuseError={reuseError}
          onReuseToggle={onReuseToggle}
        />
      )}
    </div>
  );
};

const ShareOffPopup = (props: SharePopupProps) => {
  const { t } = useTranslation();
  const {
    matches,
    handleShareToggle,
    shareLimitDate,
    setShareLimitDate,
    showReuseSetting,
    allowReuse,
    reuseState,
    reuseError,
    onReuseToggle,
  } = props;

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
      {showReuseSetting && (
        <ReuseAccessSetting
          allowReuse={allowReuse}
          reuseState={reuseState}
          reuseError={reuseError}
          onReuseToggle={onReuseToggle}
        />
      )}
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
      {showReuseSetting && (
        <ReuseAccessSetting
          allowReuse={allowReuse}
          reuseState={reuseState}
          reuseError={reuseError}
          onReuseToggle={onReuseToggle}
        />
      )}
    </div>
  );
};

function ShareButton(props: ShareButtonProps) {
  const { handleShareToggle, isShareOn, shareId, shareLimitDate, setShareLimitDate, dashboardId, className } = props;
  const { t } = useTranslation();
  const matches = useMinWidth(600);
  const popoverId = React.useId();
  const [allowReuse, setAllowReuse] = React.useState(false);
  const [reuseState, setReuseState] = React.useState<ReuseAccessProps['reuseState']>('loading');
  const [reuseError, setReuseError] = React.useState('');
  const reuseSequence = React.useRef(0);
  const reuseUrl = dashboardId ? `/bi/dashboards/${encodeURIComponent(dashboardId)}/reuse-access` : '';

  const loadReuseAccess = React.useCallback(() => {
    if (!reuseUrl) return;
    reuseSequence.current += 1;
    const token = reuseSequence.current;
    setReuseState('loading');
    setReuseError('');
    get(reuseUrl)
      .then(response => {
        if (token !== reuseSequence.current) return;
        setAllowReuse(responseData(response)?.allowReuse === true);
        setReuseState('ready');
      })
      .catch(failure => {
        if (token !== reuseSequence.current) return;
        setReuseError(errorMessage(failure));
        setReuseState('error');
      });
  }, [reuseUrl]);

  const onReuseToggle = (next: boolean) => {
    if (!reuseUrl || reuseState === 'loading' || reuseState === 'saving') return;
    reuseSequence.current += 1;
    const token = reuseSequence.current;
    setReuseState('saving');
    setReuseError('');
    post(reuseUrl, { allowReuse: next })
      .then(response => {
        if (token !== reuseSequence.current) return;
        setAllowReuse(responseData(response)?.allowReuse === true);
        setReuseState('ready');
      })
      .catch(failure => {
        if (token !== reuseSequence.current) return;
        setReuseError(errorMessage(failure));
        setReuseState('error');
      });
  };

  React.useEffect(
    () => () => {
      reuseSequence.current += 1;
    },
    [],
  );

  const reuseProps = {
    allowReuse,
    reuseState,
    reuseError,
    onReuseToggle,
    showReuseSetting: !!reuseUrl,
  };

  return (
    <Popover onOpenChange={open => open && loadReuseAccess()}>
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
            {...reuseProps}
          />
        ) : (
          <ShareOffPopup
            matches={matches}
            handleShareToggle={handleShareToggle}
            shareLimitDate={shareLimitDate}
            setShareLimitDate={setShareLimitDate}
            {...reuseProps}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

export default ShareButton;
