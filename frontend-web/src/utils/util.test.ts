import { checkId, checkPwd, checkEmail, dateData, createColumns } from './util';

describe('유틸리티 함수 테스트', () => {
  describe('checkId - ID 유효성 검사', () => {
    it('올바른 ID 형식을 통과해야 함', () => {
      expect(checkId.test('user123')).toBe(true);
      expect(checkId.test('TestUser')).toBe(true);
      expect(checkId.test('ABC123xyz')).toBe(true);
      expect(checkId.test('123')).toBe(true);
    });

    it('잘못된 ID 형식을 거부해야 함', () => {
      expect(checkId.test('user 123')).toBe(false); // 공백 포함
      expect(checkId.test('user@123')).toBe(false); // 특수문자 포함
      expect(checkId.test('user-123')).toBe(false); // 하이픈 포함
      expect(checkId.test('사용자123')).toBe(false); // 한글 포함
      expect(checkId.test('')).toBe(true); // 빈 문자열은 통과
    });
  });

  describe('checkPwd - 비밀번호 유효성 검사', () => {
    it('올바른 비밀번호 형식을 통과해야 함', () => {
      expect(checkPwd.test('Password1!')).toBe(true);
      expect(checkPwd.test('StrongP@ss1')).toBe(true);
      expect(checkPwd.test('Complex#123Pwd')).toBe(true);
    });

    it('잘못된 비밀번호 형식을 거부해야 함', () => {
      expect(checkPwd.test('password1!')).toBe(false); // 대문자 없음
      expect(checkPwd.test('PASSWORD1!')).toBe(false); // 소문자 없음
      expect(checkPwd.test('Password!')).toBe(false); // 숫자 없음
      expect(checkPwd.test('Password1')).toBe(false); // 특수문자 없음
      expect(checkPwd.test('Pass1!')).toBe(false); // 8자 미만
      expect(checkPwd.test('')).toBe(false); // 빈 문자열
    });
  });

  describe('checkEmail - 이메일 유효성 검사', () => {
    it('올바른 이메일 형식을 통과해야 함', () => {
      expect(checkEmail.test('user@example.com')).toBe(true);
      expect(checkEmail.test('test.user@domain.co.kr')).toBe(true);
      expect(checkEmail.test('admin123@company.org')).toBe(true);
      expect(checkEmail.test('user_name@sub.domain.com')).toBe(true);
    });

    it('잘못된 이메일 형식을 거부해야 함', () => {
      expect(checkEmail.test('user@')).toBe(false); // 도메인 없음
      expect(checkEmail.test('@example.com')).toBe(false); // 사용자명 없음
      expect(checkEmail.test('user.example.com')).toBe(false); // @ 없음
      expect(checkEmail.test('user@example')).toBe(false); // TLD 없음
      expect(checkEmail.test('user @example.com')).toBe(false); // 공백 포함
      expect(checkEmail.test('')).toBe(false); // 빈 문자열
    });
  });

  describe('dateData - 날짜 형식 변환', () => {
    it('올바른 날짜를 형식에 맞게 변환해야 함', () => {
      expect(dateData('2024-01-01')).toBe('2024.01.01');
      expect(dateData('2024-12-31')).toBe('2024.12.31');
      expect(dateData('2024-05-15')).toBe('2024.05.15');
      expect(dateData(new Date('2024-01-01'))).toBe('2024.01.01');
    });

    it('월과 일이 한 자리 수일 때 0을 붙여야 함', () => {
      expect(dateData('2024-01-05')).toBe('2024.01.05');
      expect(dateData('2024-09-09')).toBe('2024.09.09');
      expect(dateData('2024-10-10')).toBe('2024.10.10');
    });

    it('빈 문자열은 빈 문자열을 반환해야 함', () => {
      expect(dateData('')).toBe('');
    });

    it('다양한 날짜 형식을 처리해야 함', () => {
      expect(dateData('2024/01/01')).toBe('2024.01.01');
      expect(dateData('01-01-2024')).toBe('2024.01.01');
      expect(dateData('January 1, 2024')).toBe('2024.01.01');
    });
  });

  describe('createColumns - 데이터 그리드 컬럼 생성', () => {
    it('배열의 첫 번째 객체로부터 컬럼을 생성해야 함', () => {
      const data = [
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 },
      ];
      
      const columns = createColumns(data);
      
      expect(columns).toHaveLength(3);
      expect(columns[0]).toEqual({
        name: 'id',
        header: 'id',
        minWidth: 200,
        sortable: true,
      });
      expect(columns[1]).toEqual({
        name: 'name',
        header: 'name',
        minWidth: 200,
        sortable: true,
      });
      expect(columns[2]).toEqual({
        name: 'age',
        header: 'age',
        minWidth: 200,
        sortable: true,
      });
    });

    it('단일 객체로부터 컬럼을 생성해야 함', () => {
      const data = { id: 1, name: 'John', age: 30 };
      
      const columns = createColumns(data);
      
      expect(columns).toHaveLength(3);
      expect(columns.map(col => col.name)).toEqual(['id', 'name', 'age']);
    });

    it('빈 배열은 에러를 발생시켜야 함', () => {
      const data = [];
      
      expect(() => createColumns(data)).toThrow();
    });

    it('컬럼의 기본 속성이 올바르게 설정되어야 함', () => {
      const data = { test: 'value' };
      
      const columns = createColumns(data);
      
      expect(columns[0]).toMatchObject({
        name: 'test',
        header: 'test',
        minWidth: 200,
        sortable: true,
      });
    });

    it('중첩된 객체도 처리해야 함', () => {
      const data = {
        id: 1,
        user: { name: 'John' },
        status: 'active',
      };
      
      const columns = createColumns(data);
      
      expect(columns).toHaveLength(3);
      expect(columns.map(col => col.name)).toEqual(['id', 'user', 'status']);
    });
  });
});