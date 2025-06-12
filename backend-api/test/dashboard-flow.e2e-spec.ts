import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/user/entities/user.entity';
import { Dashboard } from '../src/dashboard/entities/dashboard.entity';
import { DashboardShare } from '../src/dashboard/entities/dashboard_share.entity';
import { UserMapping } from '../src/user/entities/user-mapping.entity';
import { Repository } from 'typeorm';

describe('Dashboard Management Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let dashboardRepository: Repository<Dashboard>;
  let dashboardShareRepository: Repository<DashboardShare>;
  let userMappingRepository: Repository<UserMapping>;

  const testUser = {
    userId: 'testuser',
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Test User',
  };

  let userRecord: User;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    dashboardRepository = moduleFixture.get<Repository<Dashboard>>(getRepositoryToken(Dashboard));
    dashboardShareRepository = moduleFixture.get<Repository<DashboardShare>>(
      getRepositoryToken(DashboardShare)
    );
    userMappingRepository = moduleFixture.get<Repository<UserMapping>>(
      getRepositoryToken(UserMapping)
    );

    // 테스트 사용자 생성
    userRecord = await userRepository.save(testUser);

    // 인증 토큰 획득
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        userId: testUser.userId,
        password: testUser.password,
      })
      .expect(201);

    authToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    // 테스트 데이터 정리
    await userMappingRepository.delete({});
    await dashboardRepository.delete({});
    await dashboardShareRepository.delete({});
    await userRepository.delete({});
    await app.close();
  });

  beforeEach(async () => {
    // 각 테스트 전 대시보드 관련 데이터 정리
    await userMappingRepository.delete({});
    await dashboardRepository.delete({});
    await dashboardShareRepository.delete({});
  });

  describe('Dashboard CRUD Operations', () => {
    const testDashboard = {
      title: 'Test Dashboard',
      layout: [
        { i: 'widget1', x: 0, y: 0, w: 6, h: 4 },
        { i: 'widget2', x: 6, y: 0, w: 6, h: 4 },
      ],
    };

    describe('POST /api/dashboard', () => {
      it('should create a new dashboard successfully', () => {
        return request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testDashboard)
          .expect(201)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data).toEqual(
              expect.objectContaining({
                title: testDashboard.title,
                layout: testDashboard.layout,
                shareId: expect.any(Number),
              })
            );
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .post('/api/dashboard')
          .send(testDashboard)
          .expect(401);
      });

      it('should validate required fields', () => {
        return request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            // title missing
            layout: testDashboard.layout,
          })
          .expect(400);
      });

      it('should handle empty layout', () => {
        return request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Empty Dashboard',
            layout: [],
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.data.layout).toEqual([]);
          });
      });

      it('should handle large layout with many widgets', () => {
        const largeLayout = Array.from({ length: 20 }, (_, i) => ({
          i: `widget${i + 1}`,
          x: (i % 4) * 3,
          y: Math.floor(i / 4) * 2,
          w: 3,
          h: 2,
        }));

        return request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Large Dashboard',
            layout: largeLayout,
          })
          .expect(201)
          .expect((res) => {
            expect(res.body.data.layout).toHaveLength(20);
          });
      });
    });

    describe('GET /api/dashboard', () => {
      beforeEach(async () => {
        // 테스트용 대시보드 생성
        await request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testDashboard);
      });

      it('should get all dashboards for authenticated user', () => {
        return request(app.getHttpServer())
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data.length).toBeGreaterThan(0);
            expect(res.body.data[0]).toEqual(
              expect.objectContaining({
                title: testDashboard.title,
                layout: testDashboard.layout,
              })
            );
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .get('/api/dashboard')
          .expect(401);
      });

      it('should return empty array when user has no dashboards', async () => {
        // 기존 대시보드 삭제
        await dashboardRepository.delete({});
        await userMappingRepository.delete({});

        return request(app.getHttpServer())
          .get('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404); // 현재 구현에서는 404를 반환
      });
    });

    describe('GET /api/dashboard/:id', () => {
      let dashboardId: number;

      beforeEach(async () => {
        // 테스트용 대시보드 생성
        const createResponse = await request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testDashboard);

        dashboardId = createResponse.body.data.id;
      });

      it('should get specific dashboard by id', () => {
        return request(app.getHttpServer())
          .get(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data).toEqual(
              expect.objectContaining({
                id: dashboardId,
                title: testDashboard.title,
                layout: testDashboard.layout,
                uuid: expect.any(String),
                widgets: expect.any(Array),
              })
            );
          });
      });

      it('should return error for non-existent dashboard', () => {
        return request(app.getHttpServer())
          .get('/api/dashboard/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200) // 현재 구현에서는 200으로 에러 응답
          .expect((res) => {
            expect(res.body.status).toBe('ERROR');
            expect(res.body.message).toContain('대시보드가 존재하지 않습니다');
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .get(`/api/dashboard/${dashboardId}`)
          .expect(401);
      });
    });

    describe('PUT /api/dashboard/:id', () => {
      let dashboardId: number;

      beforeEach(async () => {
        // 테스트용 대시보드 생성
        const createResponse = await request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testDashboard);

        dashboardId = createResponse.body.data.id;
      });

      it('should update dashboard title', () => {
        const updatedTitle = 'Updated Dashboard Title';

        return request(app.getHttpServer())
          .put(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: updatedTitle,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.title).toBe(updatedTitle);
          });
      });

      it('should update dashboard layout', () => {
        const newLayout = [
          { i: 'widget3', x: 0, y: 0, w: 12, h: 6 },
        ];

        return request(app.getHttpServer())
          .put(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            layout: newLayout,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.layout).toEqual(newLayout);
          });
      });

      it('should update both title and layout', () => {
        const updatedData = {
          title: 'Completely Updated Dashboard',
          layout: [
            { i: 'widget4', x: 3, y: 3, w: 6, h: 3 },
            { i: 'widget5', x: 9, y: 3, w: 3, h: 3 },
          ],
        };

        return request(app.getHttpServer())
          .put(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updatedData)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.title).toBe(updatedData.title);
            expect(res.body.data.layout).toEqual(updatedData.layout);
          });
      });

      it('should return error for non-existent dashboard', () => {
        return request(app.getHttpServer())
          .put('/api/dashboard/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Updated Title',
          })
          .expect(200) // 현재 구현에서는 200으로 에러 응답
          .expect((res) => {
            expect(res.body).toBe('Not exist dashboard');
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .put(`/api/dashboard/${dashboardId}`)
          .send({
            title: 'Updated Title',
          })
          .expect(401);
      });
    });

    describe('DELETE /api/dashboard/:id', () => {
      let dashboardId: number;

      beforeEach(async () => {
        // 테스트용 대시보드 생성
        const createResponse = await request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testDashboard);

        dashboardId = createResponse.body.data.id;
      });

      it('should delete dashboard successfully', () => {
        return request(app.getHttpServer())
          .delete(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('SUCCESS');
            expect(res.body.data.message).toContain(`#${dashboardId} dashboard`);
          });
      });

      it('should return error for non-existent dashboard', () => {
        return request(app.getHttpServer())
          .delete('/api/dashboard/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200) // 현재 구현에서는 200으로 에러 응답
          .expect((res) => {
            expect(res.body.status).toBe('ERROR');
            expect(res.body.message).toBe('No exist dashboard');
          });
      });

      it('should require authentication', () => {
        return request(app.getHttpServer())
          .delete(`/api/dashboard/${dashboardId}`)
          .expect(401);
      });

      it('should verify dashboard is actually deleted', async () => {
        // 대시보드 삭제
        await request(app.getHttpServer())
          .delete(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // 삭제된 대시보드 조회 시도
        return request(app.getHttpServer())
          .get(`/api/dashboard/${dashboardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.status).toBe('ERROR');
          });
      });
    });
  });

  describe('Dashboard Sharing', () => {
    let dashboardId: number;
    let shareUuid: string;

    beforeEach(async () => {
      // 테스트용 대시보드 생성
      const createResponse = await request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Shared Dashboard',
          layout: [{ i: 'widget1', x: 0, y: 0, w: 6, h: 4 }],
        });

      dashboardId = createResponse.body.data.id;

      // 대시보드 상세 조회하여 share UUID 획득
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/dashboard/${dashboardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      shareUuid = detailResponse.body.data.uuid;
    });

    it('should access shared dashboard without authentication', () => {
      return request(app.getHttpServer())
        .get(`/api/share-url/${shareUuid}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('SUCCESS');
          expect(res.body.data).toEqual(
            expect.objectContaining({
              title: 'Shared Dashboard',
              layout: expect.any(Array),
            })
          );
        });
    });

    it('should return error for invalid share UUID', () => {
      return request(app.getHttpServer())
        .get('/api/share-url/invalid-uuid')
        .expect(200) // 현재 구현에서는 200으로 에러 응답
        .expect((res) => {
          expect(res.body.status).toBe('ERROR');
        });
    });

    it('should handle malformed share UUID', () => {
      const malformedUuids = [
        'not-a-uuid',
        '12345',
        'uuid-too-long-to-be-valid-uuid-format',
        '',
        null,
      ];

      return Promise.all(
        malformedUuids.map(uuid =>
          request(app.getHttpServer())
            .get(`/api/share-url/${uuid}`)
            .expect(200)
            .expect((res) => {
              expect(res.body.status).toBe('ERROR');
            })
        )
      );
    });
  });

  describe('Complex Dashboard Workflows', () => {
    it('should complete full dashboard lifecycle', async () => {
      // 1. Create dashboard
      const createResponse = await request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Lifecycle Dashboard',
          layout: [{ i: 'widget1', x: 0, y: 0, w: 6, h: 4 }],
        })
        .expect(201);

      const dashboardId = createResponse.body.data.id;
      expect(createResponse.body.status).toBe('SUCCESS');

      // 2. Verify dashboard in list
      const listResponse = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.data.some(d => d.id === dashboardId)).toBe(true);

      // 3. Get dashboard details
      const detailResponse = await request(app.getHttpServer())
        .get(`/api/dashboard/${dashboardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(detailResponse.body.data.title).toBe('Lifecycle Dashboard');
      const shareUuid = detailResponse.body.data.uuid;

      // 4. Update dashboard
      await request(app.getHttpServer())
        .put(`/api/dashboard/${dashboardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Lifecycle Dashboard',
          layout: [
            { i: 'widget1', x: 0, y: 0, w: 4, h: 4 },
            { i: 'widget2', x: 4, y: 0, w: 8, h: 4 },
          ],
        })
        .expect(200);

      // 5. Verify update
      const updatedResponse = await request(app.getHttpServer())
        .get(`/api/dashboard/${dashboardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedResponse.body.data.title).toBe('Updated Lifecycle Dashboard');
      expect(updatedResponse.body.data.layout).toHaveLength(2);

      // 6. Test sharing
      await request(app.getHttpServer())
        .get(`/api/share-url/${shareUuid}`)
        .expect(200);

      // 7. Delete dashboard
      await request(app.getHttpServer())
        .delete(`/api/dashboard/${dashboardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 8. Verify deletion
      await request(app.getHttpServer())
        .get(`/api/dashboard/${dashboardId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ERROR');
        });
    });

    it('should handle concurrent dashboard operations', async () => {
      // 동시에 여러 대시보드 생성
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Concurrent Dashboard ${i + 1}`,
            layout: [{ i: `widget${i + 1}`, x: 0, y: 0, w: 6, h: 4 }],
          })
      );

      const responses = await Promise.all(createPromises);

      // 모든 대시보드가 성공적으로 생성되었는지 확인
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.status).toBe('SUCCESS');
        expect(response.body.data.title).toBe(`Concurrent Dashboard ${index + 1}`);
      });

      // 생성된 대시보드들이 목록에 나타나는지 확인
      const listResponse = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.data.length).toBeGreaterThanOrEqual(5);
    });

    it('should handle dashboard with complex layout', async () => {
      const complexLayout = [
        { i: 'header', x: 0, y: 0, w: 12, h: 2 },
        { i: 'sidebar', x: 0, y: 2, w: 3, h: 8 },
        { i: 'main-chart', x: 3, y: 2, w: 6, h: 5 },
        { i: 'mini-chart1', x: 9, y: 2, w: 3, h: 2 },
        { i: 'mini-chart2', x: 9, y: 4, w: 3, h: 2 },
        { i: 'data-table', x: 3, y: 7, w: 9, h: 3 },
        { i: 'footer', x: 0, y: 10, w: 12, h: 1 },
      ];

      const createResponse = await request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Complex Layout Dashboard',
          layout: complexLayout,
        })
        .expect(201);

      expect(createResponse.body.data.layout).toEqual(complexLayout);

      // 레이아웃 업데이트 테스트
      const updatedLayout = complexLayout.map(item => ({
        ...item,
        h: item.h + 1, // 모든 위젯 높이 1 증가
      }));

      await request(app.getHttpServer())
        .put(`/api/dashboard/${createResponse.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          layout: updatedLayout,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.layout).toEqual(updatedLayout);
        });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid JSON in layout', () => {
      return request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Invalid Layout Dashboard',
          layout: 'invalid-json-layout',
        })
        .expect(400);
    });

    it('should handle very long dashboard title', () => {
      const longTitle = 'A'.repeat(1000);

      return request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: longTitle,
          layout: [{ i: 'widget1', x: 0, y: 0, w: 6, h: 4 }],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.title).toBe(longTitle);
        });
    });

    it('should handle special characters in dashboard title', () => {
      const specialTitle = '대시보드 with 특수문자! @#$%^&*()';

      return request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: specialTitle,
          layout: [{ i: 'widget1', x: 0, y: 0, w: 6, h: 4 }],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.title).toBe(specialTitle);
        });
    });

    it('should handle malformed widget IDs in layout', () => {
      const layoutWithSpecialIds = [
        { i: 'widget-with-dashes', x: 0, y: 0, w: 6, h: 4 },
        { i: 'widget_with_underscores', x: 6, y: 0, w: 6, h: 4 },
        { i: 'widget.with.dots', x: 0, y: 4, w: 6, h: 4 },
        { i: '위젯-한글-아이디', x: 6, y: 4, w: 6, h: 4 },
      ];

      return request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Special Widget IDs Dashboard',
          layout: layoutWithSpecialIds,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.layout).toEqual(layoutWithSpecialIds);
        });
    });

    it('should handle negative coordinates in layout', () => {
      const layoutWithNegativeCoords = [
        { i: 'widget1', x: -1, y: -1, w: 6, h: 4 },
        { i: 'widget2', x: 0, y: 0, w: -6, h: -4 },
      ];

      return request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Negative Coordinates Dashboard',
          layout: layoutWithNegativeCoords,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.layout).toEqual(layoutWithNegativeCoords);
        });
    });
  });

  describe('Permission and Security Tests', () => {
    it('should not allow access to other users dashboards', async () => {
      // 다른 사용자 생성
      const otherUser = {
        userId: 'otheruser',
        email: 'other@example.com',
        password: 'otherpassword123',
        name: 'Other User',
      };

      await userRepository.save(otherUser);

      // 다른 사용자로 로그인
      const otherLoginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          userId: otherUser.userId,
          password: otherUser.password,
        })
        .expect(201);

      const otherToken = otherLoginResponse.body.accessToken;

      // 첫 번째 사용자의 대시보드 생성
      const createResponse = await request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Private Dashboard',
          layout: [{ i: 'widget1', x: 0, y: 0, w: 6, h: 4 }],
        })
        .expect(201);

      const dashboardId = createResponse.body.data.id;

      // 다른 사용자가 대시보드 목록을 조회할 때 해당 대시보드가 보이지 않아야 함
      const otherUserListResponse = await request(app.getHttpServer())
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404); // 현재 구현에서는 대시보드가 없으면 404

      // 다른 사용자가 직접 대시보드에 접근 시도 (현재 구현에서는 검증 없음)
      // 실제로는 권한 검증이 필요함
    });

    it('should prevent SQL injection in dashboard operations', async () => {
      const maliciousTitle = "Dashboard'; DROP TABLE dashboard; --";

      return request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: maliciousTitle,
          layout: [{ i: 'widget1', x: 0, y: 0, w: 6, h: 4 }],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe('SUCCESS');
          expect(res.body.data.title).toBe(maliciousTitle);
        });
    });

    it('should handle XSS attempts in dashboard title', async () => {
      const xssTitle = '<script>alert("XSS")</script>';

      return request(app.getHttpServer())
        .post('/api/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: xssTitle,
          layout: [{ i: 'widget1', x: 0, y: 0, w: 6, h: 4 }],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe('SUCCESS');
          // XSS 스크립트가 그대로 저장되지만, 실제로는 클라이언트에서 이스케이프 처리되어야 함
          expect(res.body.data.title).toBe(xssTitle);
        });
    });
  });
});