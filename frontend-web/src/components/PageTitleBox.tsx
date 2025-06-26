import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

interface PageTitleBoxProps {
  title: string;
  upperTitle?: string;
  upperTitleLink?: string;
  className?: string;
  button?: React.ReactNode;
  fixed?: boolean;
  children: React.ReactNode;
}

function PageTitleBox(props: PageTitleBoxProps) {
  const { title, upperTitle, upperTitleLink, button, className, fixed, children } = props;
  const navigate = useNavigate();

  const fixedClass = fixed ? 'fixed z-[1000]' : '';

  return (
    <div className="flex flex-col w-full h-full flex-auto">
      <div className="w-full">
        <div
          className={`flex flex-row items-center justify-between w-full h-10 sm:h-14 px-6 border-b border-[#e3e7ea] bg-[#f5f6f8] ${fixedClass}`}
        >
          <div className="flex flex-row gap-1.5 sm:gap-2.5 items-center">
            {upperTitle && (
              <>
                <RouterLink
                  to={upperTitleLink || '/'}
                  className="h-[19px] flex-grow-0 font-pretendard text-sm sm:text-base font-medium text-[#4a4a4a] no-underline"
                >
                  {upperTitle}
                </RouterLink>
                <span className="h-[19px] flex-grow-0 font-pretendard text-inherit font-medium text-[#767676]">/</span>
              </>
            )}
            <button
              onClick={event => {
                event.preventDefault();
                navigate(0);
              }}
              className="h-[19px] flex-grow-0 border-0 p-0 cursor-pointer font-pretendard text-sm sm:text-base font-semibold text-[#141414] bg-transparent"
            >
              {title}
            </button>
          </div>
          <div className="hidden sm:block">{button}</div>
        </div>
      </div>
      <div className="flex flex-col justify-start flex-auto w-full h-[calc(100%-56px)]">
        <div className={`flex-auto px-[25px] w-screen h-full ${className || ''}`}>{children}</div>
      </div>
    </div>
  );
}

export default PageTitleBox;
