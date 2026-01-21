import React from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import DeleteButton from '@/components/button/DeleteButton';
import ModifyButton from '@/components/button/ModifyButton';
import { dateData } from '@/utils/util';

interface BoardItemDataProps {
  id: string;
  title: string;
  updatedAt: string;
  componentType?: string;
  icon?: string;
}

interface BoardItemProps {
  data: BoardItemDataProps;
  handleDeleteSelect: (id, title) => void;
  key?: string | number;
}

const tableBorder = '1px solid #DADDDD';

interface TitleSpanProps {
  children: React.ReactNode;
}


const IconRowHeader = ({ icon }) => {
  return (
    <div className="min-w-[24px] mr-[18px]">
      <img
        src={`static/images/${icon}`}
        className="w-auto h-[30px] rounded-none object-contain bg-transparent"
        alt=""
      />
    </div>
  );
};

function BoardItem(props: BoardItemProps) {
  const { data, handleDeleteSelect } = props;
  const { id, title, componentType, icon, updatedAt } = data;

  const matches = typeof window !== 'undefined' ? window.innerWidth >= 640 : true;
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <RouterLink
      to={`${id}`}
      state={{ from: pathname }}
      className="block py-5 sm:py-[7px] px-4 sm:px-5 sm:pr-7 border-b border-[#DADDDD] last:border-b-0 hover:bg-gray-50 transition-colors"
    >
      <div className="flex flex-row items-center justify-between w-full">
        <div className={`flex flex-row items-center w-full ${matches ? 'max-w-[calc(100%-300px)]' : 'max-w-[calc(100%-110px)]'}`}>
          {matches && componentType && <IconRowHeader icon={icon} />}
          {matches ? (
            <span
              className="block flex-grow-0 w-full h-[14px] text-sm font-semibold leading-[1.14] text-[#333333] overflow-hidden whitespace-nowrap text-ellipsis"
            >
              {title}
            </span>
          ) : (
            <span
              className="block flex-grow-0 w-full text-sm font-semibold leading-[1.43] text-[#333333]"
            >
              {title}
            </span>
          )}
        </div>
        <div className="flex items-center flex-row">
          <span
            className={`flex h-[14px] justify-between font-medium leading-[1.14] text-[#333333] ${matches ? 'text-sm' : 'text-[10px]'}`}
          >
            {dateData(updatedAt)}
          </span>
          {matches && (
            <div className="flex flex-row gap-[18px] ml-12">
              <ModifyButton
                size="default"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  navigate(`modify?id=${id}&title=${title}`, { state: { from: pathname } });
                }}
              />
              <DeleteButton
                size="default"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleDeleteSelect(id, title);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </RouterLink>
  );
}

export default BoardItem;
