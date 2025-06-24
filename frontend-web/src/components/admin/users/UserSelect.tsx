import React, { useState, useEffect } from 'react';
import { Select, Spin, Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { debounce } from 'lodash';
import { adminUsersService } from '../../../api/adminUsersService';

interface UserSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  style?: React.CSSProperties;
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
  style,
  disabled,
  showEmail = true,
  multiple = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<UserOption[]>([]);
  const [searchValue, setSearchValue] = useState('');

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
        name: user.name || user.username || 'Unknown',
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
    if (value && !options.find(opt => opt.id === value)) {
      // 선택된 사용자 정보 로드
      const loadSelectedUser = async () => {
        try {
          const user = await adminUsersService.getUserById(value);
          setOptions([{
            id: user.id,
            name: user.name || user.username || 'Unknown',
            email: user.email,
            avatar: user.avatar,
          }]);
        } catch (error) {
          console.error('Failed to load selected user:', error);
        }
      };
      loadSelectedUser();
    }
  }, [value]);

  // 옵션 렌더링
  const renderOption = (option: UserOption) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar 
        size="small" 
        src={option.avatar} 
        icon={<UserOutlined />}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{option.name}</div>
        {showEmail && (
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{option.email}</div>
        )}
      </div>
    </div>
  );

  return (
    <Select
      mode={multiple ? 'multiple' : undefined}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowClear={allowClear}
      style={style}
      disabled={disabled}
      loading={loading}
      showSearch
      searchValue={searchValue}
      onSearch={handleSearch}
      filterOption={false}
      notFoundContent={
        loading ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Spin size="small" />
          </div>
        ) : searchValue.length < 2 ? (
          <div style={{ textAlign: 'center', padding: '8px 0', color: '#8c8c8c' }}>
            2글자 이상 입력해주세요
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0', color: '#8c8c8c' }}>
            검색 결과가 없습니다
          </div>
        )
      }
    >
      {options.map(option => (
        <Select.Option key={option.id} value={option.id}>
          {renderOption(option)}
        </Select.Option>
      ))}
    </Select>
  );
};