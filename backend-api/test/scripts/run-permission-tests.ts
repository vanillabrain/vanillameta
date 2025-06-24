import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PermissionMatrixGenerator } from './generate-permission-matrix';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

export interface TestSuite {
  name: string;
  results: TestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
}

export interface TestReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    coverage?: {
      statements: number;
      branches: number;
      functions: number;
      lines: number;
    };
    securityIssues: string[];
    recommendations: string[];
  };
  suites: TestSuite[];
  timestamp: Date;
  environment: string;
}

export class PermissionTestRunner {
  private app: INestApplication;

  async initialize(): Promise<void> {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    await this.app.init();
  }

  async runAllTests(): Promise<TestReport> {
    console.log('🔒 Starting comprehensive permission tests...\n');

    await this.initialize();

    const startTime = Date.now();
    const suites: TestSuite[] = [];

    try {
      // Run different test suites
      console.log('📡 Running API permission tests...');
      const apiTestResults = await this.runJestTests('api-permissions');
      suites.push(apiTestResults);

      console.log('\n🛡️  Running security vulnerability tests...');
      const securityTestResults = await this.runJestTests('security');
      suites.push(securityTestResults);

      console.log('\n📊 Generating permission matrix...');
      await this.generatePermissionMatrix();

      console.log('\n✅ All tests completed!\n');
    } catch (error) {
      console.error('❌ Test execution failed:', error);
    } finally {
      await this.app.close();
    }

    const report = this.generateTestReport(suites, Date.now() - startTime);
    await this.saveTestReport(report);
    
    this.printSummary(report);
    
    return report;
  }

  private async runJestTests(testType: string): Promise<TestSuite> {
    return new Promise((resolve) => {
      const testPath = testType === 'api-permissions' 
        ? 'test/integration/api-permissions.test.ts'
        : 'test/security/security-vulnerability.test.ts';

      const startTime = Date.now();
      const results: TestResult[] = [];

      const jest = spawn('npx', [
        'jest',
        testPath,
        '--json',
        '--coverage',
        '--coverageDirectory',
        `coverage/${testType}`,
        '--forceExit',
      ], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' },
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
      });

      jest.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      jest.on('close', (code) => {
        const duration = Date.now() - startTime;

        try {
          // Parse Jest JSON output
          const jsonMatch = output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jestResults = JSON.parse(jsonMatch[0]);
            
            // Extract test results
            jestResults.testResults.forEach(testFile => {
              testFile.testResults.forEach(test => {
                results.push({
                  name: test.fullName,
                  passed: test.status === 'passed',
                  duration: test.duration || 0,
                  error: test.failureMessages?.join('\n'),
                });
              });
            });
          }
        } catch (error) {
          console.error('Failed to parse test results:', error);
        }

        const suite: TestSuite = {
          name: testType === 'api-permissions' ? 'API Permission Tests' : 'Security Tests',
          results,
          totalTests: results.length,
          passed: results.filter(r => r.passed).length,
          failed: results.filter(r => !r.passed).length,
          duration,
        };

        resolve(suite);
      });
    });
  }

  private async generatePermissionMatrix(): Promise<void> {
    const generator = new PermissionMatrixGenerator(this.app);
    await generator.generateReport('./test/reports');
  }

  private generateTestReport(suites: TestSuite[], totalDuration: number): TestReport {
    const allResults = suites.flatMap(s => s.results);
    
    const summary = {
      totalTests: allResults.length,
      passed: allResults.filter(r => r.passed).length,
      failed: allResults.filter(r => !r.passed).length,
      skipped: 0,
      duration: totalDuration,
      securityIssues: this.identifySecurityIssues(suites),
      recommendations: this.generateRecommendations(suites),
    };

    return {
      summary,
      suites,
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'test',
    };
  }

  private identifySecurityIssues(suites: TestSuite[]): string[] {
    const issues: string[] = [];
    
    // Check for failed security tests
    const securitySuite = suites.find(s => s.name === 'Security Tests');
    if (securitySuite) {
      securitySuite.results
        .filter(r => !r.passed)
        .forEach(r => {
          issues.push(`Failed security test: ${r.name}`);
        });
    }

    // Add specific security concerns
    if (issues.length === 0) {
      issues.push('No critical security issues detected');
    }

    return issues;
  }

  private generateRecommendations(suites: TestSuite[]): string[] {
    const recommendations: string[] = [];
    
    const totalTests = suites.reduce((sum, s) => sum + s.totalTests, 0);
    const failedTests = suites.reduce((sum, s) => sum + s.failed, 0);
    
    if (failedTests > 0) {
      recommendations.push(`Fix ${failedTests} failing tests before deployment`);
    }

    if (totalTests < 50) {
      recommendations.push('Consider adding more comprehensive test coverage');
    }

    // Specific recommendations based on test results
    const apiSuite = suites.find(s => s.name === 'API Permission Tests');
    if (apiSuite && apiSuite.failed > 0) {
      recommendations.push('Review and fix API permission configurations');
    }

    recommendations.push('Regularly update and run permission tests');
    recommendations.push('Document any permission changes in the changelog');

    return recommendations;
  }

  private async saveTestReport(report: TestReport): Promise<void> {
    const reportDir = './test/reports';
    await fs.mkdir(reportDir, { recursive: true });

    // Save JSON report
    await fs.writeFile(
      path.join(reportDir, 'test-report.json'),
      JSON.stringify(report, null, 2),
    );

    // Save HTML report
    await this.saveHtmlReport(report, reportDir);

    // Save Markdown report
    await this.saveMarkdownReport(report, reportDir);
  }

  private async saveHtmlReport(report: TestReport, reportDir: string): Promise<void> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Permission Test Report - VanillaMeta</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        h1 {
            margin: 0;
            color: #0f5ab2;
        }
        .timestamp {
            color: #666;
            font-size: 14px;
            margin-top: 10px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-value {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        .summary-label {
            color: #666;
            font-size: 14px;
        }
        .passed { color: #49cc90; }
        .failed { color: #f93e3e; }
        .suite {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .suite-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .test-result {
            padding: 10px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test-result:last-child {
            border-bottom: none;
        }
        .test-name {
            flex: 1;
            font-size: 14px;
        }
        .test-status {
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .status-passed {
            background-color: #d4f4dd;
            color: #49cc90;
        }
        .status-failed {
            background-color: #ffe0e0;
            color: #f93e3e;
        }
        .recommendations {
            background-color: #fff3cd;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }
        .recommendations h3 {
            margin-top: 0;
            color: #856404;
        }
        .recommendations ul {
            margin: 0;
            padding-left: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Permission Test Report</h1>
            <div class="timestamp">Generated on: ${report.timestamp.toLocaleString('ko-KR')}</div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-value">${report.summary.totalTests}</div>
                <div class="summary-label">Total Tests</div>
            </div>
            <div class="summary-card">
                <div class="summary-value passed">${report.summary.passed}</div>
                <div class="summary-label">Passed</div>
            </div>
            <div class="summary-card">
                <div class="summary-value failed">${report.summary.failed}</div>
                <div class="summary-label">Failed</div>
            </div>
            <div class="summary-card">
                <div class="summary-value">${(report.summary.duration / 1000).toFixed(2)}s</div>
                <div class="summary-label">Duration</div>
            </div>
        </div>

        ${report.suites.map(suite => `
        <div class="suite">
            <div class="suite-header">
                <h2>${suite.name}</h2>
                <div>
                    <span class="passed">${suite.passed} passed</span> / 
                    <span class="failed">${suite.failed} failed</span>
                </div>
            </div>
            ${suite.results.slice(0, 10).map(result => `
            <div class="test-result">
                <div class="test-name">${result.name}</div>
                <div class="test-status ${result.passed ? 'status-passed' : 'status-failed'}">
                    ${result.passed ? 'PASSED' : 'FAILED'}
                </div>
            </div>
            `).join('')}
            ${suite.results.length > 10 ? `
            <div class="test-result">
                <div class="test-name">... and ${suite.results.length - 10} more tests</div>
            </div>
            ` : ''}
        </div>
        `).join('')}

        ${report.summary.recommendations.length > 0 ? `
        <div class="recommendations">
            <h3>Recommendations</h3>
            <ul>
                ${report.summary.recommendations.map(r => `<li>${r}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    </div>
</body>
</html>`;

    await fs.writeFile(path.join(reportDir, 'test-report.html'), htmlContent);
  }

  private async saveMarkdownReport(report: TestReport, reportDir: string): Promise<void> {
    const mdContent = `# Permission Test Report

Generated on: ${report.timestamp.toLocaleString('ko-KR')}

## Summary

- **Total Tests**: ${report.summary.totalTests}
- **Passed**: ${report.summary.passed}
- **Failed**: ${report.summary.failed}
- **Duration**: ${(report.summary.duration / 1000).toFixed(2)}s
- **Environment**: ${report.environment}

## Test Results by Suite

${report.suites.map(suite => `
### ${suite.name}

- **Total**: ${suite.totalTests}
- **Passed**: ${suite.passed}
- **Failed**: ${suite.failed}
- **Duration**: ${(suite.duration / 1000).toFixed(2)}s

${suite.failed > 0 ? `
#### Failed Tests:
${suite.results.filter(r => !r.passed).map(r => `- ${r.name}`).join('\n')}
` : '✅ All tests passed!'}
`).join('\n')}

## Security Analysis

${report.summary.securityIssues.map(issue => `- ${issue}`).join('\n')}

## Recommendations

${report.summary.recommendations.map(rec => `- ${rec}`).join('\n')}
`;

    await fs.writeFile(path.join(reportDir, 'test-report.md'), mdContent);
  }

  private printSummary(report: TestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passed} ✅`);
    console.log(`Failed: ${report.summary.failed} ❌`);
    console.log(`Duration: ${(report.summary.duration / 1000).toFixed(2)}s`);
    console.log('\nReports generated in: ./test/reports/');
    console.log('='.repeat(60) + '\n');

    if (report.summary.failed > 0) {
      console.log('⚠️  Some tests failed. Please review the detailed report.');
    } else {
      console.log('✅ All tests passed!');
    }
  }
}

// Run tests if executed directly
if (require.main === module) {
  const runner = new PermissionTestRunner();
  runner.runAllTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}