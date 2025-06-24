import React, { useState, useMemo } from 'react';
import { Tree, Button, Spin } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { GroupedPermissions, Permission } from '../../../api/adminRoleService';
import './PermissionTree.css';

interface PermissionTreeProps {
  groupedPermissions: GroupedPermissions;
  selectedPermissions: string[];
  onPermissionChange: (permissionIds: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
}

// 모듈명 한글 변환
const getModuleDisplayName = (module: string): string => {
  const moduleNames: Record<string, string> = {
    user: '사용자 관리',
    role: '역할 관리',
    dashboard: '대시보드',
    widget: '위젯',
    database: '데이터베이스',
    dataset: '데이터셋',
    admin: '관리자',
    analytics: '분석',
    system: '시스템',
  };
  return moduleNames[module] || module;
};

// 리소스명 한글 변환
const getResourceDisplayName = (resource: string): string => {
  const resourceNames: Record<string, string> = {
    users: '사용자',
    roles: '역할',
    permissions: '권한',
    dashboards: '대시보드',
    widgets: '위젯',
    databases: '데이터베이스',
    datasets: '데이터셋',
    reports: '리포트',
    settings: '설정',
    logs: '로그',
  };
  return resourceNames[resource] || resource;
};

const PermissionTree: React.FC<PermissionTreeProps> = ({
  groupedPermissions,
  selectedPermissions,
  onPermissionChange,
  loading = false,
  disabled = false,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<string[]>(selectedPermissions);

  // 트리 데이터 구성
  const treeData = useMemo(() => {
    const data: DataNode[] = [];

    Object.entries(groupedPermissions).forEach(([module, resources]) => {
      const moduleKey = `module-${module}`;
      const modulePermissionCount = Object.values(resources).flat().length;
      
      const moduleNode: DataNode = {
        title: (
          <div className="permission-module">
            <span className="module-name">{getModuleDisplayName(module)}</span>
            <span className="module-count">({modulePermissionCount}개 권한)</span>
          </div>
        ),
        key: moduleKey,
        children: [],
      };

      Object.entries(resources).forEach(([resource, permissions]) => {
        const resourceKey = `resource-${module}-${resource}`;
        
        const resourceNode: DataNode = {
          title: (
            <div className="permission-resource">
              <span className="resource-name">{getResourceDisplayName(resource)}</span>
              <span className="resource-count">({permissions.length}개)</span>
            </div>
          ),
          key: resourceKey,
          children: permissions.map(permission => ({
            title: (
              <div className="permission-item">
                <span className="permission-name">{permission.displayName}</span>
                <span className="permission-description">{permission.description}</span>
              </div>
            ),
            key: permission.id,
            isLeaf: true,
          })),
        };

        moduleNode.children!.push(resourceNode);
      });

      data.push(moduleNode);
    });

    return data;
  }, [groupedPermissions]);

  // 체크 핸들러
  const handleCheck = (checkedKeysValue: any) => {
    // 리프 노드(실제 권한)만 필터링
    const permissionIds = checkedKeysValue.filter((key: string) => 
      !key.startsWith('module-') && !key.startsWith('resource-')
    );
    setCheckedKeys(checkedKeysValue);
    onPermissionChange(permissionIds);
  };

  // 모듈별 전체 선택/해제
  const handleSelectAllInModule = (module: string) => {
    const modulePermissions = Object.values(groupedPermissions[module] || {})
      .flat()
      .map(p => p.id);
    
    const allModuleKeys = [
      `module-${module}`,
      ...Object.keys(groupedPermissions[module] || {}).map(resource => 
        `resource-${module}-${resource}`
      ),
      ...modulePermissions,
    ];
    
    const newCheckedKeys = [...new Set([...checkedKeys, ...allModuleKeys])];
    setCheckedKeys(newCheckedKeys);
    
    const permissionIds = newCheckedKeys.filter(key => 
      !key.startsWith('module-') && !key.startsWith('resource-')
    );
    onPermissionChange(permissionIds);
  };

  // 모듈별 전체 해제
  const handleDeselectAllInModule = (module: string) => {
    const modulePermissions = Object.values(groupedPermissions[module] || {})
      .flat()
      .map(p => p.id);
    
    const moduleKeys = [
      `module-${module}`,
      ...Object.keys(groupedPermissions[module] || {}).map(resource => 
        `resource-${module}-${resource}`
      ),
      ...modulePermissions,
    ];
    
    const newCheckedKeys = checkedKeys.filter(key => !moduleKeys.includes(key));
    setCheckedKeys(newCheckedKeys);
    
    const permissionIds = newCheckedKeys.filter(key => 
      !key.startsWith('module-') && !key.startsWith('resource-')
    );
    onPermissionChange(permissionIds);
  };

  return (
    <div className="permission-tree">
      <div className="permission-tree-header">
        <div className="bulk-actions">
          <Button
            size="small"
            onClick={() => {
              const allKeys = treeData.map(node => node.key as string);
              setExpandedKeys(allKeys);
            }}
          >
            모두 펼치기
          </Button>
          <Button
            size="small"
            onClick={() => setExpandedKeys([])}
          >
            모두 접기
          </Button>
        </div>
      </div>

      <Tree
        checkable
        disabled={disabled}
        checkedKeys={checkedKeys}
        expandedKeys={expandedKeys}
        onExpand={setExpandedKeys}
        onCheck={handleCheck}
        treeData={treeData}
        className="permission-tree-content"
        titleRender={(nodeData: any) => {
          if (nodeData.key.startsWith('module-')) {
            const module = nodeData.key.replace('module-', '');
            return (
              <div className="tree-node-title">
                {nodeData.title}
                {!disabled && (
                  <div className="module-actions" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="small"
                      type="text"
                      onClick={() => handleSelectAllInModule(module)}
                    >
                      전체 선택
                    </Button>
                    <Button
                      size="small"
                      type="text"
                      onClick={() => handleDeselectAllInModule(module)}
                    >
                      전체 해제
                    </Button>
                  </div>
                )}
              </div>
            );
          }
          return nodeData.title;
        }}
      />

      {loading && (
        <div className="permission-tree-loading">
          <Spin size="small" />
          <span>권한 업데이트 중...</span>
        </div>
      )}
    </div>
  );
};

export default PermissionTree;