import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ConnectionPoolMonitorService } from './connection-pool-monitor.service';

@ApiTags('모니터링')
@Controller('monitoring')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MonitoringController {
  constructor(private readonly connectionPoolMonitor: ConnectionPoolMonitorService) {}

  @Get('connection-pool/metrics')
  @ApiOperation({ summary: '연결 풀 메트릭 조회' })
  @ApiResponse({
    status: 200,
    description: '연결 풀 메트릭',
    schema: {
      example: {
        current: {
          totalConnections: 5,
          activeConnections: 2,
          idleConnections: 3,
          waitingRequests: 0,
          connectionUtilization: 40,
          timestamp: '2024-01-01T00:00:00.000Z',
        },
        statistics: {
          avgUtilization: 35.5,
          maxUtilization: 60,
          avgActiveConnections: 1.8,
          connectionReusability: 85.5,
        },
      },
    },
  })
  async getConnectionPoolMetrics() {
    return this.connectionPoolMonitor.getMetrics();
  }

  @Get('connection-pool/health')
  @ApiOperation({ summary: '연결 풀 헬스 체크' })
  @ApiResponse({
    status: 200,
    description: '연결 풀 상태',
    schema: {
      example: {
        isHealthy: true,
        issues: [],
      },
    },
  })
  async checkConnectionPoolHealth() {
    return this.connectionPoolMonitor.checkPoolHealth();
  }
}
