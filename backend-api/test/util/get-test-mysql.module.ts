import { DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Database } from '../../src/database/entities/database.entity';
import { DatabaseType } from '../../src/database/entities/database_type.entity';
import { Dataset } from '../../src/dataset/entities/dataset.entity';
import { TableQuery } from '../../src/widget/table-query/entity/table-query.entity';
import { Template } from '../../src/template/entities/template.entity';
import { TemplateItem } from '../../src/template/entities/template-item.entity';
import { Widget } from '../../src/widget/entities/widget.entity';
import { Component } from '../../src/component/entities/component.entity';
import { Dashboard } from '../../src/dashboard/entities/dashboard.entity';
import { DashboardShare } from '../../src/dashboard/entities/dashboard_share.entity';
import { DashboardWidget } from '../../src/dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { User } from '../../src/user/entities/user.entity';
import { UserMapping } from '../../src/user/entities/user-mapping.entity';
import { RefreshToken } from '../../src/auth/entities/refresh_token.entity';

/**
 * 테스트 데이터베이스 모듈 가져오기 (SQLite 사용)
 * 모든 테스트에서 사용할 수 있도록 모든 엔티티 포함
 *
 * @returns {DynamicModule}
 */
export function getTestMysqlModule(): DynamicModule {
  return TypeOrmModule.forRoot({
    type: 'sqlite',
    database: ':memory:',
    entities: [
      Database,
      DatabaseType,
      Dataset,
      TableQuery,
      Template,
      TemplateItem,
      Widget,
      Component,
      Dashboard,
      DashboardShare,
      DashboardWidget,
      User,
      UserMapping,
      RefreshToken,
    ],
    synchronize: true,
    logging: false,
    retryAttempts: 1,
  });
}
