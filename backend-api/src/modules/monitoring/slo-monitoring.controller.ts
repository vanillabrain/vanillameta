import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SLOTrackingService, SLOMetric, SLOReport, SLODefinition } from '../../common/services/slo-tracking.service';
import { XRayIntegrationService } from '../../common/services/xray-integration.service';
import { CloudWatchIntegrationService } from '../../common/services/cloudwatch-integration.service';

/**
 * SLO 모니터링 컨트롤러
 * 
 * Service Level Objectives 조회 및 보고서 생성 API를 제공합니다.
 */
@ApiTags('SLO Monitoring')
@Controller('monitoring/slo')
export class SLOMonitoringController {
  constructor(
    private readonly sloService: SLOTrackingService,
    private readonly xrayService: XRayIntegrationService,
    private readonly cloudwatchService: CloudWatchIntegrationService,
  ) {}

  /**
   * 모든 SLO 메트릭 조회
   */
  @Get('metrics')
  @ApiOperation({ summary: '모든 SLO 메트릭 조회' })
  @ApiResponse({ status: 200, description: 'SLO 메트릭 목록 반환' })
  async getAllSLOMetrics(): Promise<SLOMetric[]> {
    const segment = this.xrayService.createSubsegment('slo_metrics_query');
    
    try {
      const metrics = this.sloService.getAllSLOMetrics();
      
      if (segment) {
        segment.addAnnotation('metrics_count', metrics.length);
      }
      
      return metrics;
    } finally {
      this.xrayService.closeTrace(segment, true);
    }
  }

  /**
   * 특정 SLO 메트릭 조회
   */
  @Get('metrics/:sloName')
  @ApiOperation({ summary: '특정 SLO 메트릭 조회' })
  @ApiResponse({ status: 200, description: 'SLO 메트릭 상세 정보 반환' })
  @ApiResponse({ status: 404, description: 'SLO를 찾을 수 없음' })
  async getSLOMetric(@Query('sloName') sloName: string): Promise<SLOMetric | null> {
    const segment = this.xrayService.createSubsegment('slo_metric_detail');
    
    try {
      if (segment) {
        segment.addAnnotation('slo_name', sloName);
      }
      
      const metric = this.sloService.getSLOMetric(sloName);
      return metric || null;
    } finally {
      this.xrayService.closeTrace(segment, true);
    }
  }

  /**
   * SLO 정의 목록 조회
   */
  @Get('definitions')
  @ApiOperation({ summary: 'SLO 정의 목록 조회' })
  @ApiResponse({ status: 200, description: 'SLO 정의 목록 반환' })
  async getSLODefinitions(): Promise<SLODefinition[]> {
    const segment = this.xrayService.createSubsegment('slo_definitions_query');
    
    try {
      const definitions = this.sloService.getSLODefinitions();
      
      if (segment) {
        segment.addAnnotation('definitions_count', definitions.length);
      }
      
      return definitions;
    } finally {
      this.xrayService.closeTrace(segment, true);
    }
  }

  /**
   * SLO 컴플라이언스 리포트 생성
   */
  @Get('report')
  @ApiOperation({ summary: 'SLO 컴플라이언스 리포트 생성' })
  @ApiQuery({ name: 'period', required: false, description: '리포트 기간 (daily, weekly, monthly)' })
  @ApiResponse({ status: 200, description: 'SLO 컴플라이언스 리포트 반환' })
  async getSLOReport(@Query('period') period = 'daily'): Promise<SLOReport> {
    const segment = this.xrayService.createSubsegment('slo_report_generation');
    
    try {
      if (segment) {
        segment.addAnnotation('report_period', period);
      }
      
      const report = this.sloService.generateSLOReport(period);
      
      if (segment) {
        segment.addAnnotation('overall_compliance', report.overall.compliance);
        segment.addAnnotation('healthy_slos', report.overall.healthySLOs);
        segment.addAnnotation('total_slos', report.overall.totalSLOs);
      }
      
      return report;
    } finally {
      this.xrayService.closeTrace(segment, true);
    }
  }

  /**
   * SLO 대시보드 설정 정보 조회
   */
  @Get('dashboard-config')
  @ApiOperation({ summary: 'SLO 대시보드 설정 정보 조회' })
  @ApiResponse({ status: 200, description: 'SLO 대시보드 설정 정보 반환' })
  async getSLODashboardConfig(): Promise<any> {
    const segment = this.xrayService.createSubsegment('slo_dashboard_config');
    
    try {
      const definitions = this.sloService.getSLODefinitions();
      const metrics = this.sloService.getAllSLOMetrics();
      const cloudwatchMetrics = this.cloudwatchService.getMetricDefinitions();
      
      const dashboardConfig = {
        sloDefinitions: definitions,
        currentMetrics: metrics,
        cloudwatchNamespace: cloudwatchMetrics.namespace,
        widgets: [
          {
            name: 'SLO Overall Compliance',
            type: 'line',
            metrics: [
              ['VanillaMeta/API', 'SLO_Overall_Compliance'],
            ],
          },
          {
            name: 'API Availability',
            type: 'gauge',
            metrics: [
              ['VanillaMeta/API', 'SLO_api_availability_Current'],
            ],
            alarm: {
              threshold: 99.0,
              comparisonOperator: 'LessThanThreshold',
            },
          },
          {
            name: 'API Response Time P95',
            type: 'line',
            metrics: [
              ['VanillaMeta/API', 'SLO_api_response_time_p95_Current'],
            ],
            alarm: {
              threshold: 1000,
              comparisonOperator: 'GreaterThanThreshold',
            },
          },
          {
            name: 'SLO Compliance by Service',
            type: 'bar',
            metrics: definitions.map(def => [
              'VanillaMeta/API',
              `SLO_${def.name}_Compliance`,
              'SLO_Name',
              def.name,
            ]),
          },
        ],
        alarms: definitions.map(def => ({
          name: `SLO-${def.name}-Critical`,
          metricName: `SLO_${def.name}_Compliance`,
          threshold: def.threshold.critical,
          comparisonOperator: 'LessThanThreshold',
          evaluationPeriods: 2,
          period: 300,
        })),
      };
      
      if (segment) {
        segment.addAnnotation('widgets_count', dashboardConfig.widgets.length);
        segment.addAnnotation('alarms_count', dashboardConfig.alarms.length);
      }
      
      return dashboardConfig;
    } finally {
      this.xrayService.closeTrace(segment, true);
    }
  }

  /**
   * SLO 상태 요약 정보 조회
   */
  @Get('status')
  @ApiOperation({ summary: 'SLO 상태 요약 정보 조회' })
  @ApiResponse({ status: 200, description: 'SLO 상태 요약 정보 반환' })
  async getSLOStatus(): Promise<any> {
    const segment = this.xrayService.createSubsegment('slo_status_summary');
    
    try {
      const metrics = this.sloService.getAllSLOMetrics();
      const healthyCount = metrics.filter(m => m.status === 'healthy').length;
      const warningCount = metrics.filter(m => m.status === 'warning').length;
      const criticalCount = metrics.filter(m => m.status === 'critical').length;
      
      const overallCompliance = metrics.reduce((sum, m) => sum + m.compliance, 0) / metrics.length;
      
      const status = {
        overall: {
          status: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy',
          compliance: Math.round(overallCompliance * 100) / 100,
        },
        counts: {
          healthy: healthyCount,
          warning: warningCount,
          critical: criticalCount,
          total: metrics.length,
        },
        details: metrics.map(m => ({
          name: m.sloName,
          status: m.status,
          compliance: m.compliance,
          currentValue: m.currentValue,
          target: m.target,
          trend: m.trend,
        })),
        xrayEnabled: this.xrayService.isXRayEnabled(),
      };
      
      if (segment) {
        segment.addAnnotation('overall_status', status.overall.status);
        segment.addAnnotation('healthy_count', healthyCount);
        segment.addAnnotation('warning_count', warningCount);
        segment.addAnnotation('critical_count', criticalCount);
      }
      
      return status;
    } finally {
      this.xrayService.closeTrace(segment, true);
    }
  }
}