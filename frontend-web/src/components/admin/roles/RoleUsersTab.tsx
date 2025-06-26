import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Trash2, Search, Loader2, CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import moment from 'moment';
import { adminRoleService, UserBasic, AssignUsersToRoleRequest } from '../../../api/adminRoleService';
import { adminUsersService } from '../../../api/adminUsersService';

interface RoleUsersTabProps {
  roleId: string;
  roleName: string;
  onUserUpdate: () => void;
}

const RoleUsersTab: React.FC<RoleUsersTabProps> = ({ roleId, roleName, onUserUpdate }) => {
  const { toast } = useToast();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [removeUserDialog, setRemoveUserDialog] = useState<UserBasic | null>(null);
  const queryClient = useQueryClient();

  // 역할 사용자 조회
  const { data: roleUsers, isLoading } = useQuery({
    queryKey: ['role-users', roleId, page, searchText],
    queryFn: () =>
      adminRoleService.getRoleUsers(roleId, {
        page,
        limit: 10,
        search: searchText,
      }),
    placeholderData: (previousData: any) => previousData,
  });

  // 전체 사용자 조회 (할당 모달용)
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-role'],
    queryFn: () => adminUsersService.getUsers({ limit: 100 }),
    enabled: showAssignModal,
  });

  // 사용자 역할 할당 뮤테이션
  const assignUsersMutation = useMutation({
    mutationFn: (data: AssignUsersToRoleRequest) => adminRoleService.assignUsersToRole(roleId, data),
    onSuccess: () => {
      toast({
        description: '사용자가 역할에 할당되었습니다.',
      });
      queryClient.invalidateQueries({ queryKey: ['role-users', roleId] });
      setShowAssignModal(false);
      setSelectedUserIds([]);
      setExpiresAt(undefined);
      onUserUpdate();
    },
    onError: (error: any) => {
      toast({
        description: error.message || '사용자 할당에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 사용자 제거 뮤테이션
  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => adminRoleService.removeUserFromRole(roleId, userId),
    onSuccess: () => {
      toast({
        description: '사용자가 역할에서 제거되었습니다.',
      });
      queryClient.invalidateQueries({ queryKey: ['role-users', roleId] });
      setRemoveUserDialog(null);
      onUserUpdate();
    },
    onError: (error: any) => {
      toast({
        description: error.message || '사용자 제거에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 사용자 제거 핸들러
  const handleRemoveUser = (user: UserBasic) => {
    setRemoveUserDialog(user);
  };

  // 사용자 할당 핸들러
  const handleAssignUsers = () => {
    if (selectedUserIds.length === 0) {
      toast({
        description: '할당할 사용자를 선택하세요.',
        variant: 'destructive',
      });
      return;
    }

    const assignData: AssignUsersToRoleRequest = {
      userIds: selectedUserIds,
      ...(expiresAt && { expiresAt: expiresAt.toISOString() }),
    };

    assignUsersMutation.mutate(assignData);
  };

  // 현재 역할을 가지지 않은 사용자 필터링
  const availableUsers =
    (allUsers as any)?.data?.filter(
      (user: any) => !(roleUsers as any)?.data?.some((roleUser: any) => roleUser.id === user.id.toString()),
    ) || [];

  // 현재 페이지의 사용자들
  const currentPageUsers = (roleUsers as any)?.data || [];
  const totalUsers = (roleUsers as any)?.meta?.total || 0;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="사용자 이름 또는 이메일로 검색"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setShowAssignModal(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          사용자 할당
        </Button>
      </div>

      {/* 사용자 테이블 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : currentPageUsers.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPageUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleRemoveUser(user)}>
                          <Trash2 className="mr-1 h-3 w-3" />
                          제거
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-muted-foreground">총 {totalUsers}명</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
                    이전
                  </Button>
                  <span className="text-sm">{page}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={currentPageUsers.length < 10}
                  >
                    다음
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>할당된 사용자가 없습니다</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 사용자 할당 모달 */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>"{roleName}" 역할에 사용자 할당</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>사용자 선택</Label>
              <Select
                value={selectedUserIds.join(',')}
                onValueChange={value => {
                  if (value) {
                    const ids = value.split(',').filter(Boolean);
                    setSelectedUserIds(ids);
                  } else {
                    setSelectedUserIds([]);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="할당할 사용자를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedUserIds.map(userId => {
                    const user = availableUsers.find(u => u.id.toString() === userId);
                    return user ? (
                      <Badge key={userId} variant="secondary">
                        {user.name}
                        <button
                          onClick={() => setSelectedUserIds(ids => ids.filter(id => id !== userId))}
                          className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                        >
                          ×
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>만료일 (선택사항)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !expiresAt && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiresAt ? (
                      format(expiresAt, 'PPP HH:mm', { locale: ko })
                    ) : (
                      <span>임시 역할의 경우 만료일을 설정하세요</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiresAt}
                    onSelect={setExpiresAt}
                    disabled={date => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {expiresAt && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    <Clock className="mr-1 h-3 w-3" />
                    {format(expiresAt, 'yyyy-MM-dd HH:mm')}에 만료
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => setExpiresAt(undefined)}>
                    제거
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignModal(false);
                setSelectedUserIds([]);
                setExpiresAt(undefined);
              }}
            >
              취소
            </Button>
            <Button onClick={handleAssignUsers} disabled={assignUsersMutation.isPending || selectedUserIds.length === 0}>
              {assignUsersMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserPlus className="mr-2 h-4 w-4" />
              할당
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 사용자 제거 확인 대화상자 */}
      <AlertDialog open={!!removeUserDialog} onOpenChange={() => setRemoveUserDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사용자 제거</AlertDialogTitle>
            <AlertDialogDescription>
              {removeUserDialog?.name}님을 "{roleName}" 역할에서 제거하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeUserDialog) {
                  removeUserMutation.mutate(removeUserDialog.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              제거
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoleUsersTab;
