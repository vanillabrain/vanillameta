import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CustomLoggerService } from '../logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { CacheMonitoringEvent } from './cache-monitoring.service';

/**
 * 알림 채널 타입
 */
export enum AlertChannel {
  LOG = 'log',
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
}

/**
 * 알림 규칙
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: {
    metric: string;
    operator: 'lt' | 'gt' | 'eq' | 'lte' | 'gte';
    threshold: number;
  };
  severity: 'info' | 'warning' | 'error' | 'critical';
  channels: AlertChannel[];
  cooldown: number; // 동일 알림 재발송 방지 시간 (밀리초)
}

/**
 * 알림 기록
 */
export interface AlertHistory {
  ruleId: string;
  timestamp: number;
  severity: string;
  message: string;
  metadata: any;
}

/**
 * 캐시 알림 서비스
 * 캐시 성능 문제 감지 시 알림 발송
 */
@Injectable()
export class CacheAlertService {
  private readonly logger = new Logger(CacheAlertService.name);
  private alertHistory: Map<string, AlertHistory[]> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  
  private readonly DEFAULT_RULES: AlertRule[] = [
    {
      id: 'low-hit-rate',
      name: '낮은 캐시 히트율',
      description: '캐시 히트율이 70% 미만으로 떨어짐',
      condition: {
        metric: 'hitRate',
        operator: 'lt',
        threshold: 0.7,
      },
      severity: 'warning',
      channels: [AlertChannel.LOG, AlertChannel.SLACK],
      cooldown: 300000, // 5분
    },
    {
      id: 'critical-hit-rate',
      name: '위험한 캐시 히트율',
      description: '캐시 히트율이 50% 미만으로 떨어짐',
      condition: {
        metric: 'hitRate',
        operator: 'lt',
        threshold: 0.5,
      },
      severity: 'critical',
      channels: [AlertChannel.LOG, AlertChannel.EMAIL, AlertChannel.SLACK],
      cooldown: 600000, // 10분
    },
    {
      id: 'high-latency',
      name: '높은 지연 시간',
      description: 'Redis 응답 시간이 100ms 초과',
      condition: {
        metric: 'latency',
        operator: 'gt',
        threshold: 100,
      },
      severity: 'warning',
      channels: [AlertChannel.LOG],
      cooldown: 300000, // 5분
    },
    {
      id: 'redis-disconnected',
      name: 'Redis 연결 끊김',
      description: 'Redis 서버와의 연결이 끊어짐',
      condition: {
        metric: 'connectionStatus',
        operator: 'eq',
        threshold: 0, // disconnected = 0
      },
      severity: 'critical',
      channels: [AlertChannel.LOG, AlertChannel.EMAIL, AlertChannel.SLACK],
      cooldown: 60000, // 1분
    },
    {
      id: 'memory-pressure',
      name: '메모리 부족',
      description: '캐시 메모리 사용률이 90% 초과',
      condition: {
        metric: 'memoryUsage',
        operator: 'gt',
        threshold: 0.9,
      },
      severity: 'warning',
      channels: [AlertChannel.LOG, AlertChannel.SLACK],
      cooldown: 600000, // 10분
    },
  ];

  constructor(
    private readonly customLogger: CustomLoggerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 캐시 알림 이벤트 처리
   */
  @OnEvent('cache.alert')
  async handleCacheAlert(event: CacheMonitoringEvent) {
    this.customLogger.debug('Handling cache alert event', 'CacheAlertService', {
      type: event.type,
      severity: event.severity,
      engine: event.engine,
    });

    // 적용 가능한 규칙 찾기
    const applicableRules = this.findApplicableRules(event);
    
    for (const rule of applicableRules) {
      // Cooldown 체크
      if (this.isInCooldown(rule.id, event.engine)) {
        continue;
      }
      
      // 알림 발송
      await this.sendAlert(rule, event);
      
      // 히스토리 기록
      this.recordAlert(rule, event);
    }
  }

  /**
   * 메트릭 수집 이벤트 처리
   */
  @OnEvent('cache.metrics.collected')
  async handleMetricsCollected(payload: {
    engine: string;
    metrics: any;
    timestamp: number;
  }) {
    const { engine, metrics } = payload;
    
    // 규칙별로 체크
    for (const rule of this.DEFAULT_RULES) {
      const shouldAlert = this.evaluateRule(rule, metrics);
      
      if (shouldAlert && !this.isInCooldown(rule.id, engine)) {
        const event: CacheMonitoringEvent = {
          type: 'performance',
          severity: rule.severity,
          engine,
          metrics,
          message: `${rule.name}: ${rule.description}`,
          timestamp: Date.now(),
        };
        
        await this.sendAlert(rule, event);
        this.recordAlert(rule, event);
      }
    }
  }

  /**
   * 규칙 평가
   */
  private evaluateRule(rule: AlertRule, metrics: any): boolean {
    const value = this.getMetricValue(rule.condition.metric, metrics);
    if (value === null) return false;
    
    switch (rule.condition.operator) {
      case 'lt':
        return value < rule.condition.threshold;
      case 'gt':
        return value > rule.condition.threshold;
      case 'eq':
        return value === rule.condition.threshold;
      case 'lte':
        return value <= rule.condition.threshold;
      case 'gte':
        return value >= rule.condition.threshold;
      default:
        return false;
    }
  }

  /**
   * 메트릭 값 추출
   */
  private getMetricValue(metric: string, metrics: any): number | null {
    switch (metric) {
      case 'hitRate':
        return metrics.overall?.hitRate ?? null;
      case 'latency':
        return metrics.l2?.latency?.avg ?? null;
      case 'connectionStatus':
        return metrics.l2?.connectionStatus === 'connected' ? 1 : 0;
      case 'memoryUsage':
        const usage = metrics.l1?.memoryUsage || 0;
        const maxSize = metrics.l1?.maxSize || 1;
        return usage / (maxSize * 1024 * 1024); // MB 단위 가정
      default:
        return null;
    }
  }

  /**
   * 적용 가능한 규칙 찾기
   */
  private findApplicableRules(event: CacheMonitoringEvent): AlertRule[] {
    return this.DEFAULT_RULES.filter(rule => {
      // 심각도가 일치하거나 더 높은 경우
      const severityLevels = { info: 0, warning: 1, error: 2, critical: 3 };
      return severityLevels[event.severity] >= severityLevels[rule.severity];
    });
  }

  /**
   * Cooldown 상태 확인
   */
  private isInCooldown(ruleId: string, engine: string): boolean {
    const key = `${ruleId}:${engine}`;
    const lastAlert = this.lastAlertTime.get(key);
    
    if (!lastAlert) return false;
    
    const rule = this.DEFAULT_RULES.find(r => r.id === ruleId);
    if (!rule) return false;
    
    return Date.now() - lastAlert < rule.cooldown;
  }

  /**
   * 알림 발송
   */
  private async sendAlert(rule: AlertRule, event: CacheMonitoringEvent) {
    for (const channel of rule.channels) {
      try {
        switch (channel) {
          case AlertChannel.LOG:
            await this.sendLogAlert(rule, event);
            break;
          case AlertChannel.EMAIL:
            await this.sendEmailAlert(rule, event);
            break;
          case AlertChannel.SLACK:
            await this.sendSlackAlert(rule, event);
            break;
          case AlertChannel.WEBHOOK:
            await this.sendWebhookAlert(rule, event);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send alert via ${channel}:`, error);
      }
    }
    
    // 마지막 알림 시간 업데이트
    const key = `${rule.id}:${event.engine}`;
    this.lastAlertTime.set(key, Date.now());
  }

  /**
   * 로그 알림
   */
  private async sendLogAlert(rule: AlertRule, event: CacheMonitoringEvent) {
    const logLevel = event.severity === 'critical' ? 'error' : 
                    event.severity === 'error' ? 'error' :
                    event.severity === 'warning' ? 'warn' : 'log';
    
    this.customLogger[logLevel](
      `[CACHE ALERT] ${rule.name}`,
      'CacheAlertService',
      {
        rule: rule.id,
        engine: event.engine,
        severity: event.severity,
        message: event.message,
        metrics: event.metrics,
      },
    );
  }

  /**
   * 이메일 알림
   */
  private async sendEmailAlert(rule: AlertRule, event: CacheMonitoringEvent) {
    // TODO: 이메일 서비스 연동
    this.logger.log('Email alert would be sent:', {
      to: this.configService.get('ALERT_EMAIL_RECIPIENTS'),
      subject: `[${event.severity.toUpperCase()}] ${rule.name} - ${event.engine}`,
      body: this.formatAlertMessage(rule, event),
    });
  }

  /**
   * Slack 알림
   */
  private async sendSlackAlert(rule: AlertRule, event: CacheMonitoringEvent) {
    const webhookUrl = this.configService.get('SLACK_WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.warn('Slack webhook URL not configured');
      return;
    }
    
    const color = event.severity === 'critical' ? '#FF0000' :
                 event.severity === 'error' ? '#FF6600' :
                 event.severity === 'warning' ? '#FFCC00' : '#00CC00';
    
    const payload = {
      username: 'VanillaMeta Cache Monitor',
      icon_emoji: ':warning:',
      attachments: [{
        color,
        title: `${rule.name} (${event.engine})`,
        text: event.message,
        fields: [
          {
            title: '심각도',
            value: event.severity.toUpperCase(),
            short: true,
          },
          {
            title: '엔진',
            value: event.engine,
            short: true,
          },
          {
            title: '시간',
            value: new Date(event.timestamp).toLocaleString('ko-KR'),
            short: true,
          },
        ],
        footer: 'VanillaMeta Cache Monitoring',
        ts: Math.floor(event.timestamp / 1000),
      }],
    };
    
    // TODO: Slack API 호출
    this.logger.log('Slack alert would be sent:', payload);
  }

  /**
   * Webhook 알림
   */
  private async sendWebhookAlert(rule: AlertRule, event: CacheMonitoringEvent) {
    const webhookUrl = this.configService.get('ALERT_WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.warn('Alert webhook URL not configured');
      return;
    }
    
    const payload = {
      timestamp: event.timestamp,
      rule: {
        id: rule.id,
        name: rule.name,
      },
      event: {
        type: event.type,
        severity: event.severity,
        engine: event.engine,
        message: event.message,
        metrics: event.metrics,
      },
    };
    
    // TODO: Webhook API 호출
    this.logger.log('Webhook alert would be sent:', payload);
  }

  /**
   * 알림 메시지 포맷팅
   */
  private formatAlertMessage(rule: AlertRule, event: CacheMonitoringEvent): string {
    const lines = [
      `캐시 알림: ${rule.name}`,
      `엔진: ${event.engine}`,
      `심각도: ${event.severity.toUpperCase()}`,
      `설명: ${event.message}`,
      `시간: ${new Date(event.timestamp).toLocaleString('ko-KR')}`,
    ];
    
    if (event.metrics) {
      lines.push('');
      lines.push('주요 메트릭:');
      lines.push(`- 히트율: ${(event.metrics.overall?.hitRate * 100).toFixed(1)}%`);
      lines.push(`- 평균 응답 시간: ${event.metrics.overall?.avgResponseTime?.toFixed(2)}ms`);
      lines.push(`- 총 요청 수: ${event.metrics.overall?.totalRequests?.toLocaleString()}`);
    }
    
    return lines.join('\n');
  }

  /**
   * 알림 기록
   */
  private recordAlert(rule: AlertRule, event: CacheMonitoringEvent) {
    const history: AlertHistory = {
      ruleId: rule.id,
      timestamp: event.timestamp,
      severity: event.severity,
      message: event.message,
      metadata: {
        engine: event.engine,
        metrics: event.metrics,
      },
    };
    
    const key = `${rule.id}:${event.engine}`;
    if (!this.alertHistory.has(key)) {
      this.alertHistory.set(key, []);
    }
    
    const histories = this.alertHistory.get(key)!;
    histories.push(history);
    
    // 최대 100개까지만 유지
    if (histories.length > 100) {
      histories.shift();
    }
  }

  /**
   * 알림 히스토리 조회
   */
  getAlertHistory(engine?: string, ruleId?: string): AlertHistory[] {
    const results: AlertHistory[] = [];
    
    for (const [key, histories] of this.alertHistory.entries()) {
      const [rid, eng] = key.split(':');
      
      if (engine && eng !== engine) continue;
      if (ruleId && rid !== ruleId) continue;
      
      results.push(...histories);
    }
    
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 알림 규칙 조회
   */
  getAlertRules(): AlertRule[] {
    return this.DEFAULT_RULES;
  }

  /**
   * 알림 상태 조회
   */
  getAlertStatus(): {
    activeAlerts: number;
    recentAlerts: AlertHistory[];
    cooldowns: Array<{
      rule: string;
      engine: string;
      remainingTime: number;
    }>;
  } {
    const now = Date.now();
    const recentAlerts = this.getAlertHistory()
      .filter(alert => now - alert.timestamp < 3600000); // 1시간 이내
    
    const cooldowns: Array<{
      rule: string;
      engine: string;
      remainingTime: number;
    }> = [];
    
    for (const [key, lastTime] of this.lastAlertTime.entries()) {
      const [ruleId, engine] = key.split(':');
      const rule = this.DEFAULT_RULES.find(r => r.id === ruleId);
      
      if (rule) {
        const remainingTime = Math.max(0, rule.cooldown - (now - lastTime));
        if (remainingTime > 0) {
          cooldowns.push({
            rule: rule.name,
            engine,
            remainingTime,
          });
        }
      }
    }
    
    return {
      activeAlerts: recentAlerts.filter(a => a.severity === 'critical' || a.severity === 'error').length,
      recentAlerts: recentAlerts.slice(0, 10),
      cooldowns,
    };
  }
}