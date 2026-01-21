import React from 'react';
import { Button, ButtonProps, Tooltip } from '@mui/material';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionButtonProps extends ButtonProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  hideOnNoPermission?: boolean;
  tooltipOnDisabled?: string;
}

/**
 * 권한 기반 버튼 컴포넌트
 * 권한이 없는 경우 버튼을 비활성화하거나 숨깁니다.
 * 
 * @example
 * // 단일 권한 확인
 * <PermissionButton 
 *   permission="admin.users.create"
 *   onClick={handleCreateUser}
 * >
 *   사용자 생성
 * </PermissionButton>
 * 
 * @example
 * // 권한이 없으면 숨기기
 * <PermissionButton 
 *   permission="admin.users.delete"
 *   hideOnNoPermission
 *   color="error"
 *   onClick={handleDelete}
 * >
 *   삭제
 * </PermissionButton>
 */
export const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  permissions = [],
  requireAll = false,
  hideOnNoPermission = false,
  tooltipOnDisabled = '이 작업을 수행할 권한이 없습니다',
  children,
  disabled,
  ...buttonProps
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // 권한 확인
  let hasAccess = true;
  
  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  // 권한이 없고 숨기기 옵션이 활성화된 경우
  if (!hasAccess && hideOnNoPermission) {
    return null;
  }

  // 권한이 없거나 이미 비활성화된 경우
  const isDisabled = !hasAccess || disabled;

  const button = (
    <Button
      {...buttonProps}
      disabled={isDisabled}
    >
      {children}
    </Button>
  );

  // 권한 때문에 비활성화된 경우 툴팁 표시
  if (!hasAccess && tooltipOnDisabled) {
    return (
      <Tooltip title={tooltipOnDisabled}>
        <span>{button}</span>
      </Tooltip>
    );
  }

  return button;
};

interface PermissionIconButtonProps extends Omit<ButtonProps, 'variant'> {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  hideOnNoPermission?: boolean;
  tooltipOnDisabled?: string;
  icon: React.ReactNode;
  tooltip?: string;
}

/**
 * 권한 기반 아이콘 버튼 컴포넌트
 * 
 * @example
 * <PermissionIconButton
 *   permission="admin.users.edit"
 *   icon={<Edit />}
 *   tooltip="수정"
 *   onClick={handleEdit}
 * />
 */
export const PermissionIconButton: React.FC<PermissionIconButtonProps> = ({
  permission,
  permissions = [],
  requireAll = false,
  hideOnNoPermission = false,
  tooltipOnDisabled = '이 작업을 수행할 권한이 없습니다',
  icon,
  tooltip,
  disabled,
  ...buttonProps
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let hasAccess = true;
  
  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  if (!hasAccess && hideOnNoPermission) {
    return null;
  }

  const isDisabled = !hasAccess || disabled;
  const tooltipTitle = !hasAccess ? tooltipOnDisabled : tooltip;

  const button = (
    <Button
      {...buttonProps}
      variant="text"
      disabled={isDisabled}
      sx={{
        minWidth: 'auto',
        p: 1,
        ...buttonProps.sx,
      }}
    >
      {icon}
    </Button>
  );

  if (tooltipTitle) {
    return (
      <Tooltip title={tooltipTitle}>
        <span>{button}</span>
      </Tooltip>
    );
  }

  return button;
};