import React, { useState } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, CheckCircle, User, Shield, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  adminRoleService,
  CreateRoleRequest,
  GroupedPermissions,
} from '../../../api/adminRoleService';
import PermissionTree from './PermissionTree';

interface CreateRoleModalProps {
  groupedPermissions?: GroupedPermissions;
  onClose: () => void;
  onSuccess: () => void;
}

// 폼 스키마
const createRoleSchema = z.object({
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

type CreateRoleFormData = z.infer<typeof createRoleSchema>;

const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  groupedPermissions,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  
  const form = useForm<CreateRoleFormData>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: '',
      displayName: '',
      description: '',
      level: 50,
    },
  });

  // 역할 생성 뮤테이션
  const createRoleMutation = useMutation({
    mutationFn: (data: CreateRoleRequest) => adminRoleService.createRole(data),
    onSuccess: () => {
      toast({
        description: '새 역할이 생성되었습니다.',
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        description: error.message || '역할 생성에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 폼 제출 핸들러
  const handleSubmit = (data: CreateRoleFormData) => {
    const requestData: CreateRoleRequest = {
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      level: data.level,
      permissionIds: selectedPermissions,
    };
    
    createRoleMutation.mutate(requestData);
  };

  // 다음 단계로
  const handleNext = async () => {
    if (currentStep === 0) {
      const isValid = await form.trigger();
      if (isValid) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  // 이전 단계로
  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const steps = [
    { title: '기본 정보', icon: User },
    { title: '권한 설정', icon: Shield },
    { title: '확인', icon: CheckCircle },
  ];

  const formData = form.watch();

  // 단계별 콘텐츠 렌더링 함수
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">역할 ID</Label>
              <Input
                id="name"
                placeholder="예: content_manager"
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
              <Label htmlFor="displayName">표시 이름</Label>
              <Input
                id="displayName"
                placeholder="예: 콘텐츠 관리자"
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
                placeholder="역할에 대한 설명을 입력하세요"
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
                placeholder="50"
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
          </div>
        );

      case 1:
        return groupedPermissions ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">역할에 할당할 권한을 선택하세요</h4>
              <div className="text-sm text-muted-foreground">
                선택된 권한: {selectedPermissions.length}개
              </div>
            </div>
            <PermissionTree
              groupedPermissions={groupedPermissions}
              selectedPermissions={selectedPermissions}
              onPermissionChange={setSelectedPermissions}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h4 className="font-medium">생성할 역할 정보를 확인하세요</h4>
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">역할 ID</p>
                    <p className="text-sm text-muted-foreground">{formData.name || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">표시 이름</p>
                    <p className="text-sm text-muted-foreground">{formData.displayName || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">권한 레벨</p>
                    <p className="text-sm text-muted-foreground">{formData.level}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm font-medium">설명</p>
                  <p className="text-sm text-muted-foreground">{formData.description || '-'}</p>
                </div>
                <Separator />
                <div className="space-y-1">
                  <p className="text-sm font-medium">할당된 권한</p>
                  <p className="text-sm text-muted-foreground">{selectedPermissions.length}개</p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            새 역할 생성
          </DialogTitle>
        </DialogHeader>

        {/* 단계 표시기 */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div key={index} className="flex items-center">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  !isActive && !isCompleted && "border-muted-foreground text-muted-foreground"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={cn(
                  "ml-2 text-sm font-medium",
                  isActive && "text-primary",
                  isCompleted && "text-primary",
                  !isActive && !isCompleted && "text-muted-foreground"
                )}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-12 h-0.5 mx-4",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-240px)]">
          {renderStepContent()}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrev}>
                이전
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button onClick={handleNext}>
                다음
              </Button>
            ) : (
              <Button 
                onClick={form.handleSubmit(handleSubmit)}
                disabled={createRoleMutation.isPending}
              >
                {createRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Plus className="mr-2 h-4 w-4" />
                생성
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoleModal;