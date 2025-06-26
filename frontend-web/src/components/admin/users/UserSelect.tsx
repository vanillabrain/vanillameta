import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { debounce } from 'lodash';
import { cn } from '@/lib/utils';
import { adminUsersService } from '../../../api/adminUsersService';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';

interface UserSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  disabled?: boolean;
  showEmail?: boolean;
  multiple?: boolean;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export const UserSelect: React.FC<UserSelectProps> = ({
  value,
  onChange,
  placeholder = '사용자 검색',
  allowClear = true,
  className,
  disabled,
  showEmail = true,
  multiple = false,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<UserOption[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);

  // 사용자 검색
  const searchUsers = async (search: string) => {
    if (!search || search.length < 2) {
      setOptions([]);
      return;
    }

    try {
      setLoading(true);
      const response = await adminUsersService.getUsers({
        search,
        limit: 20,
        page: 1,
      });

      const userOptions: UserOption[] = response.data.map(user => ({
        id: user.id,
        name: user.name || user.userId || 'Unknown',
        email: user.email,
        avatar: user.avatar,
      }));

      setOptions(userOptions);
    } catch (error) {
      console.error('Failed to search users:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // 디바운스된 검색 함수
  const debouncedSearch = React.useMemo(
    () => debounce(searchUsers, 300),
    []
  );

  // 검색어 변경 핸들러
  const handleSearch = (value: string) => {
    setSearchValue(value);
    debouncedSearch(value);
  };

  // 초기 사용자 로드 (value가 있을 경우)
  useEffect(() => {
    if (value && !selectedUser) {
      // 선택된 사용자 정보 로드
      const loadSelectedUser = async () => {
        try {
          const user = await adminUsersService.getUserById(value);
          const userOption = {
            id: user.id,
            name: user.name || user.userId || 'Unknown',
            email: user.email,
            avatar: user.avatar,
          };
          setSelectedUser(userOption);
          setOptions([userOption]);
        } catch (error) {
          console.error('Failed to load selected user:', error);
        }
      };
      loadSelectedUser();
    }
  }, [value, selectedUser]);

  const handleSelect = (userId: string) => {
    const user = options.find(opt => opt.id === userId);
    if (user) {
      setSelectedUser(user);
      onChange?.(userId);
      setOpen(false);
    }
  };

  const handleClear = () => {
    setSelectedUser(null);
    onChange?.('');
    setSearchValue('');
    setOptions([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedUser ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <Avatar className="h-5 w-5">
                <AvatarImage src={selectedUser.avatar} />
                <AvatarFallback>
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedUser.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          {allowClear && selectedUser && !disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="ml-auto h-4 w-4 hover:text-destructive"
            >
              ×
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput
            placeholder="사용자 검색..."
            value={searchValue}
            onValueChange={handleSearch}
          />
          <CommandEmpty>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : searchValue.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                2글자 이상 입력해주세요
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                검색 결과가 없습니다
              </div>
            )}
          </CommandEmpty>
          {!loading && options.length > 0 && (
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={handleSelect}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={option.avatar} />
                      <AvatarFallback>
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium truncate">{option.name}</div>
                      {showEmail && (
                        <div className="text-xs text-muted-foreground truncate">
                          {option.email}
                        </div>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};