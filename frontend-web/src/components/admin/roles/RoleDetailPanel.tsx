import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Key, Users, Edit2, Save, X, Loader2, ShieldCheck } from 'lucide-react';
import {
  adminRoleService,
  Role,
  RoleDetail,
  Permission,
  GroupedPermissions,
  UpdateRoleRequest,
  UpdateRolePermissionsRequest,
} from '../../../api/adminRoleService';
import PermissionTree from './PermissionTree';
import RoleUsersTab from './RoleUsersTab';

interface RoleDetailPanelProps {
  role: Role;
  groupedPermissions?: GroupedPermissions;
  onRoleUpdate: () => void;
}

// 폼 스키마
const updateRoleSchema = z.object({
  displayName: z.string().min(1, '표시 이름을 입력하세요'),
  description: z.string().optional(),
  level: z
    .number()
    .min(1, '권한 레벨은 1 이상이어야 합니다')
    .max(100, '권한 레벨은 100 이하여야 합니다'),
  isActive: z.boolean(),
});

type UpdateRoleFormData = z.infer<typeof updateRoleSchema>;

const RoleDetailPanel: React.FC<RoleDetailPanelProps> = ({
  role,
  groupedPermissions,
  onRoleUpdate,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('info');
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // 역할 상세 정보 조회
  const { data: roleDetail, isLoading } = useQuery({
    queryKey: ['role-detail', role.id],
    queryFn: () => adminRoleService.getRoleById(role.id),
    enabled: !!role.id,
  });

  const form = useForm<UpdateRoleFormData>({
    resolver: zodResolver(updateRoleSchema),
  });

  // 역할 정보 업데이트 뮤테이션
  const updateRoleMutation = useMutation({
    mutationFn: (data: UpdateRoleRequest) => adminRoleService.updateRole(role.id, data),
    onSuccess: () => {
      toast({
        description: '역할 정보가 업데이트되었습니다.',
      });
      setIsEditing(false);
      queryClient.invalidateQueries(['role-detail', role.id]);
      onRoleUpdate();
    },
    onError: (error: any) => {
      toast({
        description: error.message || '역할 정보 업데이트에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 권한 업데이트 뮤테이션
  const updatePermissionsMutation = useMutation({
    mutationFn: (permissionIds: string[]) =>
      adminRoleService.updateRolePermissions(role.id, { permissionIds }),
    onSuccess: () => {
      toast({
        description: '권한이 업데이트되었습니다.',
      });
      queryClient.invalidateQueries(['role-detail', role.id]);
      onRoleUpdate();
    },
    onError: (error: any) => {
      toast({
        description: error.message || '권한 업데이트에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 폼 제출 핸들러
  const handleFormSubmit = (data: UpdateRoleFormData) => {
    updateRoleMutation.mutate(data);
  };

  // 권한 변경 핸들러
  const handlePermissionChange = (permissionIds: string[]) => {
    updatePermissionsMutation.mutate(permissionIds);
  };

  // 폼 초기화
  React.useEffect(() => {
    if (roleDetail && !isEditing) {
      form.reset({
        displayName: roleDetail.displayName,
        description: roleDetail.description || '',
        level: roleDetail.level,
        isActive: roleDetail.isActive,
      });
    }
  }, [roleDetail, isEditing, form]);

  if (isLoading || !roleDetail) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* 역할 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{roleDetail.displayName}</h2>
            <div className="flex gap-2">
              <Badge variant={roleDetail.isActive ? 'default' : 'secondary'}>
                {roleDetail.isActive ? '활성' : '비활성'}
              </Badge>
              {roleDetail.isDefault && (
                <Badge variant="outline">기본 역할</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">권한 수</p>
                <p className="text-lg font-bold">{roleDetail.permissions?.length || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">사용자 수</p>
                <p className="text-lg font-bold">{roleDetail.users?.length || 0}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="info">기본 정보</TabsTrigger>
          <TabsTrigger value="permissions">권한 설정</TabsTrigger>
          <TabsTrigger value="users">사용자 ({roleDetail.users?.length || 0})</TabsTrigger>
        </TabsList>

        {/* 기본 정보 탭 */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>역할 정보</CardTitle>
              <CardDescription>
                역할의 기본 정보를 수정할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roleId">역할 ID</Label>
                  <Input id="roleId" value={roleDetail.name} disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">표시 이름</Label>
                  <Input
                    id="displayName"
                    placeholder="역할 표시 이름"
                    disabled={!isEditing}
                    {...form.register('displayName')}
                  />
                  {form.formState.errors.displayName && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.displayName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">설명</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    placeholder="역할에 대한 설명을 입력하세요"
                    disabled={!isEditing}
                    {...form.register('description')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">권한 레벨</Label>
                  <Input
                    id="level"
                    type="number"
                    min={1}
                    max={100}
                    disabled={!isEditing}
                    {...form.register('level', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">
                    높을수록 상위 권한 (1-100)
                  </p>
                  {form.formState.errors.level && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.level.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    disabled={!isEditing}
                    checked={form.watch('isActive')}
                    onCheckedChange={(checked) => form.setValue('isActive', checked)}
                  />
                  <Label htmlFor="isActive">활성 상태</Label>
                </div>

                {roleDetail.isDefault && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">기본 역할</Badge>
                      <span className="text-sm text-muted-foreground">
                        이 역할은 시스템 기본 역할이므로 일부 설정을 변경할 수 없습니다.
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        type="submit"
                        disabled={updateRoleMutation.isPending}
                      >
                        {updateRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        저장
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditing(false);
                          form.reset();
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        취소
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      disabled={roleDetail.name === 'super_admin'}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      수정
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 권한 설정 탭 */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                권한 설정
              </CardTitle>
              <CardDescription>
                역할에 할당된 권한을 설정합니다. 권한 변경은 즉시 모든 사용자에게 적용됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groupedPermissions ? (
                <AlertDialog>
                  <PermissionTree
                    groupedPermissions={groupedPermissions}
                    selectedPermissions={roleDetail.permissions.map(p => p.id)}
                    onPermissionChange={(permissionIds) => {
                      // AlertDialog를 통해 확인 후 변경
                    }}
                    loading={updatePermissionsMutation.isPending}
                    disabled={roleDetail.name === 'super_admin'}
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>권한 변경 확인</AlertDialogTitle>
                      <AlertDialogDescription>
                        이 역할의 권한을 변경하시겠습니까? 해당 역할을 가진 모든 사용자에게 즉시 적용됩니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {/* handlePermissionChange */}}>
                        변경
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 사용자 탭 */}
        <TabsContent value="users">
          <RoleUsersTab
            roleId={role.id}
            roleName={role.displayName}
            onUserUpdate={onRoleUpdate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RoleDetailPanel;