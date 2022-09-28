import { get, post } from '@/helpers/apiHelper';

export const URL_TEMPLATE = '/template';

// 추천 template 목록 조회
const selectRecommendTemplateList = (data: unknown): Promise<any> => post(URL_TEMPLATE + '/recommend', data);

const TemplateService = {
  selectRecommendTemplateList,
};

export default TemplateService;
