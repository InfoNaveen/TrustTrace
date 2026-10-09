/**
 * WARNING: This module contains offensive security tooling for demo/research use only.
 * Never invoke against systems you do not own. Restricted to authorized environments only.
 * Unauthorized use of these tools against third-party systems is illegal.
 */

// SECURITY: Gate offensive engine behind environment flag
// Note: Skip during build/static generation
const isBuildTime = process.env.VERCEL_ENV === undefined && !process.env.GITHUB_ACTIONS;

if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_RED_TEAM && !isBuildTime) {
  throw new Error(
    'OSINT collector is disabled in production. ' +
    'Set ENABLE_RED_TEAM=true in environment variables to enable. ' +
    'This is a security-sensitive feature requiring explicit authorization.'
  );
}

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execPromise = promisify(exec);

export interface OSINTResult {
  type: string;
  target: string;
  data: any;
  confidence: number;
  timestamp: Date;
}

export interface OSINTCollectorConfig {
  enableNuclei: boolean;
  enableNmap: boolean;
  enableGf: boolean;
  nucleiTemplates?: string[];
  nmapScripts?: string[];
  timeout?: number;
}

/**
 * OSINT Collector - Wrapper for external security tools
 * Mimics NeuroSploit's osint_collector functionality
 */
export class OSINTCollector {
  private config: OSINTCollectorConfig;
  private projectPath: string;

  constructor(config: OSINTCollectorConfig, projectPath: string = process.cwd()) {
    this.config = {
      enableNuclei: config.enableNuclei ?? false,
      enableNmap: config.enableNmap ?? false,
      enableGf: config.enableGf ?? false,
      nucleiTemplates: config.nucleiTemplates || [],
      nmapScripts: config.nmapScripts || [],
      timeout: config.timeout || 30000, // 30 seconds default
    };
    this.projectPath = projectPath;
  }

  /**
   * Run OSINT collection on a target
   */
  async collect(target: string): Promise<OSINTResult[]> {
    const results: OSINTResult[] = [];

    try {
      // Run Nuclei scans if enabled
      if (this.config.enableNuclei) {
        const nucleiResults = await this.runNucleiScan(target);
        results.push(...nucleiResults);
      }

      // Run Nmap scans if enabled
      if (this.config.enableNmap) {
        const nmapResults = await this.runNmapScan(target);
        results.push(...nmapResults);
      }

      // Run gf patterns if enabled
      if (this.config.enableGf) {
        const gfResults = await this.runGfPatterns(target);
        results.push(...gfResults);
      }
    } catch (error) {
      console.error('OSINT collection error:', error);
      // Return empty results if collection fails
    }

    return results;
  }

  /**
   * Run Nuclei scan on target
   */
  private async runNucleiScan(target: string): Promise<OSINTResult[]> {
    const results: OSINTResult[] = [];

    try {
      // Check if nuclei is installed
      await execPromise('nuclei -version', { timeout: 5000 });

      // Prepare nuclei command
      let command = `nuclei -target ${target} -json`;

      // Add specific templates if provided
      if (this.config.nucleiTemplates && this.config.nucleiTemplates.length > 0) {
        command += ` -t ${this.config.nucleiTemplates.join(',')}`;
      } else {
        // Use common templates for web vulnerabilities
        command += ' -t cves, exposures, panels, technologies';
      }

      command += ` -timeout ${Math.floor((this.config.timeout || 30000) / 1000)}`;

      const { stdout, stderr } = await execPromise(command, {
        timeout: this.config.timeout,
        cwd: this.projectPath
      });

      if (stderr) {
        console.warn('Nuclei scan stderr:', stderr);
      }

      if (stdout) {
        const nucleiOutput = stdout.trim().split('\n');
        for (const line of nucleiOutput) {
          if (line.trim()) {
            try {
              const result = JSON.parse(line);
              results.push({
                type: 'nuclei-vulnerability',
                target,
                data: result,
                confidence: 0.8, // High confidence for tool-detected vulns
                timestamp: new Date()
              });
            } catch (parseError) {
              console.warn('Could not parse nuclei result:', line);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn('Nuclei not found. Skipping Nuclei scan.');
      } else {
        console.warn('Nuclei scan failed:', error.message);
      }
    }

    return results;
  }

  /**
   * Run Nmap scan on target
   */
  private async runNmapScan(target: string): Promise<OSINTResult[]> {
    const results: OSINTResult[] = [];

    try {
      // Check if nmap is installed
      await execPromise('nmap --version', { timeout: 5000 });

      // Prepare nmap command with common scripts
      // Security: Validate scripts are alphanumeric/basic dashes only to prevent injection
      const safeScripts = (this.config.nmapScripts || [])
        .filter(s => /^[a-zA-Z0-9\-_,]+$/.test(s));

      let command = `nmap -sV`;
      if (safeScripts.length > 0) {
        command += ` --script ${safeScripts.join(',')}`;
      } else {
        // Default scripts if none provided or all were invalid
        command += ` --script vuln,http-enum,http-headers,http-title,http-trace,nmap-vulns,cve`;
      }
      command += ` -p- "${target}"`;

      const { stdout, stderr } = await execPromise(command, {
        timeout: this.config.timeout,
        cwd: this.projectPath
      });

      if (stderr) {
        console.warn('Nmap scan stderr:', stderr);
      }

      if (stdout) {
        results.push({
          type: 'nmap-scan',
          target,
          data: {
            output: stdout,
            summary: this.parseNmapOutput(stdout)
          },
          confidence: 0.7, // Medium-high confidence
          timestamp: new Date()
        });
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn('Nmap not found. Skipping Nmap scan.');
      } else {
        console.warn('Nmap scan failed:', error.message);
      }
    }

    return results;
  }

  /**
   * Run gf (grep-friendly) patterns on target
   */
  private async runGfPatterns(target: string): Promise<OSINTResult[]> {
    const results: OSINTResult[] = [];

    try {
      // Check if gf is installed (part of gf-patterns)
      await execPromise('gf -h', { timeout: 5000 });

      // Common gf patterns for vulnerability detection
      const patterns = ['sqli', 'xss', 'lfi', 'rfi', 'redirect', 'rce', 'idor', 'ssti'];

      for (const pattern of patterns) {
        try {
          const command = `echo "${target}" | gf ${pattern}`;
          const { stdout, stderr } = await execPromise(command, {
            timeout: this.config.timeout,
            cwd: this.projectPath
          });

          if (stderr) {
            console.warn(`Gf pattern ${pattern} stderr:`, stderr);
          }

          if (stdout && stdout.trim()) {
            results.push({
              type: `gf-${pattern}`,
              target,
              data: {
                pattern,
                matches: stdout.trim()
              },
              confidence: 0.6, // Medium confidence
              timestamp: new Date()
            });
          }
        } catch (patternError: any) {
          if (patternError.code !== 'ENOENT') {
            console.warn(`Gf pattern ${pattern} failed:`, patternError.message);
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn('gf not found. Skipping gf patterns.');
      } else {
        console.warn('Gf patterns failed:', error.message);
      }
    }

    return results;
  }

  /**
   * Parse Nmap output to extract key information
   */
  private parseNmapOutput(output: string): any {
    const parsed: any = {
      hosts: [],
      ports: [],
      services: [],
      vulnerabilities: []
    };

    const lines = output.split('\n');

    for (const line of lines) {
      if (line.includes('Nmap scan report for')) {
        const hostMatch = line.match(/Nmap scan report for (.+)/);
        if (hostMatch) {
          parsed.hosts.push(hostMatch[1]);
        }
      } else if (line.trim().match(/^\d+\/\w+\s+\w+\s+.+/)) {
        // Parse port/service line: "80/tcp open  http"
        const portMatch = line.trim().match(/^(\d+)\/(\w+)\s+(\w+)\s+(.+)/);
        if (portMatch) {
          parsed.ports.push({
            port: parseInt(portMatch[1]),
            protocol: portMatch[2],
            state: portMatch[3],
            service: portMatch[4]
          });
        }
      } else if (line.includes('VULNERABLE')) {
        parsed.vulnerabilities.push(line.trim());
      }
    }

    return parsed;
  }

  /**
   * Run OSINT collection on source code
   */
  async collectFromSourceCode(sourcePath: string): Promise<OSINTResult[]> {
    const results: OSINTResult[] = [];

    // Analyze source code for potential vulnerabilities
    const files = await this.getSourceFiles(sourcePath);

    for (const file of files) {
      const filePath = path.join(sourcePath, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');

        // Look for potential security issues in the code
        const findings = this.analyzeSourceCode(content, file);
        for (const finding of findings) {
          results.push({
            type: 'source-code-vulnerability',
            target: file,
            data: finding,
            confidence: finding.confidence,
            timestamp: new Date()
          });
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return results;
  }

  /**
   * Analyze source code for potential vulnerabilities
   */
  private analyzeSourceCode(content: string, fileName: string): Array<{
    type: string;
    line: number;
    snippet: string;
    description: string;
    confidence: number;
  }> {
    const findings = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for eval usage
      if (line.includes('eval(')) {
        findings.push({
          type: 'unsafe-eval',
          line: lineNumber,
          snippet: line.trim(),
          description: 'Use of eval() function can lead to code injection',
          confidence: 0.9
        });
      }

      // Check for exec usage
      if (line.includes('exec(') || line.includes('spawn(') || line.includes('child_process')) {
        findings.push({
          type: 'command-injection',
          line: lineNumber,
          snippet: line.trim(),
          description: 'Potential command injection via system execution functions',
          confidence: 0.8
        });
      }

      // Check for hardcoded secrets
      const secretPatterns = [
        /password\s*[:=]\s*['"][^'"]+['"]/i,
        /secret\s*[:=]\s*['"][^'"]+['"]/i,
        /key\s*[:=]\s*['"][^'"]+['"]/i,
        /token\s*[:=]\s*['"][^'"]+['"]/i
      ];

      for (const pattern of secretPatterns) {
        if (pattern.test(line)) {
          findings.push({
            type: 'hardcoded-secret',
            line: lineNumber,
            snippet: line.trim(),
            description: 'Hardcoded secret detected in source code',
            confidence: 1.0
          });
        }
      }

      // Check for SQL injection patterns
      if (this.containsSQLPattern(line)) {
        findings.push({
          type: 'sql-injection',
          line: lineNumber,
          snippet: line.trim(),
          description: 'Potential SQL injection vulnerability',
          confidence: 0.7
        });
      }

      // Check for XSS patterns
      if (this.containsXSSPattern(line)) {
        findings.push({
          type: 'xss',
          line: lineNumber,
          snippet: line.trim(),
          description: 'Potential XSS vulnerability',
          confidence: 0.7
        });
      }
    }

    return findings;
  }

  /**
   * Check if line contains SQL pattern
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
   * Check if line contains XSS pattern
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
   * Get source code files
   */
  private async getSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'php', 'rb', 'java', 'cpp', 'cs', 'go', 'rust'];

    const walk = async (currentDir: string) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(dir, fullPath);

          if (entry.isDirectory()) {
            // Skip node_modules and other common directories
            if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'vendor'].includes(entry.name)) {
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

    await walk(dir);
    return files;
  }
}