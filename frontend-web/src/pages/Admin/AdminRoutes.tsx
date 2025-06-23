import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminDashboard from '../../components/admin/dashboard/AdminDashboard';
import UserManagement from '../../components/admin/users/UserManagement';
import UserApproval from '../../components/admin/approval/UserApproval';
import RoleManagement from '../../components/admin/roles/RoleManagement';
import { AuditLogManagement } from '../../components/admin/audit/AuditLogManagement';

const SystemSettings: React.FC = () => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h2>⚙️ 시스템 설정</h2>
    <p>시스템 설정 기능은 향후 구현 예정입니다.</p>
  </div>
);

const AdminRoutes: React.FC = () => {
  return (
    <Routes>
      <Route
        path="/*"
        element={
          <AdminLayout>
            <Routes>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="users/approval" element={<UserApproval />} />
              <Route path="roles" element={<RoleManagement />} />
              <Route path="audit" element={<AuditLogManagement />} />
              <Route path="settings" element={<SystemSettings />} />
              
              {/* 404 페이지 */}
              <Route 
                path="*" 
                element={
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h2>❌ 페이지를 찾을 수 없습니다</h2>
                    <p>요청하신 관리자 페이지가 존재하지 않습니다.</p>
                  </div>
                } 
              />
            </Routes>
          </AdminLayout>
        }
      />
    </Routes>
  );
};

export default AdminRoutes;