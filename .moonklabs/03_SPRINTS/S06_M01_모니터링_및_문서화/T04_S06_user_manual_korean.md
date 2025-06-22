# T04_S06: 한글 사용자 매뉴얼 작성

## 태스크 개요
- **ID**: T04_S06
- **제목**: VanillaMeta 한글 사용자 매뉴얼 작성
- **우선순위**: High
- **예상 소요 시간**: 4일
- **담당**: 기술 문서 작성자, 프론트엔드 개발자

## 목표
VanillaMeta의 모든 기능을 한글로 상세히 설명하는 사용자 매뉴얼을 작성하여, 한국 사용자들이 제품을 쉽게 이해하고 활용할 수 있도록 지원합니다.

## 구현 범위

### 1. 매뉴얼 구조
```yaml
UserManualStructure:
  1_시작하기:
    - VanillaMeta 소개
    - 주요 기능 개요
    - 시스템 요구사항
    - 빠른 시작 가이드
  
  2_계정관리:
    - 회원가입
    - 로그인/로그아웃
    - 프로필 관리
    - 비밀번호 변경
    - 계정 보안 설정
  
  3_데이터소스:
    - 지원 데이터베이스 목록
    - 연결 설정 방법
    - 연결 테스트
    - 보안 설정
    - 문제 해결
  
  4_대시보드:
    - 대시보드 생성
    - 레이아웃 편집
    - 위젯 추가/제거
    - 필터 설정
    - 공유 및 권한 관리
  
  5_시각화:
    - 차트 종류 소개
    - 차트 생성 방법
    - 데이터 매핑
    - 스타일 커스터마이징
    - 인터랙티브 기능
  
  6_쿼리작성:
    - 쿼리 빌더 사용법
    - SQL 직접 작성
    - 변수 및 파라미터
    - 쿼리 최적화 팁
    - 쿼리 저장 및 재사용
  
  7_고급기능:
    - 실시간 데이터 업데이트
    - 알림 설정
    - API 연동
    - 커스텀 위젯
    - 플러그인 사용
  
  8_문제해결:
    - 자주 묻는 질문
    - 오류 메시지 가이드
    - 성능 최적화
    - 지원 문의 방법
```

### 2. 문서 템플릿 및 스타일 가이드
```markdown
## 문서 작성 원칙
1. **명확성**: 전문 용어는 최소화하고, 필요시 설명 추가
2. **일관성**: 용어, 문체, 형식의 일관성 유지
3. **시각적 도움**: 스크린샷, 다이어그램, 예제 적극 활용
4. **단계별 설명**: 복잡한 작업은 번호를 매긴 단계로 설명
5. **실용성**: 실제 사용 시나리오 기반 설명

## 용어 표준화
- Dashboard → 대시보드
- Widget → 위젯
- Data Source → 데이터소스
- Query → 쿼리
- Chart → 차트
- Filter → 필터
- Real-time → 실시간
- Share → 공유
```

### 3. 매뉴얼 콘텐츠 예시

#### 3.1 시작하기 섹션
```markdown
# VanillaMeta 사용자 매뉴얼

## 1. VanillaMeta 소개

VanillaMeta는 코드 작성 없이 다양한 데이터베이스에 연결하여 
인터랙티브한 대시보드를 만들 수 있는 비즈니스 인텔리전스(BI) 도구입니다.

### 주요 특징
- 🔌 **다양한 데이터소스 지원**: MySQL, PostgreSQL, MongoDB 등
- 📊 **풍부한 시각화**: 30+ 차트 타입 지원
- 🚀 **실시간 업데이트**: 자동 새로고침 기능
- 🔐 **안전한 연결**: SSL/TLS 암호화 지원
- 👥 **협업 기능**: 대시보드 공유 및 권한 관리

### 사용 대상
- 데이터 분석가
- 비즈니스 담당자
- 개발자
- 경영진

## 2. 빠른 시작 가이드

### 5분 만에 첫 대시보드 만들기

#### 1단계: 로그인
1. https://app.vanillameta.com 접속
2. 이메일과 비밀번호 입력
3. [로그인] 버튼 클릭

![로그인 화면](./images/login-screen.png)

#### 2단계: 데이터소스 연결
1. 좌측 메뉴에서 [데이터소스] 클릭
2. [새 데이터소스 추가] 버튼 클릭
3. 데이터베이스 유형 선택
4. 연결 정보 입력:
   - 호스트: 데이터베이스 서버 주소
   - 포트: 데이터베이스 포트 번호
   - 데이터베이스명: 연결할 데이터베이스 이름
   - 사용자명: 데이터베이스 사용자 이름
   - 비밀번호: 데이터베이스 비밀번호
5. [연결 테스트] 클릭하여 확인
6. [저장] 클릭

> 💡 **팁**: 보안을 위해 읽기 전용 계정 사용을 권장합니다.

#### 3단계: 대시보드 생성
1. 상단 메뉴에서 [새 대시보드] 클릭
2. 대시보드 이름 입력
3. [생성] 클릭

#### 4단계: 차트 추가
1. 대시보드에서 [위젯 추가] 클릭
2. 차트 타입 선택 (예: 막대 차트)
3. 데이터소스 선택
4. 쿼리 작성 또는 테이블 선택
5. X축, Y축 필드 매핑
6. [적용] 클릭

#### 5단계: 저장 및 공유
1. 우상단 [저장] 클릭
2. 공유하려면 [공유] 버튼 클릭
3. 공유 링크 복사 또는 이메일 초대
```

#### 3.2 데이터소스 연결 가이드
```markdown
## 3. 데이터소스 연결 가이드

### MySQL 연결하기

#### 연결 전 준비사항
- MySQL 서버 주소 및 포트
- 데이터베이스 이름
- 접속 계정 정보
- 방화벽 설정 확인

#### 연결 설정
1. [데이터소스] → [새 데이터소스 추가] 클릭
2. 데이터베이스 유형에서 'MySQL' 선택
3. 연결 정보 입력:

   ```
   호스트: mysql.example.com
   포트: 3306 (기본값)
   데이터베이스: mydb
   사용자명: readonly_user
   비밀번호: ********
   ```

4. SSL 연결 (선택사항):
   - [고급 설정] 클릭
   - 'SSL 사용' 체크
   - 인증서 파일 업로드 (필요시)

5. [연결 테스트] 클릭
   - ✅ 성공: "연결 성공!" 메시지 확인
   - ❌ 실패: 오류 메시지 확인 및 해결

#### 일반적인 연결 문제 해결

**오류: "Connection timeout"**
- 원인: 네트워크 연결 문제 또는 방화벽 차단
- 해결:
  1. 서버 주소와 포트 확인
  2. 방화벽에서 해당 포트 허용
  3. VPN 연결 필요 여부 확인

**오류: "Access denied"**
- 원인: 잘못된 계정 정보 또는 권한 부족
- 해결:
  1. 사용자명과 비밀번호 재확인
  2. 데이터베이스 접근 권한 확인
  3. IP 화이트리스트 확인

**오류: "Unknown database"**
- 원인: 존재하지 않는 데이터베이스명
- 해결:
  1. 데이터베이스명 철자 확인
  2. 대소문자 구분 확인
  3. 데이터베이스 존재 여부 확인
```

### 4. 인터랙티브 문서 시스템
```typescript
// frontend-web/src/components/documentation/InteractiveGuide.tsx
import React, { useState } from 'react';
import { Tour, TourStep } from '../common/Tour';
import { VideoPlayer } from '../common/VideoPlayer';

interface GuideSection {
  id: string;
  title: string;
  content: string;
  video?: string;
  interactive?: boolean;
  steps?: TourStep[];
}

export function InteractiveGuide() {
  const [activeSection, setActiveSection] = useState<string>('getting-started');
  const [showTour, setShowTour] = useState(false);

  const sections: GuideSection[] = [
    {
      id: 'getting-started',
      title: '시작하기',
      content: '...',
      video: '/videos/getting-started-ko.mp4',
      interactive: true,
      steps: [
        {
          target: '.sidebar-datasource',
          content: '여기서 데이터소스를 관리할 수 있습니다.',
          placement: 'right',
        },
        {
          target: '.create-dashboard-btn',
          content: '새 대시보드를 만들려면 이 버튼을 클릭하세요.',
          placement: 'bottom',
        },
      ],
    },
  ];

  return (
    <div className="interactive-guide">
      <nav className="guide-navigation">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={activeSection === section.id ? 'active' : ''}
          >
            {section.title}
          </button>
        ))}
      </nav>

      <main className="guide-content">
        {sections
          .filter((s) => s.id === activeSection)
          .map((section) => (
            <div key={section.id}>
              <h2>{section.title}</h2>
              
              {section.video && (
                <VideoPlayer
                  src={section.video}
                  poster={`${section.video}.thumb.jpg`}
                  controls
                />
              )}

              <div dangerouslySetInnerHTML={{ __html: section.content }} />

              {section.interactive && (
                <button 
                  onClick={() => setShowTour(true)}
                  className="btn-primary"
                >
                  인터랙티브 투어 시작
                </button>
              )}
            </div>
          ))}
      </main>

      {showTour && (
        <Tour
          steps={sections.find(s => s.id === activeSection)?.steps || []}
          onComplete={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
```

### 5. 매뉴얼 검색 시스템
```typescript
// backend-api/src/documentation/search.service.ts
import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class DocumentationSearchService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async indexDocumentation(docs: any[]): Promise<void> {
    const body = docs.flatMap(doc => [
      { index: { _index: 'documentation', _id: doc.id } },
      {
        ...doc,
        content_ko: this.tokenizeKorean(doc.content),
        suggest: {
          input: [doc.title, ...doc.keywords],
          weight: doc.priority || 1,
        },
      },
    ]);

    await this.elasticsearchService.bulk({
      body,
      refresh: true,
    });
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const response = await this.elasticsearchService.search({
      index: 'documentation',
      body: {
        query: {
          multi_match: {
            query,
            fields: ['title^3', 'content_ko', 'keywords^2'],
            type: 'best_fields',
            fuzziness: 'AUTO',
          },
        },
        highlight: {
          fields: {
            content_ko: {
              fragment_size: 150,
              number_of_fragments: 3,
            },
          },
          pre_tags: ['<mark>'],
          post_tags: ['</mark>'],
        },
        suggest: {
          text: query,
          simple_phrase: {
            phrase: {
              field: 'suggest',
              size: 5,
              gram_size: 2,
              confidence: 0.5,
            },
          },
        },
      },
    });

    return this.formatSearchResults(response);
  }

  private tokenizeKorean(text: string): string {
    // 한글 형태소 분석 적용
    // nori 플러그인 사용 예정
    return text;
  }

  private formatSearchResults(response: any): SearchResult[] {
    return response.body.hits.hits.map((hit: any) => ({
      id: hit._id,
      title: hit._source.title,
      excerpt: hit.highlight?.content_ko?.[0] || hit._source.content.substring(0, 150),
      score: hit._score,
      category: hit._source.category,
      url: `/docs/${hit._source.category}/${hit._id}`,
    }));
  }
}
```

### 6. 문서 버전 관리
```typescript
// backend-api/src/documentation/version-control.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentationVersionService {
  async createVersion(docId: string, content: any, author: string): Promise<void> {
    const version = {
      docId,
      content,
      author,
      version: await this.getNextVersion(docId),
      createdAt: new Date(),
      changes: await this.detectChanges(docId, content),
    };

    await this.saveVersion(version);
  }

  async getVersionHistory(docId: string): Promise<DocVersion[]> {
    return this.repository.find({
      where: { docId },
      order: { version: 'DESC' },
    });
  }

  async compareVersions(docId: string, v1: number, v2: number): Promise<Diff[]> {
    const version1 = await this.getVersion(docId, v1);
    const version2 = await this.getVersion(docId, v2);

    return this.diffService.compare(version1.content, version2.content);
  }

  async rollbackVersion(docId: string, targetVersion: number): Promise<void> {
    const version = await this.getVersion(docId, targetVersion);
    await this.createVersion(
      docId,
      version.content,
      'system_rollback'
    );
  }
}
```

### 7. 문서 생성 자동화
```yaml
# docs/manual/build-config.yml
manual:
  title: "VanillaMeta 사용자 가이드"
  version: "1.0.0"
  language: "ko"
  
  structure:
    - section: getting-started
      title: "시작하기"
      pages:
        - introduction
        - quick-start
        - system-requirements
    
    - section: data-sources
      title: "데이터소스"
      pages:
        - supported-databases
        - connection-setup
        - security-settings
    
    - section: dashboards
      title: "대시보드"
      pages:
        - creating-dashboards
        - widgets
        - filters
        - sharing

  output:
    formats:
      - html
      - pdf
      - epub
    
    html:
      theme: "vanillameta"
      searchEnabled: true
      interactiveTours: true
    
    pdf:
      paperSize: "A4"
      margin: "2cm"
      tocEnabled: true
```

## 검증 항목

### 콘텐츠 품질
- [ ] 모든 기능이 문서화됨
- [ ] 문법 및 맞춤법 검수 완료
- [ ] 용어 일관성 확인
- [ ] 스크린샷 최신 버전 반영

### 사용성 검증
- [ ] 초보자도 이해 가능한 설명
- [ ] 단계별 가이드 명확성
- [ ] 검색 기능 정확도
- [ ] 인터랙티브 투어 작동

### 기술적 검증
- [ ] 모든 링크 유효성
- [ ] 코드 예제 정확성
- [ ] 비디오 재생 가능
- [ ] 반응형 디자인 적용

## 산출물
1. 한글 사용자 매뉴얼 (HTML/PDF)
2. 인터랙티브 가이드 시스템
3. 비디오 튜토리얼 (5개 이상)
4. 빠른 참조 가이드 (치트시트)
5. 문서 검색 시스템

## 배포 계획
1. 웹 기반 문서 사이트: docs.vanillameta.com
2. 인앱 도움말 시스템 통합
3. PDF 다운로드 제공
4. 정기적인 업데이트 프로세스

## 참고 자료
- [기술 문서 작성 가이드](https://developers.google.com/tech-writing)
- [한글 맞춤법 검사기](http://speller.cs.pusan.ac.kr/)
- [Docusaurus](https://docusaurus.io/) - 문서 사이트 프레임워크