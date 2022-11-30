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
