import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AdminSidebar.css';

interface MenuItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  permission?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    key: 'dashboard',
    label: '대시보드',
    icon: '📊',
    path: '/admin',
    permission: 'admin.dashboard.view',
  },
  {
    key: 'users',
    label: '사용자 관리',
    icon: '👥',
    path: '/admin/users',
    permission: 'admin.users.view',
    children: [
      {
        key: 'users-list',
        label: '사용자 목록',
        icon: '📝',
        path: '/admin/users',
        permission: 'admin.users.view',
      },
      {
        key: 'users-approval',
        label: '승인 대기',
        icon: '⏳',
        path: '/admin/users/approval',
        permission: 'admin.users.approve',
      },
    ],
  },
  {
    key: 'roles',
    label: '역할 관리',
    icon: '🔐',
    path: '/admin/roles',
    permission: 'admin.roles.view',
  },
  {
    key: 'audit',
    label: '감사 로그',
    icon: '📋',
    path: '/admin/audit',
    permission: 'admin.audit.view',
  },
  {
    key: 'settings',
    label: '시스템 설정',
    icon: '⚙️',
    path: '/admin/settings',
    permission: 'admin.settings.view',
  },
];

const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['users']);

  const hasPermission = (permission?: string): boolean => {
    // TODO: 실제 권한 체크 로직 구현
    return true;
  };

  const toggleMenu = (key: string) => {
    setExpandedMenus(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.children) {
      toggleMenu(item.key);
    } else {
      navigate(item.path);
    }
  };

  const isActive = (path: string): boolean => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const renderMenuItem = (item: MenuItem, level = 0) => {
    if (!hasPermission(item.permission)) {
      return null;
    }

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.key);
    const active = isActive(item.path);

    return (
      <div key={item.key} className="menu-item-container">
        <div className={`menu-item ${active ? 'active' : ''} level-${level}`} onClick={() => handleMenuClick(item)}>
          <span className="menu-icon">{item.icon}</span>
          <span className="menu-label">{item.label}</span>
          {hasChildren && <span className={`menu-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>}
        </div>

        {hasChildren && isExpanded && (
          <div className="submenu">{item.children?.map(child => renderMenuItem(child, level + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-sidebar">
      <div className="sidebar-header">
        <h2>🔧 Admin Panel</h2>
      </div>

      <nav className="sidebar-nav">{menuItems.map(item => renderMenuItem(item))}</nav>

      <div className="sidebar-footer">
        <div className="version-info">Version 1.0.0</div>
      </div>
    </div>
  );
};

export default AdminSidebar;
