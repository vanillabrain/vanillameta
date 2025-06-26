import React, { useEffect, useState, useCallback, useMemo } from 'react';
import BoardItem from './BoardItem';
import { MAX_WIDTH } from '@/constant';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const tableBorder = '1px solid #DADDDD';

interface BoardListProps {
  postList: any[];
  handleDeleteSelect: (id: any, title?: any) => void;
}

function BoardList(props: BoardListProps) {
  const { postList, handleDeleteSelect } = props;
  const [totalCount, setTotalCount] = useState(1);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setTotalCount(Math.ceil(postList.length / 10));
  }, [postList]);

  const matches = typeof window !== 'undefined' ? window.innerWidth >= 640 : true;

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const boardItems = useMemo(() => {
    return postList.map((item, index) => {
      const currPage = (page - 1) * 10;
      if (index >= currPage && index < currPage + 10) {
        return <BoardItem key={item.id} data={item} handleDeleteSelect={handleDeleteSelect} />;
      } else {
        return null;
      }
    });
  }, [postList, page, handleDeleteSelect]);

  return (
    <div className="w-full mx-auto" style={{ maxWidth: MAX_WIDTH }}>
      <div className="flex flex-row justify-between w-full px-5 pr-[60px] sm:pr-[216px] mb-[11px] mt-[21px] sm:mt-9">
        <span
          className="text-[10px] sm:text-[13px] font-medium leading-[1.23] text-[#767676]"
          style={{
            marginLeft: matches && Boolean(postList?.[0]?.componentType) ? '50px' : '0',
          }}
        >
          이름
        </span>
        <span className="text-[10px] sm:text-[13px] font-medium leading-[1.23] text-[#767676]">수정일</span>
      </div>
      <div className="w-full mx-auto rounded-lg bg-white p-0" style={{ border: tableBorder }}>
        {boardItems}
      </div>
      <div className="flex items-center justify-center mt-[47px]">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: totalCount }, (_, i) => i + 1).map(pageNum => (
            <Button
              key={pageNum}
              variant={page === pageNum ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePageChange(pageNum)}
              className="h-8 w-8 p-0"
            >
              {pageNum}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalCount}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(BoardList);
