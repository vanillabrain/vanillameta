import { get, post } from '@/helpers/apiHelper';
import { 
  ApiResponse, 
  TemplateRecommendRequest,
  TemplateRecommendResponse,
  TemplateDashboardResponse
} from '@/types';

export const URL_TEMPLATE = '/template';

// 추천 template 목록 조회
const selectRecommendTemplateList = (data: TemplateRecommendRequest): Promise<ApiResponse<TemplateRecommendResponse>> => 
  post(URL_TEMPLATE + '/recommend', data);

// 템플릿 최종선택 후 대시보드 조회
const selectRecommendTemplateListDashboard = (data: { templateId: number }): Promise<ApiResponse<TemplateDashboardResponse>> => 
  post(URL_TEMPLATE + '/dashboard', data);

const TemplateService = {
  selectRecommendTemplateList,
  selectRecommendTemplateListDashboard,
};

export default TemplateService;
