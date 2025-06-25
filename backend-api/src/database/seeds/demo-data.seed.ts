import { DataSource } from 'typeorm';
import { User, UserStatus } from '../../user/entities/user.entity';
import { Database } from '../entities/database.entity';
import { DatabaseType } from '../entities/database_type.entity';
import { Dataset } from '../../dataset/entities/dataset.entity';
import { Component } from '../../component/entities/component.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { DashboardWidget } from '../../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Template } from '../../template/entities/template.entity';
import { TemplateItem } from '../../template/entities/template-item.entity';

/**
 * Demo data seed for VanillaMeta Docker demo
 * Creates sample data for quick demonstration
 */
export async function seedDemoData(dataSource: DataSource) {
  console.log('🌱 Seeding demo data...');

  try {
    // 1. Create demo user (if not exists)
    const userRepo = dataSource.getRepository(User);
    let demoUser = await userRepo.findOne({ where: { email: 'guest' } });

    if (!demoUser) {
      demoUser = await userRepo.save({
        userId: 'guest',
        email: 'guest',
        password:
          '0258acb251701900c2abcde987033e032838df1eb39f10bfb9e9f6398866b13acb104f00485b92b11db90544744280626980c3888b9ba98ea8f319f9747d051e', // Admin!@12 (SHA512)
        status: UserStatus.ACTIVE,
      });
      console.log('✅ Demo user created');
    }

    // 2. Create SQLite database type
    const dbTypeRepo = dataSource.getRepository(DatabaseType);
    let sqliteType = await dbTypeRepo.findOne({ where: { engine: 'sqlite' } });

    if (!sqliteType) {
      sqliteType = await dbTypeRepo.save({
        type: 'sqlite',
        engine: 'sqlite',
        title: 'SQLite',
        seq: 1,
        useYn: 'Y',
      });
      console.log('✅ SQLite database type created');
    }

    // 3. Create demo database connection
    const dbRepo = dataSource.getRepository(Database);
    let demoDB = await dbRepo.findOne({ where: { name: 'Demo SQLite' } });

    if (!demoDB) {
      demoDB = await dbRepo.save({
        name: 'Demo SQLite',
        description: 'Demo SQLite database',
        connectionConfig: JSON.stringify({
          client: 'sqlite',
          connection: {
            filename: './demo.db',
          },
          useNullAsDefault: true,
        }),
        engine: 'sqlite',
        type: 'sqlite',
        timezone: 'Asia/Seoul',
      });
      console.log('✅ Demo database created');
    }

    // 4. Create sample datasets
    const datasetRepo = dataSource.getRepository(Dataset);
    const datasets = [
      {
        title: '월별 판매 현황',
        query: `SELECT 
          strftime('%Y-%m', order_date) as month,
          COUNT(*) as order_count,
          SUM(amount) as total_sales
        FROM sales_orders
        WHERE order_date >= date('now', '-12 months')
        GROUP BY month
        ORDER BY month`,
        databaseId: demoDB.id,
      },
      {
        title: '카테고리별 매출',
        query: `SELECT 
          category,
          COUNT(*) as product_count,
          SUM(quantity) as total_quantity,
          SUM(amount) as total_amount
        FROM sales_orders
        GROUP BY category
        ORDER BY total_amount DESC`,
        databaseId: demoDB.id,
      },
      {
        title: '일별 주문 추이',
        query: `SELECT 
          date(order_date) as order_day,
          COUNT(*) as order_count,
          AVG(amount) as avg_order_value
        FROM sales_orders
        WHERE order_date >= date('now', '-30 days')
        GROUP BY order_day
        ORDER BY order_day`,
        databaseId: demoDB.id,
      },
    ];

    for (const datasetData of datasets) {
      const existing = await datasetRepo.findOne({
        where: { title: datasetData.title },
      });

      if (!existing) {
        await datasetRepo.save(datasetData);
      }
    }
    console.log('✅ Sample datasets created');

    // 5. Create demo dashboard
    const dashboardRepo = dataSource.getRepository(Dashboard);
    let demoDashboard = await dashboardRepo.findOne({
      where: { title: '판매 분석 대시보드' },
    });

    if (!demoDashboard) {
      demoDashboard = await dashboardRepo.save({
        title: '판매 분석 대시보드',
        delYn: 'N',
      });
      console.log('✅ Demo dashboard created');
    }

    // 6. Create demo template
    const templateRepo = dataSource.getRepository(Template);
    let demoTemplate = await templateRepo.findOne({
      where: { title: '이커머스 분석 템플릿' },
    });

    if (!demoTemplate) {
      demoTemplate = await templateRepo.save({
        title: '이커머스 분석 템플릿',
        description: '이커머스 비즈니스를 위한 분석 대시보드 템플릿',
        useYn: 'Y',
      });
      console.log('✅ Demo template created');
    }

    console.log('🎉 Demo data seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  }
}

/**
 * Create demo sales data in SQLite
 */
export async function createDemoSalesTable(dataSource: DataSource) {
  try {
    // Create demo sales table
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_date DATE NOT NULL,
        category VARCHAR(50) NOT NULL,
        product_name VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        customer_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if data already exists
    const count = await dataSource.query('SELECT COUNT(*) as count FROM sales_orders');
    if (count[0].count > 0) {
      console.log('✅ Demo sales data already exists');
      return;
    }

    // Insert sample data
    const categories = ['전자제품', '의류', '식품', '가구', '도서'];
    const products = {
      전자제품: ['노트북', '스마트폰', '태블릿', '헤드폰', '스마트워치'],
      의류: ['티셔츠', '청바지', '재킷', '운동화', '가방'],
      식품: ['과자', '음료', '과일', '빵', '커피'],
      가구: ['의자', '책상', '침대', '소파', '수납장'],
      도서: ['소설', '자기계발서', '만화', '잡지', '교재'],
    };

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    // Generate 1000 sample orders
    for (let i = 0; i < 1000; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const product = products[category][Math.floor(Math.random() * products[category].length)];
      const quantity = Math.floor(Math.random() * 10) + 1;
      const basePrice = Math.floor(Math.random() * 100000) + 10000;
      const amount = quantity * basePrice;

      const orderDate = new Date(startDate);
      orderDate.setDate(orderDate.getDate() + Math.floor(Math.random() * 365));

      await dataSource.query(
        `
        INSERT INTO sales_orders (order_date, category, product_name, quantity, amount, customer_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          orderDate.toISOString().split('T')[0],
          category,
          product,
          quantity,
          amount,
          `CUST${Math.floor(Math.random() * 1000)
            .toString()
            .padStart(4, '0')}`,
        ],
      );
    }

    console.log('✅ Demo sales data created (1000 records)');
  } catch (error) {
    console.error('❌ Error creating demo sales table:', error);
    throw error;
  }
}
