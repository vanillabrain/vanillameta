import { get, post } from '@/helpers/apiHelper';

export const URL_TEMPLATE = '/template';

// 추천 template 목록 조회
const selectRecommendTemplateList = (data: unknown): Promise<any> => post(URL_TEMPLATE + '/recommend', data);
// 템플릿 최종선택 후 대시보드 조회
const selectRecommendTemplateListDashboard = (data: unknown): Promise<any> => post(URL_TEMPLATE + '/dashboard', data);

const TemplateService = {
  selectRecommendTemplateList,
  selectRecommendTemplateListDashboard,
};

export default TemplateService;
