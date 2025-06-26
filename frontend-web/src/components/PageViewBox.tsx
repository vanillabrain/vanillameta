import React, { useContext, useEffect } from 'react';
import { MAX_WIDTH } from '@/constant';
import { LayoutContext } from '@/contexts/LayoutContext';
import { cn } from '@/lib/utils';

interface PageViewBoxProps {
  iconName?: string;
  title?: string;
  titleElement?: React.ReactNode;
  date?: string;
  button?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

function PageViewBox(props: PageViewBoxProps) {
  const matches = typeof window !== 'undefined' ? window.innerWidth >= 640 : true;
  return matches ? <DesktopViewBox {...props} /> : <MobileViewBox {...props} />;
}
export default PageViewBox;

const MobileViewBox = props => {
  const { iconName, title, titleElement, date, button, className } = props;
  const { changeFooterBg } = useContext(LayoutContext);

  useEffect(() => {
    changeFooterBg('#f9f9fa');
    return () => {
      changeFooterBg(null);
    };
  }, []);

  return (
    <div className="flex flex-auto w-full flex-col items-center">
      <div className={cn('flex flex-row justify-between items-center w-full min-h-[66px] px-5 bg-white', className)}>
        <div className="flex flex-row items-center">
          {iconName && (
            <img
              src={`/static/images/${iconName}`}
              className="w-[30px] h-[30px] mr-3 rounded-none object-contain bg-transparent"
              alt=""
            />
          )}
          <div className="flex flex-col gap-1 mt-[18px] mb-[10px]">
            {titleElement ? (
              titleElement
            ) : (
              <h2 className="line-clamp-3 max-h-[60px] pr-3 text-base font-semibold leading-[1.3] text-[#333] break-words">
                {title}
              </h2>
            )}
            {date && <p className="text-[10px] font-medium leading-[1.6] text-[#333]">수정일: {date}</p>}
          </div>{' '}
        </div>

        {button}
      </div>
      <div className="w-full min-w-full h-full flex-auto bg-[#f9f9fa]">
        <div className="w-full h-px bg-gray-300" />
        {props.children}
      </div>
    </div>
  );
};

const DesktopViewBox = props => {
  const { iconName, title, titleElement, date, button, className } = props;

  return (
    <div className="w-full flex flex-col items-center px-5">
      <div
        className={cn('w-full h-full rounded-md border border-[#ddd] bg-[#f9f9fa]', className)}
        style={{ maxWidth: MAX_WIDTH }}
      >
        <div className="flex flex-row justify-between items-center w-full h-[57px] px-5 bg-white rounded-t-md">
          {/* title */}
          <div
            className="flex flex-row items-center w-full"
            style={{
              maxWidth: button ? `calc(100% - ${window.innerWidth >= 768 ? 360 : 390}px)` : 'calc(100% - 100px)',
            }}
          >
            {iconName && (
              <img
                src={`/static/images/${iconName}`}
                className="w-[30px] h-[30px] rounded-none object-contain bg-transparent mr-[18px]"
                alt=""
              />
            )}
            {titleElement ? (
              titleElement
            ) : (
              <span
                className="flex-grow-0 block w-full h-4 font-medium text-base sm:text-lg leading-[0.89] tracking-[-0.18px] text-[#141414] truncate"
                style={{ maxWidth: MAX_WIDTH }}
              >
                {title}
              </span>
            )}
          </div>

          {/* date, button */}
          <div className="flex flex-row justify-end items-center flex-shrink-0">
            <span className={cn('h-4 text-sm font-medium leading-[1.14] text-[#333333]', button && 'mr-[26px] md:mr-9')}>
              {date}
            </span>
            <div className="flex flex-row justify-end items-center">{button}</div>
          </div>
        </div>
        <div className="w-full h-px bg-gray-300" />
        {props.children}
      </div>
    </div>
  );
};
