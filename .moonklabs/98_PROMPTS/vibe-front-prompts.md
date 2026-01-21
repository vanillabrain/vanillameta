# VIBE 코딩 프론트엔드 프롬프트

https://github.com/roboco-io/handson-vibecoding-demo

## STEP1

지금부터 간단한 앱을 만드는 것을 데모로 보여주려 고해. TODO앱을 웹 앱으로 만들려고해. 우선 docs 폴더 아래에 요건 정의를 문서화 해 줘. 요건정의를 위해서 필요한 질문들을 포함해줘.

- requirements.md 리뷰
- .windsurfrules 생성

@requirements.md 참고해서 설계문서 작성을 진행해줘

- design.dm 리뷰
  mermaid -> svg 로 설계문서를 작성

@design.md 에서 아키텍처 다이어그램은 SVG를 사용해서 정확하고 상서하게 그려줘.

리퀘스트 처리 부분에 대해서 시퀀스 다이어 그램을 추가해줘. 시퀀스 다이어그램은 mermaid 로 그려줘

UI 설계에서 모바일뷰와 데스크톱 뷰의 와이어프레임도 SVG로 생성해줘

카드뷰 보다는 리스트로 표시해줘

@design.md 문서에 기반해서 앞으로 수행해 야 할 작업들을 순서대로 체크리스트로 만들어 줘. UI/UX를 제외한 코어 비즈니스 로직은 TDD 에 기반해서 작업해야해. 작업이 확인 가능한 단 위별로 커밋 포인트도 체크리스트에 표시해줘.

## STEP2

나는 좀 더 간편한 UI Kit을 사용해서 프론트를 구현하고 싶어. 어떤 UI Kit이 좋을까?

Mantine 을 사용해서 UI를 구현하도록 요건과 설계문서를 업데이트 해줘

@implementation-checklist.md 의 이름을 checklist.md 로 바꿔줘

업데이트된 @design.md 내용에 맞춰서 @checklist.md 를 업데이트 해줘

Windsurf rules 수정 :

- 커뮤니케이션은 한국어로 해줘
- 프론트엔드 UI 구현시에는 실행 코드를 먼저 작성한다. 코어 비즈니스 로직 구현 시에만 TDD로 진행 할 것.
- 백엔드는 TDD로 구현할 것
- 커밋 전에 docs/checklist.md에 진행상황을 업데이트 한다.
- 설계 변경시에는 requirements.md 와 design.md 를 수정한다.

업데이트 된 계획들을 커밋해줘

이제 체크리스트 항목을 시작해줘

프로젝트 설명을 위한 README 를 root 폴더에 만들어줘

[자동화]
Rules 파일은 자동화에 큰 역할을 담당한다
Awesome cursor rules 를 참고해서 업데이트 해야한다

@web https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/nextjs15-react19-vercelai-tailwind-cursorrules-prompt-file/.cursorrules 참고해서 이 프로젝트의 아키텍처와 요구사항 edesign.md, erequirements.nd 을 반영한 규칙 파일을 edocs 에 windsurfruels.md 에 만들어줘

git hook을 이용해서 커밋시에 Iint fix, build, test가 자동으로 수행되도록 하고싶어. 실행 코드에 변경시에만 작동되어야 해.
우선은 프론트에 대해서 적용해줘

체크리스트에 방금 작업한 내용을 반영해줘. 설계문서와 README 에도 반영해줘

변경사항을 커밋해줘

@pre-commit 을 수정해서 좀 더 디테일한 로그를 남겨서 디버깅을 용이하게 해줘

## STEP3

[P] 나는 프른트 개발을 독립적으로 완료하고 그 다음 백엔드에 연결하는 방식으로 개발을 하고 싶어.

- 관련 체크리스트 조정됨

[P] 체크리스트에 따라서 다음 작업을 진행해줘

- lint 작성확인
- npm run lint

[P] 이제부터 mantain v7 으로 UI를 구현해줘. 최신버전의 사용법은 @web https://mantine.dev 를 참고해서 구현해줘
(시안 이미지 복붙후)
이미지를 참고해서 모바일과 데스크톱 모두 대응되는 반응형 디자인으로 작성해줘.
이미지는 와이어프레임 이므로 배치만 참고해줘

- 공식문서 파일들을 rules에 업데이트 하자
- 관련 MCP도 업데이트 되고 있으니 참고하자

@checklist.md 에 데모로서 불필요한 부분을 삭제했어. 삭제된 내용을 @requirements.md, @design.md 에 반영해줘.

@checklist.md 를 보고 다음 구현을 진행해줘. 우선 브라우저 전체 너비를 사용 하도록 레이아웃을 조정해줘. 현재 코드는 고정폭을 사용하고 있어. 수정 하기 전에 관련 코드를 먼저 꼼꼼히 살펴보고 수정을 계획을 세운다음 나에게 확인을 받고 진행 해.

- 중간에 헤맬때는 조사를 하라고 시키면 좋다
