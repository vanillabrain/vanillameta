/*
ID:
공백 없는 영문, 숫자
 */
export const checkId = /^[a-zA-Z0-9]*$/;
/*
 비밀번호:
 숫자, 영문 대소문자, 특수문자 한 글자 이상 포함, 8글자 이상
 */
export const checkPwd = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,}$/;

/*
이메일
 */
export const checkEmail = /^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/;

/*
날짜 형식 변환
 */
export const dateData = data => {
  let result = '';
  if (data != '') {
    const userDate = new Date(data);
    const year = userDate.getFullYear();
    const month = userDate.getMonth() + 1;
    const date = userDate.getDate();
    result = `${year}.${month >= 10 ? month : '0' + month}.${date >= 10 ? date : '0' + date}`;
  }
  return result;
};

/**
 * 데이터 그리드 컬럼 생성
 * @param data
 */
export const createColumns = data => {
  let target = null;
  if (data instanceof Array && data.length > 0) {
    target = data[0];
  } else if (data instanceof Object) {
    target = data;
  }
  return Object.keys(target).map(key => {
    return { name: key, header: key, minWidth: 200, sortable: true };
  });
};
