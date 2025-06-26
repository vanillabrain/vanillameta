import React from 'react';

interface TitleBoxProps {
  title?: string;
  width?: string;
  button?: React.ReactNode;
  children?: React.ReactNode;
}

function TitleBox(props: TitleBoxProps) {
  const { title = '', width = '100%', button, children } = props;

  return (
    <div className="h-full" style={{ width }}>
      <div className="flex flex-row justify-between items-center w-full py-2">
        <span className="text-lg font-medium">{title}</span>
        {button}
      </div>
      <div className="border-b border-gray-200 mb-8" />
      {children}
    </div>
  );
}

export default TitleBox;
