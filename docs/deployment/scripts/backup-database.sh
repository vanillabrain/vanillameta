#!/bin/bash
# backup-database.sh
# VanillaMeta 데이터베이스 백업 스크립트

STAGE=${1:-prod}
PROFILE="vanillameta-${STAGE}"
BACKUP_TYPE=${2:-"snapshot"} # snapshot or export

echo "=== VanillaMeta Database Backup ==="
echo "Stage: $STAGE"
echo "Profile: $PROFILE"
echo "Backup Type: $BACKUP_TYPE"
echo "Time: $(date)"
echo ""

# RDS 인스턴스 식별자
DB_INSTANCE="vanillameta-${STAGE}"

# 현재 DB 상태 확인
echo "Checking database status..."
DB_STATUS=$(aws rds describe-db-instances \
    --db-instance-identifier $DB_INSTANCE \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text \
    --profile $PROFILE 2>/dev/null)

if [ -z "$DB_STATUS" ]; then
    echo "❌ Database instance '$DB_INSTANCE' not found"
    exit 1
fi

if [ "$DB_STATUS" != "available" ]; then
    echo "⚠️  Warning: Database status is '$DB_STATUS' (not 'available')"
    read -p "Continue anyway? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Backup cancelled."
        exit 0
    fi
fi

# 백업 실행
if [ "$BACKUP_TYPE" == "snapshot" ]; then
    # 스냅샷 백업
    SNAPSHOT_ID="${DB_INSTANCE}-manual-$(date +%Y%m%d-%H%M%S)"
    
    echo "Creating manual snapshot: $SNAPSHOT_ID"
    aws rds create-db-snapshot \
        --db-instance-identifier $DB_INSTANCE \
        --db-snapshot-identifier $SNAPSHOT_ID \
        --tags Key=Type,Value=Manual Key=CreatedBy,Value=$USER Key=Stage,Value=$STAGE \
        --profile $PROFILE
    
    if [ $? -eq 0 ]; then
        echo "✅ Snapshot creation initiated: $SNAPSHOT_ID"
        
        # 진행 상황 모니터링
        echo -e "\nMonitoring snapshot progress..."
        while true; do
            STATUS=$(aws rds describe-db-snapshots \
                --db-snapshot-identifier $SNAPSHOT_ID \
                --query 'DBSnapshots[0].Status' \
                --output text \
                --profile $PROFILE 2>/dev/null)
            
            if [ "$STATUS" == "available" ]; then
                echo "✅ Snapshot completed successfully!"
                break
            elif [ "$STATUS" == "failed" ]; then
                echo "❌ Snapshot failed!"
                exit 1
            else
                echo "Status: $STATUS (waiting...)"
                sleep 30
            fi
        done
        
        # 스냅샷 정보 출력
        echo -e "\nSnapshot Details:"
        aws rds describe-db-snapshots \
            --db-snapshot-identifier $SNAPSHOT_ID \
            --query 'DBSnapshots[0].[DBSnapshotIdentifier, SnapshotCreateTime, AllocatedStorage, Status]' \
            --output table \
            --profile $PROFILE
    else
        echo "❌ Failed to create snapshot"
        exit 1
    fi
    
elif [ "$BACKUP_TYPE" == "export" ]; then
    # S3로 내보내기
    EXPORT_ID="${DB_INSTANCE}-export-$(date +%Y%m%d-%H%M%S)"
    S3_BUCKET="vanillameta-backup-${STAGE}"
    S3_PREFIX="database-exports/$(date +%Y/%m/%d)/"
    
    echo "Exporting to S3..."
    echo "Export ID: $EXPORT_ID"
    echo "S3 Location: s3://${S3_BUCKET}/${S3_PREFIX}"
    
    # 최신 스냅샷 찾기
    LATEST_SNAPSHOT=$(aws rds describe-db-snapshots \
        --db-instance-identifier $DB_INSTANCE \
        --query 'DBSnapshots[?Status==`available`] | [0].DBSnapshotIdentifier' \
        --output text \
        --profile $PROFILE)
    
    if [ -z "$LATEST_SNAPSHOT" ]; then
        echo "❌ No available snapshots found. Please create a snapshot first."
        exit 1
    fi
    
    echo "Using snapshot: $LATEST_SNAPSHOT"
    
    # KMS 키 찾기
    KMS_KEY=$(aws kms list-aliases \
        --query "Aliases[?AliasName=='alias/aws/rds'].TargetKeyId" \
        --output text \
        --profile $PROFILE)
    
    # S3로 내보내기 시작
    aws rds start-export-task \
        --export-task-identifier $EXPORT_ID \
        --source-arn "arn:aws:rds:${AWS_DEFAULT_REGION}:${AWS_ACCOUNT_ID}:snapshot:${LATEST_SNAPSHOT}" \
        --s3-bucket-name $S3_BUCKET \
        --s3-prefix $S3_PREFIX \
        --iam-role-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:role/rds-s3-export-role" \
        --kms-key-id $KMS_KEY \
        --profile $PROFILE
    
    if [ $? -eq 0 ]; then
        echo "✅ Export task started: $EXPORT_ID"
        echo "Check AWS console for progress"
    else
        echo "❌ Failed to start export task"
        exit 1
    fi
fi

# 기존 백업 정리
echo -e "\n=== Backup Cleanup ==="
echo "Current manual snapshots:"

# 수동 스냅샷 목록
aws rds describe-db-snapshots \
    --db-instance-identifier $DB_INSTANCE \
    --snapshot-type manual \
    --query 'DBSnapshots[].[DBSnapshotIdentifier, SnapshotCreateTime, AllocatedStorage]' \
    --output table \
    --profile $PROFILE

# 오래된 백업 개수 확인
OLD_SNAPSHOTS=$(aws rds describe-db-snapshots \
    --db-instance-identifier $DB_INSTANCE \
    --snapshot-type manual \
    --query "DBSnapshots[?SnapshotCreateTime<'$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S.000Z)'].DBSnapshotIdentifier" \
    --output text \
    --profile $PROFILE)

if [ ! -z "$OLD_SNAPSHOTS" ]; then
    echo -e "\n⚠️  Found snapshots older than 30 days:"
    echo "$OLD_SNAPSHOTS"
    echo "Consider deleting old snapshots to save storage costs."
fi

echo -e "\n=== Backup Complete ==="