import React, { useContext } from 'react';
import { LayoutContext } from '@/contexts/LayoutContext';

export const Copyright = (props: any) => {
  const { className, style, ...restProps } = props;
  return (
    <div className={`text-center text-gray-600 ${className || ''}`} style={style} {...restProps}>
      <a
        href="https://vanillabrain.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] text-[#767676] font-bold no-underline hover:underline"
      >
        ⓒ VanillaBrain Inc.
      </a>
    </div>
  );
};

const Footer = () => {
  const { footerBg } = useContext(LayoutContext);

  return (
    <div
      className="flex items-center justify-center h-[50px]"
      style={{
        backgroundColor: footerBg ? footerBg : '#fff',
      }}
    >
      <Copyright />
    </div>
  );
};

export default Footer;
