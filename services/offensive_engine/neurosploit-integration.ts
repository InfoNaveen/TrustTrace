/**
 * WARNING: This module contains offensive security tooling for demo/research use only.
 * Never invoke against systems you do not own. Restricted to authorized environments only.
 * Unauthorized use of these tools against third-party systems is illegal.
 */

// SECURITY: Gate offensive engine behind environment flag
// Note: Skip during build/static generation (when vercel is the builder)
const isBuildTime = process.env.VERCEL_ENV === undefined && !process.env.GITHUB_ACTIONS;

if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_RED_TEAM && !isBuildTime) {
  throw new Error(
    'Red-team engine is disabled in production. ' +
    'Set ENABLE_RED_TEAM=true in environment variables to enable. ' +
    'This is a security-sensitive feature requiring explicit authorization.'
  );
}

import { Finding, Patch, ScanResult } from '@/lib/sentinel';
import { callLLM } from '@/lib/llm';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface ExploitResult {
  success: boolean;
  exploitType: string;
  target: string;
  payload: string;
  output: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RedTeamValidationResult {
  exploits: ExploitResult[];
  isSecure: boolean;
  report: string;
}

/**
 * Red Team Validation Gate - Offensive Security Testing
 * Simulates attacks using NeuroSploit-inspired techniques
 */
export class RedTeamValidationGate {
  private projectPath: string;
  
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Run comprehensive offensive validation against the project
   */
  async runValidation(): Promise<RedTeamValidationResult> {
    const exploits: ExploitResult[] = [];
    
    // Test for SQL Injection vulnerabilities
    const sqliResults = await this.testSQLInjection();
    exploits.push(...sqliResults);
    
    // Test for XSS vulnerabilities
    const xssResults = await this.testXSS();
    exploits.push(...xssResults);
    
    // Test for RCE (Remote Code Execution) vulnerabilities
    const rceResults = await this.testRCE();
    exploits.push(...rceResults);
    
    // Test for other common vulnerabilities
    const otherResults = await this.testOtherVulnerabilities();
    exploits.push(...otherResults);
    
    const successfulExploits = exploits.filter(exploit => exploit.success);
    const isSecure = successfulExploits.length === 0;
    
    const report = this.generateValidationReport(exploits, isSecure);
    
    return {
      exploits,
      isSecure,
      report
    };
  }

  /**
   * Test for SQL Injection vulnerabilities
   */
  async testSQLInjection(): Promise<ExploitResult[]> {
    const results: ExploitResult[] = [];
    
    // Look for potential SQL injection points in the code
    const files = await this.getFilesWithExtension(['js', 'ts', 'py', 'php', 'java']);
    
    for (const file of files) {
      const filePath = path.join(this.projectPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNumber = i + 1;
          
          // Look for SQL query patterns that might be vulnerable
          if (this.containsSQLPattern(line)) {
            const exploit: ExploitResult = {
              success: this.mightBeVulnerableToSQLI(line),
              exploitType: 'SQL Injection',
              target: `${file}:${lineNumber}`,
              payload: `' OR '1'='1' --`,
              output: `Potential SQL injection vulnerability detected in ${file}:${lineNumber}`,
              severity: 'high'
            };
            
            results.push(exploit);
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    return results;
  }

  /**
   * Test for XSS vulnerabilities
   */
  async testXSS(): Promise<ExploitResult[]> {
    const results: ExploitResult[] = [];
    
    // Look for potential XSS points in the code
    const files = await this.getFilesWithExtension(['js', 'ts', 'html', 'jsx', 'tsx']);
    
    for (const file of files) {
      const filePath = path.join(this.projectPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNumber = i + 1;
          
          // Look for potential XSS patterns
          if (this.containsXSSPattern(line)) {
            const exploit: ExploitResult = {
              success: this.mightBeVulnerableToXSS(line),
              exploitType: 'Cross-Site Scripting (XSS)',
              target: `${file}:${lineNumber}`,
              payload: `<script>alert('XSS')</script>`,
              output: `Potential XSS vulnerability detected in ${file}:${lineNumber}`,
              severity: 'high'
            };
            
            results.push(exploit);
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    return results;
  }

  /**
   * Test for RCE (Remote Code Execution) vulnerabilities
   */
  async testRCE(): Promise<ExploitResult[]> {
    const results: ExploitResult[] = [];
    
    // Look for potential RCE points in the code
    const files = await this.getFilesWithExtension(['js', 'ts', 'py', 'php', 'java']);
    
    for (const file of files) {
      const filePath = path.join(this.projectPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNumber = i + 1;
          
          // Look for potential RCE patterns
          if (this.containsRCEPattern(line)) {
            const exploit: ExploitResult = {
              success: this.mightBeVulnerableToRCE(line),
              exploitType: 'Remote Code Execution (RCE)',
              target: `${file}:${lineNumber}`,
              payload: `; cat /etc/passwd`,
              output: `Potential RCE vulnerability detected in ${file}:${lineNumber}`,
              severity: 'high'
            };
            
            results.push(exploit);
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    return results;
  }

  /**
   * Test for other common vulnerabilities
   */
  async testOtherVulnerabilities(): Promise<ExploitResult[]> {
    const results: ExploitResult[] = [];
    
    // Look for potential other vulnerabilities
    const files = await this.getFilesWithExtension(['js', 'ts', 'py', 'php', 'java', 'json', 'yaml', 'yml']);
    
    for (const file of files) {
      const filePath = path.join(this.projectPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNumber = i + 1;
          
          // Check for hardcoded secrets
          if (this.containsHardcodedSecret(line)) {
            const exploit: ExploitResult = {
              success: true, // Hardcoded secrets are always exploitable
              exploitType: 'Hardcoded Secret',
              target: `${file}:${lineNumber}`,
              payload: 'Extract hardcoded credentials',
              output: `Hardcoded secret detected in ${file}:${lineNumber}`,
              severity: 'high'
            };
            
            results.push(exploit);
          }
          
          // Check for insecure deserialization patterns
          if (this.containsInsecureDeserialization(line)) {
            const exploit: ExploitResult = {
              success: this.mightBeVulnerableToDeserialization(line),
              exploitType: 'Insecure Deserialization',
              target: `${file}:${lineNumber}`,
              payload: 'Malicious serialized object',
              output: `Potential insecure deserialization vulnerability detected in ${file}:${lineNumber}`,
              severity: 'high'
            };
            
            results.push(exploit);
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    return results;
  }

  /**
   * Check if line contains SQL pattern that might be vulnerable
   */
  private containsSQLPattern(line: string): boolean {
    const sqlPatterns = [
      /select.*\+.*from/i,
      /insert.*\+.*values/i,
      /update.*\+.*set/i,
      /delete.*\+.*from/i,
      /where.*\+.*=/i,
      /query.*\+.*\(/i,
      /execute.*\+.*\(/i,
      /sql.*\+.*=/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if line might be vulnerable to SQL injection
   */
  private mightBeVulnerableToSQLI(line: string): boolean {
    // Check if the line directly concatenates user input without proper sanitization
    return /query.*\+.*(req\.|request\.|params\.|query\.|body\.)/i.test(line) ||
           /sql.*\+.*(req\.|request\.|params\.|query\.|body\.)/i.test(line);
  }

  /**
   * Check if line contains XSS pattern that might be vulnerable
   */
  private containsXSSPattern(line: string): boolean {
    const xssPatterns = [
      /innerHTML.*=/i,
      /outerHTML.*=/i,
      /document\.write/i,
      /eval\(/i,
      /new Function/i,
      /setTimeout\(.*\+.*\)/i,
      /setInterval\(.*\+.*\)/i
    ];
    
    return xssPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if line might be vulnerable to XSS
   */
  private mightBeVulnerableToXSS(line: string): boolean {
    // Check if the line directly uses user input in DOM manipulation
    return /(innerHTML|outerHTML|document\.write).*\+.*(req\.|request\.|params\.|query\.|body\.|userInput)/i.test(line) ||
           /eval\(.*(req\.|request\.|params\.|query\.|body\.|userInput)/i.test(line);
  }

  /**
   * Check if line contains RCE pattern that might be vulnerable
   */
  private containsRCEPattern(line: string): boolean {
    const rcePatterns = [
      /exec\(/i,
      /spawn\(/i,
      /child_process/i,
      /shell_exec\(/i,
      /system\(/i,
      /popen\(/i,
      /os\.system/i,
      /os\.popen/i,
      /subprocess\./i,
      /Runtime\.getRuntime/i,
      /ProcessBuilder/i
    ];
    
    return rcePatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if line might be vulnerable to RCE
   */
  private mightBeVulnerableToRCE(line: string): boolean {
    // Check if the line directly uses user input in system commands
    return /(exec|spawn|shell_exec|system|popen|os\.system|os\.popen|subprocess).*\+.*(req\.|request\.|params\.|query\.|body\.|userInput)/i.test(line) ||
           /(Runtime\.getRuntime|ProcessBuilder).*\+.*(req\.|request\.|params\.|query\.|body\.|userInput)/i.test(line);
  }

  /**
   * Check if line contains hardcoded secret
   */
  private containsHardcodedSecret(line: string): boolean {
    const secretPatterns = [
      /password\s*[:=]\s*['"][^'"]+['"]/i,
      /secret\s*[:=]\s*['"][^'"]+['"]/i,
      /key\s*[:=]\s*['"][^'"]+['"]/i,
      /token\s*[:=]\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
      /auth[_-]?token\s*[:=]\s*['"][^'"]+['"]/i,
      /client[_-]?secret\s*[:=]\s*['"][^'"]+['"]/i
    ];
    
    return secretPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if line contains insecure deserialization pattern
   */
  private containsInsecureDeserialization(line: string): boolean {
    const deserializationPatterns = [
      /JSON\.parse\(.*req\./i,
      /pickle\.loads\(/i,
      /marshal\.loads\(/i,
      /eval\(.*JSON\.parse/i,
      /deserialize/i,
      /unserialize/i
    ];
    
    return deserializationPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if line might be vulnerable to deserialization
   */
  private mightBeVulnerableToDeserialization(line: string): boolean {
    return /JSON\.parse\(.*req\./i.test(line) || 
           /pickle\.loads\(.*req\./i.test(line) ||
           /marshal\.loads\(.*req\./i.test(line);
  }

  /**
   * Get files with specific extensions
   */
  private async getFilesWithExtension(extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    const walk = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.projectPath, fullPath);
          
          if (entry.isDirectory()) {
            // Skip node_modules and other common directories
            if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).substring(1);
            if (extensions.includes(ext)) {
              files.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Silently ignore errors for files that can't be accessed
      }
    };
    
    await walk(this.projectPath);
    return files;
  }

  /**
   * Generate validation report
   */
  private generateValidationReport(exploits: ExploitResult[], isSecure: boolean): string {
    const successfulExploits = exploits.filter(exploit => exploit.success);
    const failedExploits = exploits.filter(exploit => !exploit.success);
    
    let report = `=== RED TEAM VALIDATION REPORT ===\n\n`;
    report += `Security Status: ${isSecure ? 'SECURE' : 'VULNERABLE'}\n`;
    report += `Total Exploits Attempted: ${exploits.length}\n`;
    report += `Successful Exploits: ${successfulExploits.length}\n`;
    report += `Failed Exploits: ${failedExploits.length}\n\n`;
    
    if (successfulExploits.length > 0) {
      report += 'SUCCESSFUL EXPLOITS:\n';
      report += '=====================\n';
      
      for (const exploit of successfulExploits) {
        report += `Type: ${exploit.exploitType}\n`;
        report += `Target: ${exploit.target}\n`;
        report += `Payload: ${exploit.payload}\n`;
        report += `Output: ${exploit.output}\n`;
        report += `Severity: ${exploit.severity}\n\n`;
      }
    }
    
    if (failedExploits.length > 0) {
      report += 'FAILED EXPLOITS:\n';
      report += '================\n';
      
      for (const exploit of failedExploits) {
        report += `Type: ${exploit.exploitType}\n`;
        report += `Target: ${exploit.target}\n`;
        report += `Output: ${exploit.output}\n\n`;
      }
    }
    
    return report;
  }
}