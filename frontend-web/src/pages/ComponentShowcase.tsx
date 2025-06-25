import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeToggle } from '@/components/theme-toggle'
import { AlertCircle, Check } from 'lucide-react'

export default function ComponentShowcase() {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Shadcn/ui 컴포넌트 쇼케이스</h1>
        <ThemeToggle />
      </div>

      {/* 버튼 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>버튼 (Button)</CardTitle>
          <CardDescription>다양한 버튼 스타일을 확인하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-x-4">
          <Button>기본 버튼</Button>
          <Button variant="secondary">보조 버튼</Button>
          <Button variant="destructive">삭제</Button>
          <Button variant="outline">윤곽선</Button>
          <Button variant="ghost">고스트</Button>
          <Button variant="link">링크</Button>
        </CardContent>
      </Card>

      {/* 폼 요소 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>폼 요소 (Form Elements)</CardTitle>
          <CardDescription>입력 필드와 관련 컴포넌트들</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">이메일</Label>
            <Input id="email" type="email" placeholder="email@example.com" />
          </div>
          
          <div>
            <Label htmlFor="message">메시지</Label>
            <Textarea id="message" placeholder="메시지를 입력하세요..." />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="terms" />
            <Label htmlFor="terms">이용약관에 동의합니다</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="notifications" />
            <Label htmlFor="notifications">알림 받기</Label>
          </div>

          <RadioGroup defaultValue="option1">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="option1" id="option1" />
              <Label htmlFor="option1">옵션 1</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="option2" id="option2" />
              <Label htmlFor="option2">옵션 2</Label>
            </div>
          </RadioGroup>

          <Select>
            <SelectTrigger>
              <SelectValue placeholder="옵션을 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">옵션 1</SelectItem>
              <SelectItem value="option2">옵션 2</SelectItem>
              <SelectItem value="option3">옵션 3</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 알림 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>알림 (Alert)</CardTitle>
          <CardDescription>다양한 알림 스타일</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>알림</AlertTitle>
            <AlertDescription>
              이것은 기본 알림 메시지입니다.
            </AlertDescription>
          </Alert>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>
              작업 중 오류가 발생했습니다.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 배지 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>배지 (Badge)</CardTitle>
          <CardDescription>상태나 카테고리를 표시하는 배지</CardDescription>
        </CardHeader>
        <CardContent className="space-x-2">
          <Badge>기본</Badge>
          <Badge variant="secondary">보조</Badge>
          <Badge variant="destructive">중요</Badge>
          <Badge variant="outline">윤곽선</Badge>
        </CardContent>
      </Card>

      {/* 탭 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>탭 (Tabs)</CardTitle>
          <CardDescription>콘텐츠를 구성하는 탭 인터페이스</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">탭 1</TabsTrigger>
              <TabsTrigger value="tab2">탭 2</TabsTrigger>
              <TabsTrigger value="tab3">탭 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">탭 1의 콘텐츠입니다.</TabsContent>
            <TabsContent value="tab2">탭 2의 콘텐츠입니다.</TabsContent>
            <TabsContent value="tab3">탭 3의 콘텐츠입니다.</TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 다이얼로그 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>다이얼로그 (Dialog)</CardTitle>
          <CardDescription>모달 다이얼로그 컴포넌트</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>다이얼로그 열기</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>다이얼로그 제목</DialogTitle>
                <DialogDescription>
                  이것은 다이얼로그의 설명 텍스트입니다.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p>다이얼로그 콘텐츠가 여기에 표시됩니다.</p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
                <Button onClick={() => setOpen(false)}>확인</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}