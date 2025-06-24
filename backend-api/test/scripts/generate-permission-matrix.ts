import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '../../src/modules/admin/entities/role.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PermissionMatrixEntry {
  endpoint: string;
  method: string;
  requiredPermissions: string[];
  roles: {
    [roleName: string]: {
      hasAccess: boolean;
      reason: string;
    };
  };
}

export interface RouteInfo {
  path: string;
  method: string;
  permissions: string[];
  controller: string;
  handler: string;
}

export class PermissionMatrixGenerator {
  private readonly app: INestApplication;
  private readonly reflector: Reflector;
  private roleRepository: Repository<Role>;

  constructor(app: INestApplication) {
    this.app = app;
    this.reflector = app.get(Reflector);
    this.roleRepository = app.get<Repository<Role>>(getRepositoryToken(Role));
  }

  async generateMatrix(): Promise<PermissionMatrixEntry[]> {
    const routes = await this.extractRoutes();
    const roles = await this.getAllRoles();
    const matrix: PermissionMatrixEntry[] = [];

    for (const route of routes) {
      const entry: PermissionMatrixEntry = {
        endpoint: route.path,
        method: route.method,
        requiredPermissions: route.permissions,
        roles: {},
      };

      for (const role of roles) {
        const rolePermissions = role.permissions || [];
        const hasAccess = this.checkPermissions(
          route.permissions,
          rolePermissions,
          role.name === 'super_admin', // Super admin has all permissions
        );

        entry.roles[role.name] = {
          hasAccess,
          reason: hasAccess
            ? 'Has required permissions'
            : `Missing: ${route.permissions.filter(p => !rolePermissions.includes(p)).join(', ')}`,
        };
      }

      matrix.push(entry);
    }

    return matrix;
  }

  private async extractRoutes(): Promise<RouteInfo[]> {
    const routes: RouteInfo[] = [];
    const httpAdapter = this.app.getHttpAdapter();
    const router = httpAdapter.getInstance()._router;

    // Express router extraction
    if (router && router.stack) {
      for (const layer of router.stack) {
        if (layer.route) {
          const route = layer.route;
          const methods = Object.keys(route.methods).filter(m => route.methods[m]);
          
          for (const method of methods) {
            const routeInfo = await this.extractRouteInfo(route, method.toUpperCase());
            if (routeInfo) {
              routes.push(routeInfo);
            }
          }
        }
      }
    }

    // NestJS specific route extraction
    const server = this.app.getHttpServer();
    const routerExplorer = (server as any)._events?.request?._router;
    
    if (routerExplorer) {
      // Additional route extraction logic if needed
    }

    return routes;
  }

  private async extractRouteInfo(route: any, method: string): Promise<RouteInfo | null> {
    try {
      const handler = route.stack[0]?.handle;
      if (!handler) return null;

      // Extract permissions from handler metadata
      const permissions = this.reflector.get<string[]>('permissions', handler) || [];
      
      // Extract controller and handler names
      const handlerName = handler.name || 'anonymous';
      const controllerName = handler.constructor?.name || 'UnknownController';

      return {
        path: route.path,
        method,
        permissions,
        controller: controllerName,
        handler: handlerName,
      };
    } catch (error) {
      console.error(`Error extracting route info for ${route.path}:`, error);
      return null;
    }
  }

  private async getAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      order: { level: 'DESC' },
    });
  }

  private checkPermissions(
    required: string[],
    available: string[],
    isSuperAdmin: boolean,
  ): boolean {
    // Super admin has all permissions
    if (isSuperAdmin) return true;

    // No permissions required
    if (!required || required.length === 0) return true;

    // Check if user has all required permissions
    return required.every(permission => {
      // Direct permission match
      if (available.includes(permission)) return true;

      // Wildcard permission check (e.g., admin.* matches admin.users.view)
      return available.some(availablePerm => {
        if (availablePerm.endsWith('*')) {
          const prefix = availablePerm.slice(0, -1);
          return permission.startsWith(prefix);
        }
        return false;
      });
    });
  }

  async generateReport(outputDir: string = './reports'): Promise<void> {
    const matrix = await this.generateMatrix();
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Generate different report formats
    await Promise.all([
      this.generateCsvReport(matrix, outputDir),
      this.generateHtmlReport(matrix, outputDir),
      this.generateJsonReport(matrix, outputDir),
      this.generateMarkdownReport(matrix, outputDir),
    ]);

    console.log(`\n✅ Permission matrix reports generated in ${outputDir}:`);
    console.log('   - permission-matrix.csv');
    console.log('   - permission-matrix.html');
    console.log('   - permission-matrix.json');
    console.log('   - permission-matrix.md');
  }

  private async generateCsvReport(matrix: PermissionMatrixEntry[], outputDir: string): Promise<void> {
    const roles = Object.keys(matrix[0]?.roles || {});
    const headers = ['Endpoint', 'Method', 'Required Permissions', ...roles];
    
    const rows = matrix.map(entry => {
      const cells = [
        entry.endpoint,
        entry.method,
        entry.requiredPermissions.join('; '),
        ...roles.map(role => entry.roles[role].hasAccess ? '✓' : '✗'),
      ];
      return cells.map(cell => `"${cell}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    await fs.writeFile(path.join(outputDir, 'permission-matrix.csv'), csvContent);
  }

  private async generateHtmlReport(matrix: PermissionMatrixEntry[], outputDir: string): Promise<void> {
    const roles = Object.keys(matrix[0]?.roles || {});
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Permission Matrix - VanillaMeta</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        h1 {
            margin: 0;
            padding: 20px;
            background-color: #0f5ab2;
            color: white;
        }
        .generated-date {
            padding: 10px 20px;
            background-color: #f0f0f0;
            font-size: 14px;
            color: #666;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
        .endpoint {
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        .method {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-align: center;
        }
        .method-GET { background-color: #61affe; color: white; }
        .method-POST { background-color: #49cc90; color: white; }
        .method-PUT { background-color: #fca130; color: white; }
        .method-DELETE { background-color: #f93e3e; color: white; }
        .permissions {
            font-size: 12px;
            color: #666;
        }
        .has-access {
            text-align: center;
            color: #49cc90;
            font-size: 20px;
        }
        .no-access {
            text-align: center;
            color: #f93e3e;
            font-size: 20px;
        }
        .role-header {
            text-align: center;
            min-width: 100px;
        }
        .filter-container {
            padding: 20px;
            background-color: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
        }
        .filter-input {
            width: 300px;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        .stats {
            padding: 20px;
            background-color: #f8f9fa;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        .stat-card {
            background-color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 24px;
            font-weight: 600;
            color: #0f5ab2;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>API Permission Matrix</h1>
        <div class="generated-date">Generated on: ${new Date().toLocaleString('ko-KR')}</div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${matrix.length}</div>
                <div class="stat-label">Total Endpoints</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${roles.length}</div>
                <div class="stat-label">Roles</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${[...new Set(matrix.flatMap(m => m.requiredPermissions))].length}</div>
                <div class="stat-label">Unique Permissions</div>
            </div>
        </div>

        <div class="filter-container">
            <input type="text" class="filter-input" id="filterInput" placeholder="Filter endpoints..." onkeyup="filterTable()">
        </div>
        
        <table id="permissionTable">
            <thead>
                <tr>
                    <th>Endpoint</th>
                    <th>Method</th>
                    <th>Required Permissions</th>
                    ${roles.map(role => `<th class="role-header">${role}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${matrix.map(entry => `
                <tr>
                    <td class="endpoint">${entry.endpoint}</td>
                    <td><span class="method method-${entry.method}">${entry.method}</span></td>
                    <td class="permissions">${entry.requiredPermissions.join(', ') || 'None'}</td>
                    ${roles.map(role => `
                        <td class="${entry.roles[role].hasAccess ? 'has-access' : 'no-access'}"
                            title="${entry.roles[role].reason}">
                            ${entry.roles[role].hasAccess ? '✓' : '✗'}
                        </td>
                    `).join('')}
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <script>
        function filterTable() {
            const input = document.getElementById('filterInput');
            const filter = input.value.toLowerCase();
            const table = document.getElementById('permissionTable');
            const rows = table.getElementsByTagName('tr');

            for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].getElementsByTagName('td');
                let found = false;
                
                for (let j = 0; j < 3; j++) {
                    if (cells[j]) {
                        const text = cells[j].textContent || cells[j].innerText;
                        if (text.toLowerCase().indexOf(filter) > -1) {
                            found = true;
                            break;
                        }
                    }
                }
                
                rows[i].style.display = found ? '' : 'none';
            }
        }
    </script>
</body>
</html>`;

    await fs.writeFile(path.join(outputDir, 'permission-matrix.html'), htmlContent);
  }

  private async generateJsonReport(matrix: PermissionMatrixEntry[], outputDir: string): Promise<void> {
    const report = {
      generated: new Date().toISOString(),
      summary: {
        totalEndpoints: matrix.length,
        totalRoles: Object.keys(matrix[0]?.roles || {}).length,
        uniquePermissions: [...new Set(matrix.flatMap(m => m.requiredPermissions))],
      },
      matrix,
    };

    await fs.writeFile(
      path.join(outputDir, 'permission-matrix.json'),
      JSON.stringify(report, null, 2),
    );
  }

  private async generateMarkdownReport(matrix: PermissionMatrixEntry[], outputDir: string): Promise<void> {
    const roles = Object.keys(matrix[0]?.roles || {});
    
    const mdContent = `# API Permission Matrix

Generated on: ${new Date().toLocaleString('ko-KR')}

## Summary

- **Total Endpoints**: ${matrix.length}
- **Total Roles**: ${roles.length}
- **Unique Permissions**: ${[...new Set(matrix.flatMap(m => m.requiredPermissions))].length}

## Permission Matrix

| Endpoint | Method | Required Permissions | ${roles.join(' | ')} |
|----------|--------|---------------------|${roles.map(() => '------').join('|')}|
${matrix.map(entry => 
  `| ${entry.endpoint} | ${entry.method} | ${entry.requiredPermissions.join(', ') || 'None'} | ${
    roles.map(role => entry.roles[role].hasAccess ? '✓' : '✗').join(' | ')
  } |`
).join('\n')}

## Legend

- ✓ : Has access
- ✗ : No access

## Role Descriptions

${await this.generateRoleDescriptions()}
`;

    await fs.writeFile(path.join(outputDir, 'permission-matrix.md'), mdContent);
  }

  private async generateRoleDescriptions(): Promise<string> {
    const roles = await this.getAllRoles();
    
    return roles.map(role => `
### ${role.displayName} (${role.name})
- **Level**: ${role.level}
- **Permissions**: ${role.permissions?.join(', ') || 'None'}
- **System Role**: ${role.isSystem ? 'Yes' : 'No'}
`).join('\n');
  }
}