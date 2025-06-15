import { SetMetadata } from '@nestjs/common';
import { FieldSelectionOptions } from './field-selection.service';

export const FIELD_SELECTION_KEY = 'fieldSelection';

/**
 * 필드 선택 기능을 활성화하는 데코레이터
 * 
 * @example
 * ```typescript
 * @FieldSelection({
 *   allowedFields: ['id', 'name', 'email', 'profile.avatar'],
 *   excludeFields: ['password', 'token']
 * })
 * @Get('users')
 * async getUsers(@Query('fields') fields?: string) {
 *   // GET /users?fields=id,name,email
 *   // 응답에서 id, name, email만 포함
 * }
 * ```
 */
export function FieldSelection(options: FieldSelectionOptions = {}) {
  // 기본 제외 필드 설정
  const defaultExcludeFields = [
    'password',
    'passwordHash', 
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'privateKey',
    'connectionString',
    'credentials'
  ];

  const mergedOptions: FieldSelectionOptions = {
    maxDepth: 5,
    excludeFields: [
      ...(options.excludeFields || []),
      ...defaultExcludeFields
    ],
    ...options
  };

  return SetMetadata(FIELD_SELECTION_KEY, mergedOptions);
}

/**
 * 사전 정의된 필드 세트를 사용하는 데코레이터
 * 
 * @example
 * ```typescript
 * @PredefinedFields('userBasic') // id, email, name, createdAt
 * @Get('users')
 * async getUsers() {
 *   // 자동으로 기본 사용자 필드만 반환
 * }
 * ```
 */
export function PredefinedFields(fieldSetName: string, additionalOptions: Omit<FieldSelectionOptions, 'allowedFields'> = {}) {
  const predefinedSets: Record<string, string[]> = {
    userBasic: ['id', 'userId', 'email', 'createdAt', 'updatedAt'],
    userWithProfile: ['id', 'userId', 'email', 'profile.avatar', 'profile.bio'],
    dashboardMeta: ['id', 'title', 'description', 'createdAt', 'updatedAt'],
    dashboardWithWidgets: ['id', 'title', 'widgets.id', 'widgets.name', 'widgets.type'],
    widgetBasic: ['id', 'title', 'componentId', 'createdAt', 'updatedAt'],
    widgetWithConfig: ['id', 'title', 'componentId', 'datasetType', 'datasetId', 'option'],
    datasetSchema: ['id', 'title', 'databaseId', 'columns.name', 'columns.type'],
    datasetMeta: ['id', 'title', 'databaseId', 'createdAt', 'updatedAt'],
    connectionBasic: ['id', 'name', 'description', 'engine', 'type', 'timezone', 'createdAt', 'updatedAt']
  };

  const allowedFields = predefinedSets[fieldSetName];
  if (!allowedFields) {
    throw new Error(`Predefined field set '${fieldSetName}' not found`);
  }

  return FieldSelection({
    allowedFields,
    ...additionalOptions
  });
}

/**
 * 필드 선택을 비활성화하는 데코레이터 (명시적으로 비활성화)
 */
export function NoFieldSelection() {
  return SetMetadata(FIELD_SELECTION_KEY, { disabled: true });
}