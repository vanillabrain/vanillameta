import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Profile-menu entry to /organization: the signed-in account's own organization only. */
const OrganizationMenuLink = props => {
  const { className, ...rest } = props;
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => navigate('/organization')}
      className={cn('px-2 font-normal text-inherit whitespace-nowrap hover:bg-transparent hover:text-inherit', className)}
      {...rest}
    >
      {t('organization.menu')}
    </Button>
  );
};

export default OrganizationMenuLink;
