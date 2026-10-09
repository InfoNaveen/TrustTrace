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
    'Offensive tools are disabled in production. ' +
    'Set ENABLE_RED_TEAM=true in environment variables to enable. ' +
    'This is a security-sensitive feature requiring explicit authorization.'
  );
}

import { OSINTCollector, OSINTCollectorConfig } from './osint-collector';
import { RedTeamValidationGate } from './neurosploit-integration';

export interface ToolResult {
  success: boolean;
  output: any;
  error?: string;
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

/**
 * Offensive Security Tools Interface
 * Provides LLM-compatible tools for red team operations
 */
export class OffensiveTools {
  private osintCollector: OSINTCollector;
  private redTeamGate: RedTeamValidationGate;

  constructor(projectPath: string) {
    // Initialize with minimal config - tools will be enabled as needed
    const config: OSINTCollectorConfig = {
      enableNuclei: false,
      enableNmap: false,
      enableGf: false,
      timeout: 60000 // 1 minute timeout
    };
    
    this.osintCollector = new OSINTCollector(config, projectPath);
    this.redTeamGate = new RedTeamValidationGate(projectPath);
  }

  /**
   * Execute a tool call from the LLM
   */
  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case 'run_osint_scan':
          return await this.runOSINTScan(toolCall.parameters);
        case 'run_red_team_validation':
          return await this.runRedTeamValidation(toolCall.parameters);
        case 'test_sql_injection':
          return await this.testSQLInjection(toolCall.parameters);
        case 'test_xss':
          return await this.testXSS(toolCall.parameters);
        case 'test_rce':
          return await this.testRCE(toolCall.parameters);
        case 'analyze_source_code':
          return await this.analyzeSourceCode(toolCall.parameters);
        default:
          return {
            success: false,
            output: null,
            error: `Unknown tool: ${toolCall.name}`
          };
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Run OSINT scan on a target
   */
  private async runOSINTScan(params: Record<string, any>): Promise<ToolResult> {
    const { target, enableNuclei, enableNmap, enableGf } = params;
    
    if (!target) {
      return {
        success: false,
        output: null,
        error: 'Target parameter is required'
      };
    }

    // Update collector config based on parameters
    this.osintCollector = new OSINTCollector({
      enableNuclei: enableNuclei ?? false,
      enableNmap: enableNmap ?? false,
      enableGf: enableGf ?? false,
      timeout: 60000
    });

    const results = await this.osintCollector.collect(target);
    
    return {
      success: true,
      output: results
    };
  }

  /**
   * Run red team validation on the project
   */
  private async runRedTeamValidation(params: Record<string, any>): Promise<ToolResult> {
    const results = await this.redTeamGate.runValidation();
    
    return {
      success: true,
      output: results
    };
  }

  /**
   * Test for SQL injection vulnerabilities
   */
  private async testSQLInjection(params: Record<string, any>): Promise<ToolResult> {
    const results = await this.redTeamGate.testSQLInjection();
    
    return {
      success: true,
      output: results
    };
  }

  /**
   * Test for XSS vulnerabilities
   */
  private async testXSS(params: Record<string, any>): Promise<ToolResult> {
    const results = await this.redTeamGate.testXSS();
    
    return {
      success: true,
      output: results
    };
  }

  /**
   * Test for RCE vulnerabilities
   */
  private async testRCE(params: Record<string, any>): Promise<ToolResult> {
    const results = await this.redTeamGate.testRCE();
    
    return {
      success: true,
      output: results
    };
  }

  /**
   * Analyze source code for vulnerabilities
   */
  private async analyzeSourceCode(params: Record<string, any>): Promise<ToolResult> {
    const { sourcePath } = params;
    const pathToAnalyze = sourcePath || this.redTeamGate['projectPath'];
    
    const results = await this.osintCollector.collectFromSourceCode(pathToAnalyze);
    
    return {
      success: true,
      output: results
    };
  }

  /**
   * Get available tools for the LLM
   */
  getAvailableTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'run_osint_scan',
          description: 'Run OSINT collection on a target using external tools like Nuclei, Nmap, and gf',
          parameters: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description: 'The target to scan (URL, IP, or domain)'
              },
              enableNuclei: {
                type: 'boolean',
                description: 'Whether to enable Nuclei vulnerability scanner'
              },
              enableNmap: {
                type: 'boolean',
                description: 'Whether to enable Nmap network scanner'
              },
              enableGf: {
                type: 'boolean',
                description: 'Whether to enable gf pattern matching'
              }
            },
            required: ['target']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'run_red_team_validation',
          description: 'Run comprehensive red team validation against the project using NeuroSploit-inspired techniques',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'test_sql_injection',
          description: 'Specifically test for SQL injection vulnerabilities in the project',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'test_xss',
          description: 'Specifically test for Cross-Site Scripting (XSS) vulnerabilities in the project',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'test_rce',
          description: 'Specifically test for Remote Code Execution (RCE) vulnerabilities in the project',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'analyze_source_code',
          description: 'Analyze source code for potential vulnerabilities',
          parameters: {
            type: 'object',
            properties: {
              sourcePath: {
                type: 'string',
                description: 'Path to the source code to analyze (defaults to project path)'
              }
            },
            required: []
          }
        }
      }
    ];
  }
}