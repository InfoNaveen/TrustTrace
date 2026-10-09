import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { commitToGitHub, extractRepoInfo } from '@/lib/github';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { supabaseServiceRole } from '@/lib/supabase';
import { createErrorResponse } from '@/lib/api-error';
import { checkRateLimit } from '@/lib/rate-limit';

const execPromise = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Authenticate user first
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Rate limit per user (10 commits per hour)
    const isAllowed = checkRateLimit(user.id, 10, 60 * 60 * 1000);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 commits per hour.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { projectId, branchName = 'devsentinel-fixes', commitMessage = 'Apply security fixes from DevSentinel AI', repoUrl } = body;

    // Validate required fields
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!repoUrl) {
      return NextResponse.json({ error: 'Repository URL is required' }, { status: 400 });
    }

    // SECURITY: Verify project ownership before proceeding
    const supabase = supabaseServiceRole();
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // SECURITY: GitHub token should NOT be passed in request body
    // Instead, get it from Supabase user metadata or environment
    // For now, return an error if token is missing with clear guidance
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub integration not configured' },
        { status: 503 }
      );
    }

    const projectPath = path.join(process.cwd(), 'tmp', 'devsentinel', projectId);

    // Extract repository info from URL
    const repoInfo = extractRepoInfo(repoUrl);
    if (!repoInfo) {
      return NextResponse.json({ error: 'Invalid repository URL' }, { status: 400 });
    }

    // Read all files in the project directory to commit
    const filesToCommit: Array<{ path: string; content: string }> = [];
    
    try {
      const getAllFiles = async (dir: string, basePath: string = '') => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(basePath, entry.name);
          
          if (entry.isDirectory()) {
            // Skip node_modules and other common directories
            if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
              await getAllFiles(fullPath, relativePath);
            }
          } else {
            // Read file content
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              filesToCommit.push({
                path: relativePath.replace(/\\/g, '/'), // Normalize path separators
                content
              });
            } catch (readError) {
              // Skip binary files or files that can't be read
              console.warn(`Could not read file ${fullPath}:`, readError);
            }
          }
        }
      };
      
      await getAllFiles(projectPath);
    } catch (readError) {
      console.error('Error reading project files:', readError);
      return createErrorResponse(readError, 'Failed to read project files', 500);
    }

    // Commit files to GitHub
    try {
      const result = await commitToGitHub({
        token: githubToken,
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        branch: branchName,
        message: commitMessage,
        files: filesToCommit
      });
      
      // Log timeline event
      await supabase
        .from('timeline_events')
        .insert([
          {
            project_id: projectId,
            event_type: 'commit',
            event_message: `Changes committed to ${repoInfo.owner}/${repoInfo.repo}`
          }
        ]);
      
      return NextResponse.json({ 
        success: true,
        message: 'Changes committed successfully', 
        prUrl: result.prUrl
      });
    } catch (commitError) {
      console.error('Commit error:', commitError);
      return createErrorResponse(commitError, 'Failed to commit to GitHub', 500);
    }
  } catch (error) {
    return createErrorResponse(error, 'An internal error occurred', 500);
  }
}