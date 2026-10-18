import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import IconUser from '@/assets/images/icon/ic-user.svg?react';
import ProfileModify from '@/components/user/ProfileModify';
import OrganizationMenuLink from '@/components/user/OrganizationMenuLink';
import { AuthContext } from '@/contexts/AuthContext';
import Logout from '@/components/user/Logout';

const ProfileViewButton = () => {
  const { t } = useTranslation();
  const { userState } = useContext(AuthContext);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={t('profile.menu')}
          aria-haspopup="dialog"
          className="min-w-0 p-0 hover:bg-transparent"
        >
          <IconUser className="size-9 p-[7.5px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        role="dialog"
        aria-modal="true"
        aria-label={t('profile.menu')}
        align="end"
        className="mt-[3px] w-[360px] gap-0 border border-border p-6 shadow-[2px_2px_9px_0_rgba(42,50,62,0.1),0_4px_4px_0_rgba(0,0,0,0.02)]"
      >
        <div className="flex gap-8">
          <Avatar className="size-12 rounded-full border border-border bg-muted">
            <AvatarFallback className="bg-muted">
              <IconUser className="size-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm leading-[18px] font-bold text-foreground">
              {userState.userId}
              <span className="ml-1 font-normal text-muted-foreground">님</span>
            </span>
            <span className="mt-2 text-sm leading-5 text-foreground">{userState.userEmail}</span>
            <div className="mt-8 flex flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-sm text-muted-foreground">
              <Logout className="underline hover:underline" />
              <span className="hidden h-[10px] w-px bg-[#cccfd8] sm:block" />
              <ProfileModify />
              <span className="hidden h-[10px] w-px bg-[#cccfd8] sm:block" />
              <OrganizationMenuLink className="underline hover:underline" />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProfileViewButton;
