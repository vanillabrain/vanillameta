# Git Branch Protection Guide

## Main 브랜치 보호 설정

이 프로젝트는 Husky를 사용하여 `main` 브랜치를 보호합니다.

### 설정된 보호 기능

1. **main 브랜치에서 직접 커밋 방지**
   - main 브랜치에서 커밋을 시도하면 오류가 발생합니다
   - 대신 feature 브랜치를 생성하여 작업해야 합니다

2. **main 브랜치로 직접 push 방지**
   - `git push origin main` 명령이 차단됩니다
   - `git push origin HEAD:main` 형태도 차단됩니다
   - 현재 브랜치가 main인 경우 push가 차단됩니다

### 올바른 작업 흐름

1. **새 기능 개발시**
   ```bash
   # feature 브랜치 생성
   git checkout -b feature/your-feature-name
   
   # 작업 후 커밋
   git add .
   git commit -m "feat: 새로운 기능 추가"
   
   # feature 브랜치로 push
   git push origin feature/your-feature-name
   ```

2. **PR(Pull Request) 생성**
   - GitHub에서 PR을 생성하여 main 브랜치로 병합
   - 코드 리뷰 후 병합

3. **작업 브랜치 패턴**
   - `feature/기능명` - 새로운 기능
   - `fix/버그명` - 버그 수정
   - `docs/문서명` - 문서 작업
   - `refactor/리팩토링명` - 코드 개선
   - `task/작업명` - 일반 작업

### 차단된 명령어

다음 명령어들은 실행이 차단됩니다:

```bash
# main 브랜치에서 커밋
git commit -m "message"  # (현재 브랜치가 main인 경우)

# main 브랜치로 push
git push origin main
git push origin HEAD:main
git push  # (현재 브랜치가 main인 경우)
```

### 비상시 우회 방법 (권장하지 않음)

정말 필요한 경우에만 사용하세요:

```bash
# Husky 훅 우회 (매우 주의!)
git commit --no-verify -m "message"
git push --no-verify origin main
```

⚠️ **주의**: 우회 방법은 긴급한 경우에만 사용하고, 가능한 한 정상적인 PR 프로세스를 따르세요.

### Husky 설정 파일

- `.husky/pre-push` - push 전 검증
- `.husky/commit-msg` - 커밋 메시지 검증

### 문제 해결

1. **"Direct push to 'main' branch is not allowed!" 오류**
   - 현재 브랜치를 확인: `git branch`
   - feature 브랜치로 전환: `git checkout -b feature/브랜치명`

2. **이미 main 브랜치에서 작업한 경우**
   ```bash
   # 변경사항을 새 브랜치로 이동
   git checkout -b feature/my-feature
   git push origin feature/my-feature
   ```

3. **로컬 main 브랜치 업데이트**
   ```bash
   # main 브랜치는 pull만 허용
   git checkout main
   git pull origin main
   ```

이 설정은 실수로 main 브랜치를 손상시키는 것을 방지하고, 코드 리뷰 프로세스를 강제합니다.