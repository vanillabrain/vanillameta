# Husky Git Hooks 가이드

## 개요

main 브랜치에 직접 commit, push, merge하는 것을 방지하기 위한 git hook이 설정되었습니다.

## 설정된 Git Hooks

### 1. pre-commit hook
- **기능**: main 브랜치에서 직접 commit 방지
- **위치**: `backend-api/.husky/pre-commit`
- **동작**:
  - main 브랜치에서 commit 시도 시 에러 발생
  - develop-refactor-로 시작하지 않는 브랜치에서 경고 메시지 표시

### 2. pre-push hook
- **기능**: main 브랜치로 직접 push 방지
- **위치**: `backend-api/.husky/pre-push`
- **동작**:
  - main 브랜치에서 push 시도 시 에러 발생
  - PR을 통한 코드 병합 안내

### 3. pre-merge-commit hook
- **기능**: main 브랜치에서 직접 merge 방지
- **위치**: `backend-api/.husky/pre-merge-commit`
- **동작**:
  - main 브랜치에서 merge 시도 시 에러 발생
  - GitHub PR을 통한 merge 안내

### 4. prepare-commit-msg hook
- **기능**: merge 커밋 시 main 브랜치 보호
- **위치**: `backend-api/.husky/prepare-commit-msg`
- **동작**:
  - merge 커밋이 main 브랜치에서 발생하는 것을 방지

## 올바른 작업 흐름

1. **새 브랜치 생성**
   ```bash
   git checkout -b develop-refactor-<feature-name>
   ```

2. **작업 및 커밋**
   ```bash
   git add .
   git commit -m "feat: 새로운 기능 추가"
   ```

3. **원격 저장소에 푸시**
   ```bash
   git push origin develop-refactor-<feature-name>
   ```

4. **PR 생성 및 병합**
   - GitHub에서 Pull Request 생성
   - PR의 base를 `develop-refactor` 브랜치로 설정
   - 코드 리뷰 진행
   - PR을 통해 merge

## 중요 사항

- **절대 main 브랜치에 직접 작업하지 마세요**
- 모든 작업은 feature 브랜치에서 진행
- 작업 브랜치: `develop-refactor-<feature>` 형식
- PR target: `develop-refactor` 브랜치
- main 브랜치는 오직 PR을 통해서만 업데이트

## Hook 비활성화 (비상시에만 사용)

절대적으로 필요한 경우에만 사용하세요:
```bash
# 단일 커밋에 대해서만 hook 무시
git commit --no-verify -m "긴급 수정"

# 단일 푸시에 대해서만 hook 무시
git push --no-verify
```

⚠️ **경고**: Hook을 비활성화하면 main 브랜치 보호가 무력화됩니다. 
반드시 필요한 경우가 아니라면 사용하지 마세요.

## 문제 해결

### Hook이 작동하지 않는 경우
```bash
# Git hooks 경로 확인
git config core.hooksPath

# 올바른 경로로 재설정
git config core.hooksPath backend-api/.husky

# Hook 파일 권한 확인
ls -la backend-api/.husky/
```

### Hook 완전 제거
```bash
# Git hooks 경로 초기화
git config --unset core.hooksPath
```

## GitHub Branch Protection Rules 설정 권장

로컬 Git hooks와 함께 GitHub에서도 branch protection rules를 설정하세요:

1. Settings → Branches → Add rule
2. Branch name pattern: `main`
3. 다음 옵션 활성화:
   - Require pull request reviews before merging
   - Dismiss stale pull request approvals when new commits are pushed
   - Require review from CODEOWNERS
   - Require status checks to pass before merging
   - Include administrators
   - Restrict who can push to matching branches

이렇게 설정하면 이중 보호로 main 브랜치를 안전하게 관리할 수 있습니다.