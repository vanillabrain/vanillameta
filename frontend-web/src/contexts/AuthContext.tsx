import { createContext, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import authService from '@/api/authService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const initUserState = {
    userId: null,
    userEmail: null,
  };
  const [userState, setUserState] = useState(initUserState);

  /**
   * 현재 사용자 정보를 조회해 상태에 반영한다.
   * (react-query 캐시를 사용하되, 호출 시점에 항상 최신을 가져온다)
   */
  const getUserState = async (): Promise<any> => {
    const data = await queryClient.fetchQuery({
      queryKey: ['user-info'],
      queryFn: async () => (await authService.getUserInfo()).data.data,
      staleTime: 0,
    });
    setUserState({ userId: data.userId, userEmail: data.email });
    return data;
  };

  const value = {
    userState,
    getUserState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
