import React, { useContext } from 'react';
import { LayoutContext } from '@/contexts/LayoutContext';
import { cn } from '@/lib/utils';

interface CopyrightProps {
  className?: string;
}

export const Copyright = ({ className }: CopyrightProps) => {
  return (
    <p className={cn('m-0 text-center text-sm text-muted-foreground', className)}>
      <a
        href="https://vanillabrain.com/"
        target="_blank"
        rel="noreferrer"
        className="text-[13px] font-bold text-muted-foreground no-underline"
      >
        ⓒ VanillaBrain Inc.
      </a>
    </p>
  );
};

const Footer = () => {
  const { footerBg } = useContext(LayoutContext);

  return (
    <footer
      className="flex h-[50px] shrink-0 flex-col items-center justify-center"
      style={{ backgroundColor: footerBg ? footerBg : '#fff' }}
    >
      <Copyright />
    </footer>
  );
};

export default Footer;
