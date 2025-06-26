import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tree, TreeNode } from '@/components/ui/tree';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GroupedPermissions, Permission } from '../../../api/adminRoleService';

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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set(selectedPermissions));

  // 트리 데이터 구성
  const treeData = useMemo(() => {
    const data: TreeNode[] = [];

    Object.entries(groupedPermissions).forEach(([module, resources]) => {
      const moduleKey = `module-${module}`;
      const modulePermissionCount = Object.values(resources).flat().length;

      const moduleNode: TreeNode = {
        id: moduleKey,
        label: (
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col">
              <span className="font-medium">{getModuleDisplayName(module)}</span>
              <span className="text-xs text-muted-foreground">{modulePermissionCount}개 권한</span>
            </div>
          </div>
        ),
        children: [],
      };

      Object.entries(resources).forEach(([resource, permissions]) => {
        const resourceKey = `resource-${module}-${resource}`;

        const resourceNode: TreeNode = {
          id: resourceKey,
          label: (
            <div className="flex items-center justify-between w-full">
              <span className="font-medium">{getResourceDisplayName(resource)}</span>
              <span className="text-xs text-muted-foreground">{permissions.length}개</span>
            </div>
          ),
          children: permissions.map(permission => ({
            id: permission.id,
            label: (
              <div className="flex flex-col">
                <span className="text-sm">{permission.displayName}</span>
                <span className="text-xs text-muted-foreground">{permission.description}</span>
              </div>
            ),
          })),
        };

        moduleNode.children!.push(resourceNode);
      });

      data.push(moduleNode);
    });

    return data;
  }, [groupedPermissions]);

  // 체크 핸들러
  const handleNodeCheck = (nodeId: string, checked: boolean) => {
    const newCheckedKeys = new Set(checkedKeys);

    // 실제 권한 ID인지 확인
    const isPermission = !nodeId.startsWith('module-') && !nodeId.startsWith('resource-');

    if (isPermission) {
      if (checked) {
        newCheckedKeys.add(nodeId);
      } else {
        newCheckedKeys.delete(nodeId);
      }
    } else {
      // 모듈이나 리소스의 경우 하위 권한들도 함께 처리
      const updateChildNodes = (node: TreeNode, check: boolean) => {
        if (node.children) {
          node.children.forEach(child => {
            if (!child.id.startsWith('module-') && !child.id.startsWith('resource-')) {
              if (check) {
                newCheckedKeys.add(child.id);
              } else {
                newCheckedKeys.delete(child.id);
              }
            }
            updateChildNodes(child, check);
          });
        }
      };

      const findAndUpdateNode = (nodes: TreeNode[], targetId: string) => {
        for (const node of nodes) {
          if (node.id === targetId) {
            updateChildNodes(node, checked);
            return;
          }
          if (node.children) {
            findAndUpdateNode(node.children, targetId);
          }
        }
      };

      findAndUpdateNode(treeData, nodeId);
    }

    setCheckedKeys(newCheckedKeys);

    // 실제 권한 ID만 필터링하여 콜백
    const permissionIds = Array.from(newCheckedKeys).filter(
      key => !key.startsWith('module-') && !key.startsWith('resource-'),
    );
    onPermissionChange(permissionIds);
  };

  // 확장/축소 핸들러
  const handleNodeExpand = (nodeId: string, expanded: boolean) => {
    const newExpandedKeys = new Set(expandedKeys);
    if (expanded) {
      newExpandedKeys.add(nodeId);
    } else {
      newExpandedKeys.delete(nodeId);
    }
    setExpandedKeys(newExpandedKeys);
  };

  // 전체 확장/축소
  const expandAll = () => {
    const allKeys = new Set<string>();
    const collectKeys = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          allKeys.add(node.id);
          collectKeys(node.children);
        }
      });
    };
    collectKeys(treeData);
    setExpandedKeys(allKeys);
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  // 권한 체크 상태 확인
  const getCheckedState = (node: TreeNode): boolean | 'indeterminate' => {
    if (!node.children || node.children.length === 0) {
      return checkedKeys.has(node.id);
    }

    let checkedCount = 0;
    let totalCount = 0;

    const countChecked = (children: TreeNode[]) => {
      children.forEach(child => {
        if (!child.children || child.children.length === 0) {
          totalCount++;
          if (checkedKeys.has(child.id)) {
            checkedCount++;
          }
        } else {
          countChecked(child.children);
        }
      });
    };

    countChecked(node.children);

    if (checkedCount === 0) return false;
    if (checkedCount === totalCount) return true;
    return 'indeterminate';
  };

  // 수정된 트리 데이터 (체크 상태 포함)
  const treeDataWithChecked = useMemo(() => {
    const addCheckedState = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => ({
        ...node,
        checked: getCheckedState(node),
        expanded: expandedKeys.has(node.id),
        children: node.children ? addCheckedState(node.children) : undefined,
      }));
    };
    return addCheckedState(treeData);
  }, [treeData, checkedKeys, expandedKeys]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">권한 설정</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={expandAll} disabled={disabled}>
            모두 펼치기
          </Button>
          <Button size="sm" variant="outline" onClick={collapseAll} disabled={disabled}>
            모두 접기
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[500px] rounded-md border">
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
              <span className="ml-2 text-sm text-muted-foreground">권한 업데이트 중...</span>
            </div>
          ) : (
            <Tree
              data={treeDataWithChecked}
              onNodeCheck={handleNodeCheck}
              onNodeExpand={handleNodeExpand}
              showCheckbox={!disabled}
              className="space-y-2"
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PermissionTree;
