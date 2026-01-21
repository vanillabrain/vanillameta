import React, { useState } from 'react';
import './UserFilters.css';

interface UserFilters {
  page: number;
  limit: number;
  search: string;
  status?: string;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

interface UserFiltersProps {
  filters: UserFilters;
  onFilterChange: (filters: Partial<UserFilters>) => void;
}

const UserFilters: React.FC<UserFiltersProps> = ({ filters, onFilterChange }) => {
  const [searchValue, setSearchValue] = useState(filters.search);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    // 실시간 검색을 위해 디바운싱
    setTimeout(() => {
      onFilterChange({ search: value });
    }, 300);
  };

  const handleStatusChange = (status: string) => {
    onFilterChange({ status: status === 'all' ? undefined : status });
  };

  const handleSortChange = (sortBy: string) => {
    const newSortOrder = filters.sortBy === sortBy && filters.sortOrder === 'ASC' ? 'DESC' : 'ASC';
    onFilterChange({ sortBy, sortOrder: newSortOrder });
  };

  const handleLimitChange = (limit: number) => {
    onFilterChange({ limit });
  };

  const handleClearFilters = () => {
    setSearchValue('');
    onFilterChange({
      search: '',
      status: undefined,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      page: 1
    });
  };

  const getSortIcon = (columnName: string) => {
    if (filters.sortBy !== columnName) {
      return '↕️';
    }
    return filters.sortOrder === 'ASC' ? '↑' : '↓';
  };

  const hasActiveFilters = filters.search || filters.status;

  return (
    <div className="user-filters">
      <div className="filters-row">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="이메일 또는 사용자 ID로 검색..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filter-group">
          <label htmlFor="status-filter">상태:</label>
          <select
            id="status-filter"
            className="filter-select"
            value={filters.status || 'all'}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
            <option value="pending">승인 대기</option>
            <option value="suspended">정지</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="limit-filter">표시 개수:</label>
          <select
            id="limit-filter"
            className="filter-select"
            value={filters.limit}
            onChange={(e) => handleLimitChange(parseInt(e.target.value))}
          >
            <option value={10}>10개</option>
            <option value={20}>20개</option>
            <option value={50}>50개</option>
            <option value={100}>100개</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            className="clear-filters-btn"
            onClick={handleClearFilters}
            title="필터 초기화"
          >
            🗑️ 초기화
          </button>
        )}
      </div>

      <div className="sort-row">
        <span className="sort-label">정렬:</span>
        <div className="sort-buttons">
          <button
            className={`sort-btn ${filters.sortBy === 'email' ? 'active' : ''}`}
            onClick={() => handleSortChange('email')}
          >
            이메일 {getSortIcon('email')}
          </button>
          <button
            className={`sort-btn ${filters.sortBy === 'userId' ? 'active' : ''}`}
            onClick={() => handleSortChange('userId')}
          >
            사용자 ID {getSortIcon('userId')}
          </button>
          <button
            className={`sort-btn ${filters.sortBy === 'createdAt' ? 'active' : ''}`}
            onClick={() => handleSortChange('createdAt')}
          >
            가입일 {getSortIcon('createdAt')}
          </button>
          <button
            className={`sort-btn ${filters.sortBy === 'updatedAt' ? 'active' : ''}`}
            onClick={() => handleSortChange('updatedAt')}
          >
            수정일 {getSortIcon('updatedAt')}
          </button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="active-filters">
          <span className="active-filters-label">활성 필터:</span>
          {filters.search && (
            <span className="filter-tag">
              검색: "{filters.search}"
              <button onClick={() => handleSearchChange('')}>×</button>
            </span>
          )}
          {filters.status && (
            <span className="filter-tag">
              상태: {filters.status}
              <button onClick={() => handleStatusChange('all')}>×</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default UserFilters;