import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Key, Copy, Trash2, Search, Loader2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  adminRoleService,
  Role,
  RoleWithStats,
  RoleDetail,
  Permission,
  GroupedPermissions,
  CreateRoleRequest,
  CloneRoleRequest,
  RoleDeletionImpact,
} from '../../../api/adminRoleService';
import RoleDetailPanel from './RoleDetailPanel';
import CreateRoleModal from './CreateRoleModal';
import CloneRoleModal from './CloneRoleModal';

const RoleManagementV2: React.FC = () => {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState<Role | null>(null);
  const [deleteDialogRole, setDeleteDialogRole] = useState<Role | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    isActive: undefined as boolean | undefined,
  });
  
  const queryClient = useQueryClient();

  // 역할 목록 조회
  const { data: roles, isLoading, refetch } = useQuery({
    queryKey: ['admin-roles', filters],
    queryFn: () => adminRoleService.getRoles(filters),
    placeholderData: (previousData: any) => previousData,
  });

  // 그룹화된 권한 조회
  const { data: groupedPermissions } = useQuery({
    queryKey: ['grouped-permissions'],
    queryFn: () => adminRoleService.getGroupedPermissions(),
    staleTime: 5 * 60 * 1000, // 5분
  });

  // 역할 삭제 뮤테이션
  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => adminRoleService.deleteRole(roleId),
    onSuccess: () => {
      toast({
        description: '역할이 삭제되었습니다.',
      });
      queryClient.invalidateQueries(['admin-roles']);
      setSelectedRole(null);
      setDeleteDialogRole(null);
    },
    onError: (error: any) => {
      toast({
        description: error.message || '역할 삭제에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 역할 삭제 핸들러
  const handleDeleteRole = async (role: Role) => {
    try {
      const impact = await adminRoleService.getRoleDeletionImpact(role.id);
      
      if (!impact.canDelete) {
        toast({
          title: '역할 삭제 불가',
          description: `이 역할은 삭제할 수 없습니다: ${impact.warnings.join(', ')}`,
          variant: 'destructive',
        });
        return;
      }

      setDeleteDialogRole(role);
    } catch (error) {
      toast({
        description: '삭제 영향도 분석 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            역할 관리
          </h1>
          <p className="text-muted-foreground mt-2">
            시스템 내 역할과 권한을 직관적으로 관리합니다.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          새 역할 생성
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 역할 목록 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>역할 목록</CardTitle>
              <CardDescription>
                관리할 역할을 선택하세요
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="역할 이름 또는 설명으로 검색"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-8"
                />
              </div>

              {/* 역할 리스트 */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : roles?.length ? (
                  roles.map((role) => (
                    <Card
                      key={role.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-accent",
                        selectedRole?.id === role.id && "ring-2 ring-primary bg-accent"
                      )}
                      onClick={() => setSelectedRole(role)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* 역할 정보 */}
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="font-semibold">{role.displayName}</h3>
                              <p className="text-sm text-muted-foreground">{role.name}</p>
                            </div>
                            <div className="flex gap-1">
                              <Badge variant={role.isActive ? 'default' : 'secondary'}>
                                {role.isActive ? '활성' : '비활성'}
                              </Badge>
                              {role.isDefault && (
                                <Badge variant="outline">기본</Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* 통계 */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{role.userCount || 0}명</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Key className="h-3 w-3" />
                              <span>{role.permissionCount || 0}개</span>
                            </div>
                          </div>
                          
                          {/* 설명 */}
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {role.description || '설명 없음'}
                          </p>
                          
                          {/* 액션 */}
                          <Separator />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCloneModal(role);
                              }}
                            >
                              <Copy className="mr-1 h-3 w-3" />
                              복사
                            </Button>
                            {!role.isDefault && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRole(role);
                                }}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                삭제
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>역할이 없습니다</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 역할 상세 */}
        <div className="lg:col-span-2">
          {selectedRole ? (
            <RoleDetailPanel
              role={selectedRole}
              groupedPermissions={groupedPermissions}
              onRoleUpdate={() => queryClient.invalidateQueries(['admin-roles'])}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">역할을 선택하세요</h3>
                  <p className="text-muted-foreground">
                    왼쪽 목록에서 역할을 선택하면 상세 정보를 볼 수 있습니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 모달들 */}
      {showCreateModal && (
        <CreateRoleModal
          groupedPermissions={groupedPermissions}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
          }}
        />
      )}

      {showCloneModal && (
        <CloneRoleModal
          sourceRole={showCloneModal}
          onClose={() => setShowCloneModal(null)}
          onSuccess={() => {
            setShowCloneModal(null);
            queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
          }}
        />
      )}

      {/* 삭제 확인 대화상자 */}
      <AlertDialog open={!!deleteDialogRole} onOpenChange={() => setDeleteDialogRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역할 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDialogRole?.displayName}" 역할을 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialogRole) {
                  deleteRoleMutation.mutate(deleteDialogRole.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoleManagementV2;