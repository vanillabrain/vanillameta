import React from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { dateData } from '@/utils/util';
import { cn } from '@/lib/utils';

interface BoardItemDataProps {
  id: string | number;
  title: string;
  updatedAt: string;
  componentType?: string;
  icon?: string;
}

interface BoardItemProps {
  data: BoardItemDataProps;
  handleDeleteSelect: (id, title) => void;
}

const TitleSpan = ({ children, className = '' }) => (
  <span className={cn('block w-full truncate text-sm leading-tight font-semibold text-[#333]', className)}>{children}</span>
);

const SubTitleSpan = ({ children, className = '' }) => (
  <span
    className={cn('flex h-[14px] items-center justify-between text-sm leading-tight font-medium text-[#333]', className)}
  >
    {children}
  </span>
);

const IconRowHeader = ({ icon }) => (
  <span className="mr-[18px] flex w-6 shrink-0 items-center justify-center">
    <img src={'static/images/' + icon} alt="" className="h-[30px] w-auto rounded-none bg-transparent object-contain" />
  </span>
);

function BoardItem(props: BoardItemProps) {
  const { data, handleDeleteSelect } = props;
  const { id, title, componentType, icon, updatedAt } = data;
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <li className="border-b border-[#DADDDD] px-4 py-5 last:border-b-0 sm:px-5 sm:py-[7px] sm:pr-7">
      <RouterLink className="flex w-full flex-row items-center justify-between" to={String(id)} state={{ from: pathname }}>
        <span className="flex w-full max-w-[calc(100%-110px)] flex-row items-center sm:max-w-[calc(100%-300px)]">
          {componentType && <IconRowHeader icon={icon} />}
          <TitleSpan className="sm:truncate">{title}</TitleSpan>
        </span>
        <span className="flex flex-row items-center">
          <SubTitleSpan className="max-sm:text-[10px]">{dateData(updatedAt)}</SubTitleSpan>
          <span className="hidden items-center gap-[18px] sm:flex sm:ml-12">
            <ModifyButton
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                navigate('modify?id=' + id + '&title=' + title, { state: { from: pathname } });
              }}
            />
            <DeleteButton
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                handleDeleteSelect(id, title);
              }}
            />
          </span>
        </span>
      </RouterLink>
    </li>
  );
}

export default BoardItem;
