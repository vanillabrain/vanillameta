#!/usr/bin/env node

/**
 * Slow Query Monitoring Setup Script
 * 
 * 이 스크립트는 AWS 환경에서 Slow Query Monitoring을 설정합니다.
 * - CloudWatch Dashboard 생성
 * - CloudWatch Alarms 설정
 * - SNS Topic 생성 및 구독 설정
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// AWS 설정
const cloudformation = new AWS.CloudFormation({
  region: process.env.AWS_REGION || 'us-east-1'
});

const cloudwatch = new AWS.CloudWatch({
  region: process.env.AWS_REGION || 'us-east-1'
});

const sns = new AWS.SNS({
  region: process.env.AWS_REGION || 'us-east-1'
});

// 환경 설정
const config = {
  environment: process.env.NODE_ENV || 'dev',
  serviceName: process.env.SERVICE_NAME || 'vanillameta-backend-api',
  region: process.env.AWS_REGION || 'us-east-1',
  alertEmail: process.env.ALERT_EMAIL,
  slackWebhook: process.env.SLACK_WEBHOOK_URL
};

console.log('🚀 Setting up Slow Query Monitoring...');
console.log('Configuration:', config);

async function main() {
  try {
    // 1. CloudFormation 스택 배포
    await deployCloudFormationStack();
    
    // 2. 추가 CloudWatch 알람 설정
    await setupAdditionalAlarms();
    
    // 3. SNS 알림 설정
    await setupNotifications();
    
    // 4. 대시보드 URL 출력
    await printDashboardUrls();
    
    console.log('✅ Slow Query Monitoring setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

/**
 * CloudFormation 스택 배포
 */
async function deployCloudFormationStack() {
  console.log('📦 Deploying CloudFormation stack...');
  
  const templatePath = path.join(__dirname, '../cloudformation/slow-query-monitoring-dashboard.yml');
  const templateBody = fs.readFileSync(templatePath, 'utf8');
  
  const stackName = `${config.serviceName}-${config.environment}-slow-query-monitoring`;
  
  const params = {
    StackName: stackName,
    TemplateBody: templateBody,
    Parameters: [
      {
        ParameterKey: 'Environment',
        ParameterValue: config.environment
      },
      {
        ParameterKey: 'ServiceName',
        ParameterValue: config.serviceName
      }
    ],
    Capabilities: ['CAPABILITY_IAM'],
    Tags: [
      {
        Key: 'Environment',
        Value: config.environment
      },
      {
        Key: 'Service',
        Value: 'VanillaMeta'
      },
      {
        Key: 'Component',
        Value: 'SlowQueryMonitoring'
      }
    ]
  };
  
  try {
    // 스택이 이미 존재하는지 확인
    try {
      await cloudformation.describeStacks({ StackName: stackName }).promise();
      console.log('📝 Stack exists, updating...');
      await cloudformation.updateStack(params).promise();
    } catch (error) {
      if (error.code === 'ValidationError' && error.message.includes('does not exist')) {
        console.log('🆕 Creating new stack...');
        await cloudformation.createStack(params).promise();
      } else {
        throw error;
      }
    }
    
    // 스택 배포 완료 대기
    console.log('⏳ Waiting for stack deployment...');
    await cloudformation.waitFor('stackCreateComplete', { StackName: stackName }).promise();
    console.log('✅ CloudFormation stack deployed successfully');
    
  } catch (error) {
    if (error.code === 'ValidationError' && error.message.includes('No updates')) {
      console.log('ℹ️ No updates needed for CloudFormation stack');
    } else {
      throw error;
    }
  }
}

/**
 * 추가 CloudWatch 알람 설정
 */
async function setupAdditionalAlarms() {
  console.log('⚠️ Setting up additional CloudWatch alarms...');
  
  const alarms = [
    {
      AlarmName: `${config.serviceName}-${config.environment}-query-performance-degradation`,
      AlarmDescription: 'Overall database query performance degradation',
      MetricName: 'SlowQueryExecutionTime',
      Namespace: `VanillaMeta/${config.environment}/Database`,
      Statistic: 'Average',
      Period: 900, // 15 minutes
      EvaluationPeriods: 2,
      Threshold: 5000, // 5 seconds average
      ComparisonOperator: 'GreaterThanThreshold'
    },
    {
      AlarmName: `${config.serviceName}-${config.environment}-high-slow-query-rate`,
      AlarmDescription: 'High rate of slow queries detected',
      MetricName: 'SlowQueryCount',
      Namespace: `VanillaMeta/${config.environment}/Database`,
      Statistic: 'Sum',
      Period: 300, // 5 minutes
      EvaluationPeriods: 3,
      Threshold: 25, // More than 25 slow queries in 15 minutes
      ComparisonOperator: 'GreaterThanThreshold'
    }
  ];
  
  for (const alarm of alarms) {
    try {
      await cloudwatch.putMetricAlarm({
        ...alarm,
        TreatMissingData: 'notBreaching',
        AlarmActions: [] // SNS Topic will be added later
      }).promise();
      
      console.log(`✅ Created alarm: ${alarm.AlarmName}`);
    } catch (error) {
      console.error(`❌ Failed to create alarm ${alarm.AlarmName}:`, error.message);
    }
  }
}

/**
 * SNS 알림 설정
 */
async function setupNotifications() {
  if (!config.alertEmail && !config.slackWebhook) {
    console.log('ℹ️ No alert email or Slack webhook configured, skipping notification setup');
    return;
  }
  
  console.log('📧 Setting up SNS notifications...');
  
  const topicName = `${config.serviceName}-${config.environment}-slow-query-alerts`;
  
  try {
    // SNS Topic 생성
    const topic = await sns.createTopic({
      Name: topicName,
      Tags: [
        {
          Key: 'Environment',
          Value: config.environment
        },
        {
          Key: 'Service',
          Value: 'VanillaMeta'
        }
      ]
    }).promise();
    
    console.log(`✅ Created SNS topic: ${topic.TopicArn}`);
    
    // 이메일 구독 설정
    if (config.alertEmail) {
      await sns.subscribe({
        TopicArn: topic.TopicArn,
        Protocol: 'email',
        Endpoint: config.alertEmail
      }).promise();
      
      console.log(`✅ Added email subscription: ${config.alertEmail}`);
      console.log('📧 Please check your email and confirm the subscription');
    }
    
    // Slack webhook 구독 설정 (Lambda 함수가 필요하므로 여기서는 스킵)
    if (config.slackWebhook) {
      console.log('ℹ️ Slack webhook configured, but requires Lambda function setup');
      console.log(`Slack Webhook URL: ${config.slackWebhook}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to setup notifications:', error.message);
  }
}

/**
 * 대시보드 URL 출력
 */
async function printDashboardUrls() {
  console.log('\n📊 Dashboard URLs:');
  
  const dashboardName = `${config.serviceName}-${config.environment}-slow-query-monitoring`;
  const mainDashboardName = `${config.serviceName}-${config.environment}-monitoring`;
  
  const slowQueryDashboardUrl = `https://${config.region}.console.aws.amazon.com/cloudwatch/home?region=${config.region}#dashboards:name=${dashboardName}`;
  const mainDashboardUrl = `https://${config.region}.console.aws.amazon.com/cloudwatch/home?region=${config.region}#dashboards:name=${mainDashboardName}`;
  
  console.log(`🎯 Slow Query Dashboard: ${slowQueryDashboardUrl}`);
  console.log(`📈 Main Dashboard: ${mainDashboardUrl}`);
  
  // CloudWatch Insights 쿼리 예제 출력
  console.log('\n🔍 Useful CloudWatch Insights Queries:');
  console.log('\n1. Recent slow queries:');
  console.log(`SOURCE '/aws/lambda/${config.serviceName}-${config.environment}-app'
| fields @timestamp, message, metadata.executionTime, metadata.queryHash
| filter message like /Slow query detected/
| sort @timestamp desc
| limit 50`);
  
  console.log('\n2. Slow query trends:');
  console.log(`SOURCE '/aws/lambda/${config.serviceName}-${config.environment}-app'
| fields @timestamp, metadata.executionTime
| filter message like /Slow query detected/
| stats count() as count, avg(metadata.executionTime) as avgTime by bin(1h)
| sort @timestamp asc`);
  
  console.log('\n3. Most problematic queries:');
  console.log(`SOURCE '/aws/lambda/${config.serviceName}-${config.environment}-app'
| fields metadata.queryHash, metadata.executionTime, metadata.severity
| filter message like /Slow query detected/
| stats count() as occurrences, avg(metadata.executionTime) as avgTime by metadata.queryHash
| sort occurrences desc
| limit 20`);
}

/**
 * 환경 변수 검증
 */
function validateEnvironment() {
  const required = ['AWS_REGION'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set the following environment variables:');
    console.error('- AWS_REGION: AWS region (e.g., us-east-1)');
    console.error('- ALERT_EMAIL: Email for alert notifications (optional)');
    console.error('- SLACK_WEBHOOK_URL: Slack webhook URL (optional)');
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  validateEnvironment();
  main();
}

module.exports = {
  deployCloudFormationStack,
  setupAdditionalAlarms,
  setupNotifications,
  printDashboardUrls
};