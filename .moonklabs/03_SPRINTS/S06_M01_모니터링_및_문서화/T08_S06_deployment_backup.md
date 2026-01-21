# T08_S06: 배포 자동화 및 백업 절차

## 태스크 개요
- **ID**: T08_S06
- **제목**: CI/CD 파이프라인 고도화 및 데이터 백업/복구 시스템 구축
- **우선순위**: Medium
- **예상 소요 시간**: 3일
- **담당**: DevOps 엔지니어, 백엔드 개발자

## 목표
안전하고 신뢰할 수 있는 배포 프로세스를 자동화하고, 데이터 손실 방지를 위한 포괄적인 백업 및 복구 시스템을 구축합니다.

## 구현 범위

### 1. CI/CD 파이프라인 구조
```yaml
DeploymentPipeline:
  Triggers:
    - push_to_develop: "스테이징 배포"
    - push_to_main: "프로덕션 배포"
    - tag_creation: "릴리스 배포"
    - manual_trigger: "수동 배포"
  
  Stages:
    1_Source:
      - checkout_code
      - validate_branch
      - check_commit_messages
    
    2_Build:
      - install_dependencies
      - run_tests
      - build_artifacts
      - security_scan
    
    3_Test:
      - unit_tests
      - integration_tests
      - e2e_tests
      - performance_tests
    
    4_Security:
      - vulnerability_scan
      - secrets_detection
      - license_check
      - compliance_check
    
    5_Deploy:
      - blue_green_deployment
      - smoke_tests
      - health_checks
      - rollback_capability
    
    6_PostDeploy:
      - notify_team
      - update_documentation
      - backup_verification
      - monitoring_alerts

  Environments:
    Development:
      auto_deploy: true
      approval_required: false
      tests_required: ["unit", "lint"]
    
    Staging:
      auto_deploy: true
      approval_required: false
      tests_required: ["unit", "integration", "security"]
    
    Production:
      auto_deploy: false
      approval_required: true
      tests_required: ["all"]
      canary_deployment: true
```

### 2. GitHub Actions 워크플로우
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]
  release:
    types: [published]

env:
  NODE_VERSION: '18'
  AWS_REGION: 'ap-northeast-2'

jobs:
  test:
    name: Test & Quality Check
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: vanillameta_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'yarn'

      - name: Install dependencies
        run: |
          cd backend-api
          yarn install --frozen-lockfile

      - name: Run linting
        run: |
          cd backend-api
          yarn lint
          yarn lint:fix

      - name: Run tests
        run: |
          cd backend-api
          yarn test:cov
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vanillameta_test

      - name: Security audit
        run: |
          cd backend-api
          yarn audit --level moderate

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./backend-api/coverage/lcov.info
          flags: backend
          name: backend-coverage

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  build:
    name: Build & Package
    needs: test
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      image-tag: ${{ steps.meta.outputs.tags }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'yarn'

      - name: Generate version
        id: version
        run: |
          if [[ $GITHUB_REF == refs/tags/* ]]; then
            VERSION=${GITHUB_REF#refs/tags/}
          else
            VERSION=$(date +%Y%m%d)-${GITHUB_SHA::8}
          fi
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Build application
        run: |
          cd backend-api
          yarn install --frozen-lockfile
          yarn build:prod
          
          cd ../frontend-web
          yarn install --frozen-lockfile
          yarn build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Package Lambda
        run: |
          cd backend-api
          zip -r ../lambda-package.zip . -x "*.git*" "test/*" "*.test.*" "coverage/*"
          aws s3 cp ../lambda-package.zip s3://vanillameta-artifacts/releases/${{ steps.version.outputs.version }}/

      - name: Build and push frontend Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./frontend-web
          push: true
          tags: |
            ${{ secrets.ECR_REGISTRY }}/vanillameta-frontend:${{ steps.version.outputs.version }}
            ${{ secrets.ECR_REGISTRY }}/vanillameta-frontend:latest

  deploy-staging:
    name: Deploy to Staging
    needs: [test, build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy Infrastructure
        run: |
          cd infrastructure
          npm install
          npx cdk deploy VanillaMetaStaging --require-approval never

      - name: Update Lambda function
        run: |
          aws lambda update-function-code \
            --function-name vanillameta-api-staging \
            --s3-bucket vanillameta-artifacts \
            --s3-key releases/${{ needs.build.outputs.version }}/lambda-package.zip

      - name: Run smoke tests
        run: |
          cd backend-api
          yarn test:e2e:staging

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          text: |
            🚀 Staging deployment completed
            Version: ${{ needs.build.outputs.version }}
            Environment: https://staging.vanillameta.com
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  deploy-production:
    name: Deploy to Production
    needs: [test, build, deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Manual approval
        uses: trstringer/manual-approval@v1
        with:
          secret: ${{ github.TOKEN }}
          approvers: team-leads,devops-team
          minimum-approvals: 2
          issue-title: "Production Deployment Approval"
          issue-body: |
            Please review and approve the production deployment:
            - Version: ${{ needs.build.outputs.version }}
            - Changes: ${{ github.event.head_commit.message }}
            - Staging URL: https://staging.vanillameta.com

      - name: Pre-deployment backup
        run: |
          # 현재 설정 백업
          ./scripts/backup-production.sh

      - name: Blue-Green Deployment
        run: |
          ./scripts/blue-green-deploy.sh production ${{ needs.build.outputs.version }}

      - name: Health check
        run: |
          ./scripts/health-check.sh production
          if [ $? -ne 0 ]; then
            echo "Health check failed, rolling back..."
            ./scripts/rollback.sh production
            exit 1
          fi

      - name: Switch traffic
        run: |
          ./scripts/switch-traffic.sh production

      - name: Post-deployment verification
        run: |
          ./scripts/verify-deployment.sh production

      - name: Notify success
        uses: 8398a7/action-slack@v3
        with:
          status: success
          channel: '#general'
          text: |
            ✅ Production deployment successful!
            Version: ${{ needs.build.outputs.version }}
            URL: https://app.vanillameta.com
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  rollback:
    name: Emergency Rollback
    runs-on: ubuntu-latest
    if: failure()
    environment: production

    steps:
      - name: Rollback deployment
        run: |
          ./scripts/emergency-rollback.sh production

      - name: Notify rollback
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          channel: '#incidents'
          text: |
            🚨 Emergency rollback initiated
            Environment: Production
            Time: $(date)
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 3. 배포 스크립트
```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

ENVIRONMENT=$1
VERSION=$2
BLUE_GREEN_STATE_FILE="/tmp/blue-green-state-${ENVIRONMENT}"

if [ -z "$ENVIRONMENT" ] || [ -z "$VERSION" ]; then
    echo "Usage: $0 <environment> <version>"
    exit 1
fi

echo "Starting Blue-Green deployment for $ENVIRONMENT with version $VERSION"

# 현재 활성 색상 확인
if [ -f "$BLUE_GREEN_STATE_FILE" ]; then
    CURRENT_COLOR=$(cat $BLUE_GREEN_STATE_FILE)
else
    CURRENT_COLOR="blue"
fi

# 다음 배포 색상 결정
if [ "$CURRENT_COLOR" = "blue" ]; then
    DEPLOY_COLOR="green"
else
    DEPLOY_COLOR="blue"
fi

echo "Current active: $CURRENT_COLOR, Deploying to: $DEPLOY_COLOR"

# 새 버전을 비활성 환경에 배포
echo "Deploying version $VERSION to $DEPLOY_COLOR environment..."

# Lambda 함수 별칭 업데이트
aws lambda update-alias \
    --function-name "vanillameta-api-${ENVIRONMENT}" \
    --name "$DEPLOY_COLOR" \
    --function-version "$VERSION"

# ECS 서비스 업데이트 (프론트엔드)
aws ecs update-service \
    --cluster "vanillameta-${ENVIRONMENT}" \
    --service "frontend-${DEPLOY_COLOR}" \
    --task-definition "vanillameta-frontend:$VERSION"

# 배포 완료 대기
echo "Waiting for deployment to complete..."
aws ecs wait services-stable \
    --cluster "vanillameta-${ENVIRONMENT}" \
    --services "frontend-${DEPLOY_COLOR}"

# 헬스체크
echo "Running health checks on $DEPLOY_COLOR environment..."
HEALTH_CHECK_URL="https://${DEPLOY_COLOR}.${ENVIRONMENT}.vanillameta.com/health"

for i in {1..30}; do
    if curl -f -s "$HEALTH_CHECK_URL" > /dev/null; then
        echo "Health check passed"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo "Health check failed after 30 attempts"
        exit 1
    fi
    
    echo "Health check attempt $i failed, retrying in 10 seconds..."
    sleep 10
done

echo "Deployment to $DEPLOY_COLOR completed successfully"
echo "Ready for traffic switch. Run switch-traffic.sh to complete deployment."
```

```bash
#!/bin/bash
# scripts/backup-production.sh

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_BUCKET="vanillameta-backups"
ENVIRONMENT="production"

echo "Starting production backup at $TIMESTAMP"

# 1. 데이터베이스 백업
echo "Creating database backup..."
aws rds create-db-snapshot \
    --db-instance-identifier "vanillameta-db-${ENVIRONMENT}" \
    --db-snapshot-identifier "vanillameta-db-backup-${TIMESTAMP}"

# 백업 완료 대기
aws rds wait db-snapshot-completed \
    --db-snapshot-identifier "vanillameta-db-backup-${TIMESTAMP}"

# 2. 애플리케이션 설정 백업
echo "Backing up application configuration..."
mkdir -p /tmp/config-backup-${TIMESTAMP}

# Lambda 함수 설정
aws lambda get-function-configuration \
    --function-name "vanillameta-api-${ENVIRONMENT}" \
    > /tmp/config-backup-${TIMESTAMP}/lambda-config.json

# ECS 서비스 정의
aws ecs describe-services \
    --cluster "vanillameta-${ENVIRONMENT}" \
    --services "frontend-blue" "frontend-green" \
    > /tmp/config-backup-${TIMESTAMP}/ecs-services.json

# API Gateway 설정
aws apigateway get-rest-api \
    --rest-api-id $(aws apigateway get-rest-apis --query 'items[?name==`vanillameta-api-${ENVIRONMENT}`].id' --output text) \
    > /tmp/config-backup-${TIMESTAMP}/apigateway-config.json

# 3. 환경 변수 백업
echo "Backing up environment variables..."
aws ssm get-parameters-by-path \
    --path "/vanillameta/${ENVIRONMENT}/" \
    --recursive \
    --with-decryption \
    > /tmp/config-backup-${TIMESTAMP}/environment-variables.json

# 4. S3 데이터 백업
echo "Backing up S3 data..."
aws s3 sync s3://vanillameta-${ENVIRONMENT}-data \
    s3://${BACKUP_BUCKET}/data-backup-${TIMESTAMP}/ \
    --delete

# 5. 설정 파일을 S3에 업로드
cd /tmp
tar -czf config-backup-${TIMESTAMP}.tar.gz config-backup-${TIMESTAMP}/
aws s3 cp config-backup-${TIMESTAMP}.tar.gz \
    s3://${BACKUP_BUCKET}/config-backup-${TIMESTAMP}.tar.gz

# 6. 백업 메타데이터 저장
cat > backup-metadata-${TIMESTAMP}.json << EOF
{
  "timestamp": "$TIMESTAMP",
  "environment": "$ENVIRONMENT",
  "database_snapshot": "vanillameta-db-backup-${TIMESTAMP}",
  "config_backup": "config-backup-${TIMESTAMP}.tar.gz",
  "data_backup": "data-backup-${TIMESTAMP}/",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git branch --show-current)",
  "backup_size": "$(du -sh config-backup-${TIMESTAMP}.tar.gz | cut -f1)"
}
EOF

aws s3 cp backup-metadata-${TIMESTAMP}.json \
    s3://${BACKUP_BUCKET}/metadata/backup-metadata-${TIMESTAMP}.json

# 7. 정리
rm -rf /tmp/config-backup-${TIMESTAMP}*

echo "Backup completed successfully!"
echo "Database snapshot: vanillameta-db-backup-${TIMESTAMP}"
echo "Config backup: s3://${BACKUP_BUCKET}/config-backup-${TIMESTAMP}.tar.gz"
echo "Metadata: s3://${BACKUP_BUCKET}/metadata/backup-metadata-${TIMESTAMP}.json"

# 8. Slack 알림
curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"✅ Production backup completed successfully\nTimestamp: $TIMESTAMP\nDatabase snapshot: vanillameta-db-backup-${TIMESTAMP}\"}" \
    $SLACK_WEBHOOK_URL
```

### 4. 자동 백업 시스템
```typescript
// backend-api/src/backup/backup.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { RDSClient, CreateDBSnapshotCommand } from '@aws-sdk/client-rds';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private s3Client: S3Client;
  private rdsClient: RDSClient;
  private backupBucket: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({ 
      region: this.configService.get('AWS_REGION') 
    });
    this.rdsClient = new RDSClient({ 
      region: this.configService.get('AWS_REGION') 
    });
    this.backupBucket = this.configService.get('BACKUP_S3_BUCKET');
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async performDailyBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`Starting daily backup at ${timestamp}`);

    try {
      const backupResult = await this.createFullBackup(timestamp);
      await this.notifyBackupSuccess(backupResult);
      await this.cleanupOldBackups();
    } catch (error) {
      console.error('Daily backup failed:', error);
      await this.notifyBackupFailure(error);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async performIncrementalBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    console.log(`Starting incremental backup at ${timestamp}`);

    try {
      await this.backupApplicationData(timestamp);
      await this.backupUserGeneratedContent(timestamp);
    } catch (error) {
      console.error('Incremental backup failed:', error);
    }
  }

  private async createFullBackup(timestamp: string): Promise<BackupResult> {
    const backupTasks = [
      this.createDatabaseSnapshot(timestamp),
      this.backupApplicationData(timestamp),
      this.backupUserGeneratedContent(timestamp),
      this.backupSystemConfiguration(timestamp),
    ];

    const results = await Promise.allSettled(backupTasks);
    
    return {
      timestamp,
      database: this.getResult(results[0]),
      applicationData: this.getResult(results[1]),
      userContent: this.getResult(results[2]),
      configuration: this.getResult(results[3]),
    };
  }

  private async createDatabaseSnapshot(timestamp: string): Promise<string> {
    const snapshotId = `vanillameta-db-backup-${timestamp}`;
    
    await this.rdsClient.send(new CreateDBSnapshotCommand({
      DBInstanceIdentifier: this.configService.get('DB_INSTANCE_ID'),
      DBSnapshotIdentifier: snapshotId,
      Tags: [
        { Key: 'Environment', Value: this.configService.get('NODE_ENV') },
        { Key: 'BackupType', Value: 'Automated' },
        { Key: 'Timestamp', Value: timestamp },
      ],
    }));

    return snapshotId;
  }

  private async backupApplicationData(timestamp: string): Promise<string> {
    // 사용자 대시보드 및 설정 백업
    const backupPath = `/tmp/app-data-backup-${timestamp}`;
    
    // 백업 데이터 수집
    const backupData = {
      dashboards: await this.exportDashboards(),
      dataSources: await this.exportDataSources(),
      userPreferences: await this.exportUserPreferences(),
      systemSettings: await this.exportSystemSettings(),
    };

    // JSON 파일로 저장
    fs.writeFileSync(
      `${backupPath}.json`,
      JSON.stringify(backupData, null, 2)
    );

    // S3에 업로드
    const key = `application-data/backup-${timestamp}.json`;
    await this.uploadToS3(key, `${backupPath}.json`);

    // 로컬 파일 정리
    fs.unlinkSync(`${backupPath}.json`);

    return key;
  }

  private async backupUserGeneratedContent(timestamp: string): Promise<string> {
    // 사용자가 업로드한 파일들 백업
    const sourceBucket = this.configService.get('USER_CONTENT_BUCKET');
    const backupKey = `user-content/backup-${timestamp}/`;

    try {
      // AWS CLI를 사용한 S3 동기화
      const { stdout, stderr } = await execAsync(
        `aws s3 sync s3://${sourceBucket} s3://${this.backupBucket}/${backupKey}`
      );

      if (stderr) {
        console.warn('S3 sync warnings:', stderr);
      }

      return backupKey;
    } catch (error) {
      console.error('User content backup failed:', error);
      throw error;
    }
  }

  private async backupSystemConfiguration(timestamp: string): Promise<string> {
    const configData = {
      environment: this.configService.get('NODE_ENV'),
      version: this.configService.get('APP_VERSION'),
      awsRegion: this.configService.get('AWS_REGION'),
      lambdaConfig: await this.getLambdaConfiguration(),
      apiGatewayConfig: await this.getApiGatewayConfiguration(),
      timestamp,
    };

    const backupPath = `/tmp/config-backup-${timestamp}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(configData, null, 2));

    const key = `configuration/backup-${timestamp}.json`;
    await this.uploadToS3(key, backupPath);

    fs.unlinkSync(backupPath);
    return key;
  }

  private async uploadToS3(key: string, filePath: string): Promise<void> {
    const fileContent = fs.readFileSync(filePath);
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.backupBucket,
      Key: key,
      Body: fileContent,
      ServerSideEncryption: 'AES256',
      Metadata: {
        'backup-timestamp': new Date().toISOString(),
        'environment': this.configService.get('NODE_ENV'),
      },
    }));
  }

  private async cleanupOldBackups(): Promise<void> {
    const retentionDays = 30; // 30일 보관
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // RDS 스냅샷 정리
    await this.cleanupOldRDSSnapshots(cutoffDate);
    
    // S3 백업 정리
    await this.cleanupOldS3Backups(cutoffDate);
  }

  private async cleanupOldRDSSnapshots(cutoffDate: Date): Promise<void> {
    // RDS 스냅샷 정리 로직 구현
    console.log(`Cleaning up RDS snapshots older than ${cutoffDate}`);
  }

  private async cleanupOldS3Backups(cutoffDate: Date): Promise<void> {
    // S3 백업 파일 정리 로직 구현
    console.log(`Cleaning up S3 backups older than ${cutoffDate}`);
  }

  // Helper methods
  private async exportDashboards(): Promise<any[]> {
    // 대시보드 데이터 내보내기 로직
    return [];
  }

  private async exportDataSources(): Promise<any[]> {
    // 데이터소스 설정 내보내기 로직
    return [];
  }

  private async exportUserPreferences(): Promise<any[]> {
    // 사용자 설정 내보내기 로직
    return [];
  }

  private async exportSystemSettings(): Promise<any> {
    // 시스템 설정 내보내기 로직
    return {};
  }

  private async getLambdaConfiguration(): Promise<any> {
    // Lambda 설정 조회 로직
    return {};
  }

  private async getApiGatewayConfiguration(): Promise<any> {
    // API Gateway 설정 조회 로직
    return {};
  }

  private getResult(result: PromiseSettledResult<any>): any {
    if (result.status === 'fulfilled') {
      return { success: true, data: result.value };
    } else {
      return { success: false, error: result.reason.message };
    }
  }

  private async notifyBackupSuccess(result: BackupResult): Promise<void> {
    // Slack 또는 이메일로 백업 성공 알림
    console.log('Backup completed successfully:', result);
  }

  private async notifyBackupFailure(error: Error): Promise<void> {
    // Slack 또는 이메일로 백업 실패 알림
    console.error('Backup failed:', error);
  }
}

interface BackupResult {
  timestamp: string;
  database: { success: boolean; data?: string; error?: string };
  applicationData: { success: boolean; data?: string; error?: string };
  userContent: { success: boolean; data?: string; error?: string };
  configuration: { success: boolean; data?: string; error?: string };
}
```

### 5. 복구 시스템
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

set -e

BACKUP_TIMESTAMP=$1
ENVIRONMENT=$2
RECOVERY_TYPE=${3:-"full"} # full, partial, config-only

if [ -z "$BACKUP_TIMESTAMP" ] || [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <backup-timestamp> <environment> [recovery-type]"
    echo "Recovery types: full, partial, config-only"
    exit 1
fi

BACKUP_BUCKET="vanillameta-backups"
RECOVERY_DIR="/tmp/recovery-${BACKUP_TIMESTAMP}"

echo "Starting disaster recovery for $ENVIRONMENT"
echo "Backup timestamp: $BACKUP_TIMESTAMP"
echo "Recovery type: $RECOVERY_TYPE"

# 복구 디렉토리 생성
mkdir -p $RECOVERY_DIR

case $RECOVERY_TYPE in
    "full")
        echo "Performing full system recovery..."
        
        # 1. 데이터베이스 복구
        echo "Restoring database from snapshot..."
        aws rds restore-db-instance-from-db-snapshot \
            --db-instance-identifier "vanillameta-db-${ENVIRONMENT}-recovery" \
            --db-snapshot-identifier "vanillameta-db-backup-${BACKUP_TIMESTAMP}"
        
        # 2. 애플리케이션 데이터 복구
        echo "Restoring application data..."
        aws s3 cp "s3://${BACKUP_BUCKET}/application-data/backup-${BACKUP_TIMESTAMP}.json" \
            "${RECOVERY_DIR}/app-data.json"
        
        # 3. 사용자 콘텐츠 복구
        echo "Restoring user content..."
        aws s3 sync "s3://${BACKUP_BUCKET}/user-content/backup-${BACKUP_TIMESTAMP}/" \
            "s3://vanillameta-${ENVIRONMENT}-data-recovery/"
        
        # 4. 시스템 설정 복구
        echo "Restoring system configuration..."
        aws s3 cp "s3://${BACKUP_BUCKET}/configuration/backup-${BACKUP_TIMESTAMP}.json" \
            "${RECOVERY_DIR}/config.json"
        ;;
        
    "partial")
        echo "Performing partial recovery (data only)..."
        
        # 애플리케이션 데이터만 복구
        aws s3 cp "s3://${BACKUP_BUCKET}/application-data/backup-${BACKUP_TIMESTAMP}.json" \
            "${RECOVERY_DIR}/app-data.json"
        ;;
        
    "config-only")
        echo "Performing configuration recovery only..."
        
        # 설정만 복구
        aws s3 cp "s3://${BACKUP_BUCKET}/configuration/backup-${BACKUP_TIMESTAMP}.json" \
            "${RECOVERY_DIR}/config.json"
        ;;
        
    *)
        echo "Unknown recovery type: $RECOVERY_TYPE"
        exit 1
        ;;
esac

# 복구 검증
echo "Verifying recovery..."
if [ -f "${RECOVERY_DIR}/app-data.json" ]; then
    echo "✅ Application data recovered"
    # 데이터 무결성 검증
    node ./scripts/verify-backup-integrity.js "${RECOVERY_DIR}/app-data.json"
fi

if [ -f "${RECOVERY_DIR}/config.json" ]; then
    echo "✅ Configuration recovered"
fi

echo "Recovery completed successfully!"
echo "Recovery files location: $RECOVERY_DIR"

# 복구 후 처리 작업 스케줄링
if [ "$RECOVERY_TYPE" = "full" ]; then
    echo "Scheduling post-recovery tasks..."
    
    # DNS 업데이트 (복구된 인스턴스로)
    # 애플리케이션 재시작
    # 헬스체크 실행
    
    echo "⚠️  Manual steps required:"
    echo "1. Update DNS to point to recovered database"
    echo "2. Restart application services"
    echo "3. Run full system health check"
    echo "4. Verify data integrity"
fi

# Slack 알림
curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"🔄 Disaster recovery completed\nEnvironment: $ENVIRONMENT\nBackup: $BACKUP_TIMESTAMP\nType: $RECOVERY_TYPE\"}" \
    $SLACK_WEBHOOK_URL
```

### 6. 배포 모니터링 및 롤백
```typescript
// backend-api/src/deployment/deployment-monitor.service.ts
import { Injectable } from '@nestjs/common';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

@Injectable()
export class DeploymentMonitorService {
  private cloudWatchClient: CloudWatchClient;

  constructor() {
    this.cloudWatchClient = new CloudWatchClient({ 
      region: process.env.AWS_REGION 
    });
  }

  async monitorDeployment(deploymentId: string): Promise<DeploymentStatus> {
    const monitoringPeriod = 10; // 10분
    const checkInterval = 30; // 30초
    const startTime = new Date();

    for (let i = 0; i < (monitoringPeriod * 60) / checkInterval; i++) {
      const metrics = await this.collectDeploymentMetrics();
      const status = this.evaluateDeploymentHealth(metrics);

      if (status.shouldRollback) {
        return {
          success: false,
          reason: status.reason,
          metrics,
          recommendedAction: 'ROLLBACK',
        };
      }

      if (status.isStable) {
        return {
          success: true,
          reason: 'Deployment is stable',
          metrics,
          recommendedAction: 'COMPLETE',
        };
      }

      // 다음 체크까지 대기
      await this.sleep(checkInterval * 1000);
    }

    return {
      success: false,
      reason: 'Deployment monitoring timeout',
      recommendedAction: 'INVESTIGATE',
    };
  }

  private async collectDeploymentMetrics(): Promise<DeploymentMetrics> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // 5분 전

    const [errorRate, latency, throughput] = await Promise.all([
      this.getErrorRate(startTime, endTime),
      this.getAverageLatency(startTime, endTime),
      this.getThroughput(startTime, endTime),
    ]);

    return {
      errorRate,
      latency,
      throughput,
      timestamp: endTime,
    };
  }

  private evaluateDeploymentHealth(metrics: DeploymentMetrics): HealthEvaluation {
    const thresholds = {
      maxErrorRate: 5, // 5%
      maxLatency: 2000, // 2초
      minThroughput: 10, // 10 req/min
    };

    if (metrics.errorRate > thresholds.maxErrorRate) {
      return {
        shouldRollback: true,
        reason: `Error rate too high: ${metrics.errorRate}%`,
        isStable: false,
      };
    }

    if (metrics.latency > thresholds.maxLatency) {
      return {
        shouldRollback: true,
        reason: `Latency too high: ${metrics.latency}ms`,
        isStable: false,
      };
    }

    if (metrics.throughput < thresholds.minThroughput) {
      return {
        shouldRollback: false,
        reason: `Low throughput: ${metrics.throughput} req/min`,
        isStable: false,
      };
    }

    return {
      shouldRollback: false,
      reason: 'All metrics within acceptable range',
      isStable: true,
    };
  }

  private async getErrorRate(startTime: Date, endTime: Date): Promise<number> {
    // CloudWatch에서 오류율 조회
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/ApiGateway',
      MetricName: '5XXError',
      StartTime: startTime,
      EndTime: endTime,
      Period: 300,
      Statistics: ['Sum'],
    });

    const response = await this.cloudWatchClient.send(command);
    const errors = response.Datapoints?.[0]?.Sum || 0;
    
    // 전체 요청 수 대비 오류율 계산
    const totalRequests = await this.getTotalRequests(startTime, endTime);
    return totalRequests > 0 ? (errors / totalRequests) * 100 : 0;
  }

  private async getAverageLatency(startTime: Date, endTime: Date): Promise<number> {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/ApiGateway',
      MetricName: 'Latency',
      StartTime: startTime,
      EndTime: endTime,
      Period: 300,
      Statistics: ['Average'],
    });

    const response = await this.cloudWatchClient.send(command);
    return response.Datapoints?.[0]?.Average || 0;
  }

  private async getThroughput(startTime: Date, endTime: Date): Promise<number> {
    const requests = await this.getTotalRequests(startTime, endTime);
    const minutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    return requests / minutes;
  }

  private async getTotalRequests(startTime: Date, endTime: Date): Promise<number> {
    const command = new GetMetricStatisticsCommand({
      Namespace: 'AWS/ApiGateway',
      MetricName: 'Count',
      StartTime: startTime,
      EndTime: endTime,
      Period: 300,
      Statistics: ['Sum'],
    });

    const response = await this.cloudWatchClient.send(command);
    return response.Datapoints?.[0]?.Sum || 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface DeploymentMetrics {
  errorRate: number;
  latency: number;
  throughput: number;
  timestamp: Date;
}

interface HealthEvaluation {
  shouldRollback: boolean;
  reason: string;
  isStable: boolean;
}

interface DeploymentStatus {
  success: boolean;
  reason: string;
  metrics?: DeploymentMetrics;
  recommendedAction: 'COMPLETE' | 'ROLLBACK' | 'INVESTIGATE';
}
```

## 검증 항목

### CI/CD 파이프라인
- [ ] 모든 스테이지 정상 실행
- [ ] 테스트 커버리지 80% 이상
- [ ] 보안 스캔 통과
- [ ] 자동 롤백 동작 확인

### 백업 시스템
- [ ] 일일/증분 백업 자동 실행
- [ ] 백업 데이터 무결성 검증
- [ ] 복구 시간 목표 달성 (RTO < 4시간)
- [ ] 복구 지점 목표 달성 (RPO < 1시간)

### 배포 자동화
- [ ] Blue-Green 배포 정상 동작
- [ ] 헬스체크 및 자동 롤백
- [ ] 트래픽 전환 무중단
- [ ] 배포 알림 시스템 작동

## 산출물
1. CI/CD 파이프라인 (GitHub Actions)
2. 배포 자동화 스크립트
3. 백업/복구 시스템
4. 배포 모니터링 도구
5. 재해 복구 플레이북

## 참고 자료
- [AWS CodePipeline Best Practices](https://docs.aws.amazon.com/codepipeline/latest/userguide/best-practices.html)
- [Blue-Green Deployment on AWS](https://docs.aws.amazon.com/whitepapers/latest/blue-green-deployments/welcome.html)
- [Disaster Recovery with AWS](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html)