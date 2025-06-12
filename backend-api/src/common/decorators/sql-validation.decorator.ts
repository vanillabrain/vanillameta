import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsSafeQueryConstraint implements ValidatorConstraintInterface {
  validate(query: string, args: ValidationArguments) {
    if (!query || typeof query !== 'string') {
      return false;
    }

    const trimmedQuery = query.trim().toUpperCase();
    
    // 기본 안전성 검사
    if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('WITH')) {
      return false;
    }

    // 금지된 키워드 검사 (기본적인 것들만)
    const forbiddenKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER', 'EXEC', 'EXECUTE'];
    for (const keyword of forbiddenKeywords) {
      const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (keywordRegex.test(query)) {
        return false;
      }
    }

    // 위험한 패턴 검사
    const dangerousPatterns = [
      /--[\s\S]*$/gm,           // SQL 주석
      /\/\*[\s\S]*?\*\//gm,     // SQL 블록 주석
      /\bunion\s+select\b/gi,   // Union injection
      /\binto\s+outfile\b/gi,   // File operations
      /[;'"\\]{2,}/g,           // 연속된 특수문자
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Query contains potentially dangerous SQL patterns or forbidden keywords';
  }
}

@ValidatorConstraint({ async: false })
export class IsValidTableNameConstraint implements ValidatorConstraintInterface {
  validate(tableName: string, args: ValidationArguments) {
    if (!tableName || typeof tableName !== 'string') {
      return false;
    }

    // 테이블명은 영문자, 숫자, 언더스코어만 허용
    const tableNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    if (!tableNameRegex.test(tableName)) {
      return false;
    }

    // 길이 제한 (최대 64자)
    if (tableName.length > 64) {
      return false;
    }

    // SQL 키워드와 겹치는 이름 금지
    const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'GROUP', 'HAVING', 'UNION', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS'];
    if (sqlKeywords.includes(tableName.toUpperCase())) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Table name must contain only letters, numbers, and underscores, and cannot be a SQL keyword';
  }
}

export function IsSafeQuery(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSafeQueryConstraint,
    });
  };
}

export function IsValidTableName(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidTableNameConstraint,
    });
  };
}