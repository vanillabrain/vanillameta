import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Copy, Loader2, Info } from 'lucide-react';
import {
  adminRoleService,
  Role,
  CloneRoleRequest,
} from '../../../api/adminRoleService';

interface CloneRoleModalProps {
  sourceRole: Role;
  onClose: () => void;
  onSuccess: () => void;
}

// 폼 스키마
const cloneRoleSchema = z.object({
  name: z
    .string()
    .min(1, '역할 ID를 입력하세요')
    .regex(/^[a-z_]+$/, '소문자와 언더스코어만 사용 가능합니다'),
  displayName: z.string().min(1, '표시 이름을 입력하세요'),
  description: z.string().optional(),
  level: z
    .number()
    .min(1, '권한 레벨은 1 이상이어야 합니다')
    .max(100, '권한 레벨은 100 이하여야 합니다'),
});

type CloneRoleFormData = z.infer<typeof cloneRoleSchema>;

const CloneRoleModal: React.FC<CloneRoleModalProps> = ({
  sourceRole,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  
  const form = useForm<CloneRoleFormData>({
    resolver: zodResolver(cloneRoleSchema),
    defaultValues: {
      name: '',
      displayName: '',
      description: `${sourceRole.description} (복사본)`,
      level: Math.max(1, sourceRole.level - 1),
    },
  });

  // 역할 복사 뮤테이션
  const cloneRoleMutation = useMutation({
    mutationFn: (data: CloneRoleRequest) => adminRoleService.cloneRole(sourceRole.id, data),
    onSuccess: () => {
      toast({
        description: '역할이 복사되었습니다.',
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        description: error.message || '역할 복사에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 폼 제출 핸들러
  const handleSubmit = (data: CloneRoleFormData) => {
    // 중복 이름 검증
    if (data.name === sourceRole.name) {
      form.setError('name', { message: '원본과 동일한 ID는 사용할 수 없습니다' });
      return;
    }
    cloneRoleMutation.mutate(data);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            역할 복사: {sourceRole.displayName}
          </DialogTitle>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>{sourceRole.displayName}</strong> 역할을 기반으로 새로운 역할을 생성합니다.
            <br />
            원본 역할의 모든 권한이 새 역할에 복사됩니다.
          </AlertDescription>
        </Alert>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">새 역할 ID</Label>
            <Input
              id="name"
              placeholder="예: content_manager_copy"
              {...form.register('name')}
            />
            <p className="text-xs text-muted-foreground">
              영문 소문자와 언더스코어(_)만 사용 가능합니다
            </p>
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">새 역할 표시 이름</Label>
            <Input
              id="displayName"
              placeholder="예: 콘텐츠 관리자 (복사본)"
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
              rows={3}
              placeholder="새 역할에 대한 설명을 입력하세요"
              {...form.register('description')}
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">권한 레벨</Label>
            <Input
              id="level"
              type="number"
              min={1}
              max={100}
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
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button 
            onClick={form.handleSubmit(handleSubmit)}
            disabled={cloneRoleMutation.isPending}
          >
            {cloneRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Copy className="mr-2 h-4 w-4" />
            복사
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CloneRoleModal;