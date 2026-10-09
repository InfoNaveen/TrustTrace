import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { randomUUID } from 'crypto';
import { supabaseServiceRole } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { uploadToStorage } from '@/lib/storage-utils';
import { createErrorResponse } from '@/lib/api-error';
import { checkRateLimit } from '@/lib/rate-limit';
import extractZip from '@/lib/extractZip';
import AdmZip from 'adm-zip';

const execPromise = promisify(exec);

/**
 * SECURITY: Validate file is actually a ZIP by checking magic bytes
 */
function isValidZipFile(buffer: Buffer): boolean {
  // ZIP files start with PK\x03\x04 (0x504B0304)
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 && // P
    buffer[1] === 0x4b && // K
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

/**
 * Create a ZIP file from a directory
 */
async function zipDirectory(dirPath: string): Promise<Buffer> {
  const zip = new AdmZip();
  zip.addLocalFolder(dirPath);
  return zip.toBuffer();
}

export async function POST(request: NextRequest) {
  // Temporary directory for extraction
  let tempExtractDir: string | null = null;

  try {
    // SECURITY: Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Rate limit per user (5 uploads per hour)
    const isAllowed = checkRateLimit(user.id, 5, 60 * 60 * 1000);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 5 uploads per hour.' },
        { status: 429 }
      );
    }

    const userId = user.id;
    const supabase = supabaseServiceRole();

    // Check if it's a file upload, GitHub URL, or user story
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle ZIP file upload or user story
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const userStory = formData.get('userStory') as string | null;
      let projectName = (formData.get('projectName') as string) || `Project ${new Date().toISOString()}`;

      // Sanitize project name
      projectName = projectName.substring(0, 100).replace(/[<>:"/\\|?*]/g, '');

      // Create project in Supabase first to get UUID
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            name: projectName,
            user_id: userId,
            repo_url: null,
          }
        ])
        .select()
        .single();

      if (projectError || !project) {
        console.error('Error creating project:', projectError);
        return createErrorResponse(projectError, 'Failed to create project', 500);
      }

      const projectId = project.id;
      const storagePath = `projects/${projectId}/source.zip`;

      if (userStory) {
        // User story input - will be handled by code generation
        await supabase
          .from('timeline_events')
          .insert([
            {
              project_id: projectId,
              event_type: 'user_story',
              event_message: `User story received: ${userStory.substring(0, 200)}...`
            }
          ]);

        return NextResponse.json({
          success: true,
          projectId: projectId,
          userStory: userStory,
          type: 'user_story'
        });
      } else if (file) {
        // SECURITY: File size validation (server-side, 50MB max)
        if (file.size > 50 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'File too large. Maximum 50MB allowed.' },
            { status: 413 }
          );
        }

        // Handle ZIP file upload
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // SECURITY: Validate ZIP file by checking magic bytes
        if (!isValidZipFile(buffer)) {
          return NextResponse.json(
            { error: 'Invalid file type. Only ZIP files are accepted.' },
            { status: 400 }
          );
        }

        // SECURITY: Save to temp file and validate extraction doesn't have dangerous files
        const tmpDir = os.tmpdir();
        const sessionId = randomUUID();
        tempExtractDir = path.join(tmpDir, `devsentinel-upload-${sessionId}`);
        try {
          // Create temp directory
          await fs.mkdir(tempExtractDir, { recursive: true });

          // Save ZIP to temp file
          const tempZipPath = path.join(tempExtractDir, 'upload.zip');
          await fs.writeFile(tempZipPath, buffer);

          // Extract and validate (path traversal checks are inside extractZip)
          const extractDir = path.join(tempExtractDir, 'extracted');
          await extractZip(tempZipPath, extractDir);

          // Verify extracted files don't contain dangerous extensions
          const dangerousExtensions = ['.exe', '.sh', '.bat', '.ps1', '.dll', '.so', '.scr', '.cmd', '.com'];
          const allFiles = await getAllFilesRecursive(extractDir);
          
          for (const filePath of allFiles) {
            const ext = path.extname(filePath).toLowerCase();
            if (dangerousExtensions.includes(ext)) {
              return NextResponse.json(
                { error: `Dangerous file type rejected: ${path.basename(filePath)}` },
                { status: 400 }
              );
            }
          }

          // Re-read buffer and upload to Supabase Storage
          const zipBuffer = await fs.readFile(tempZipPath);
          await uploadToStorage(storagePath, zipBuffer, 'application/zip');

          // Log timeline event
          await supabase
            .from('timeline_events')
            .insert([
              {
                project_id: projectId,
                event_type: 'upload',
                event_message: `Project uploaded via ZIP file (${Math.round(file.size / 1024)} KB)`
              }
            ]);

          return NextResponse.json({
            success: true,
            projectId: projectId,
            storagePath: storagePath,
            type: 'zip_upload'
          });
        } finally {
          // SECURITY: Clean up temp directory
          if (tempExtractDir) {
            try {
              await fs.rm(tempExtractDir, { recursive: true, force: true });
            } catch (cleanupError) {
              console.warn('Failed to clean up temp directory:', cleanupError);
            }
          }
        }
      } else {
        return NextResponse.json({ error: 'No file or user story provided' }, { status: 400 });
      }
    } else {
      // Handle GitHub repository URL
      const body = await request.json();
      const { repoUrl } = body;
      let { projectName } = body;

      if (!repoUrl) {
        return NextResponse.json({ error: 'Repository URL is required' }, { status: 400 });
      }

      // Sanitize project name
      projectName = (projectName || `GitHub Project ${new Date().toISOString()}`).substring(0, 100).replace(/[<>:"/\\|?*]/g, '');

      // Security: Strictly validate URL to prevent command injection
      const urlPattern = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[a-zA-Z0-9._-]+)+\/?(\.git)?$/;
      if (!urlPattern.test(repoUrl)) {
        return NextResponse.json({ error: 'Invalid repository URL format' }, { status: 400 });
      }

      // Create project in Supabase first
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            name: projectName,
            user_id: userId,
            repo_url: repoUrl,
          }
        ])
        .select()
        .single();

      if (projectError || !project) {
        console.error('Error creating project:', projectError);
        return createErrorResponse(projectError, 'Failed to create project', 500);
      }

      const projectId = project.id;

      // Clone repository to temporary location (cross-platform compatible)
      const tmpDir = os.tmpdir();
      const sessionId = randomUUID();
      const cloneDir = path.join(tmpDir, `devsentinel-clone-${sessionId}`);

      try {
        // SECURITY: Use environment variable GITHUB_TOKEN if available, never from request body
        const githubToken = process.env.GITHUB_TOKEN;
        let cloneCmd = `git clone --depth 1 "${repoUrl}" "${cloneDir}"`;

        if (githubToken) {
          // Add token to URL for private repositories
          const urlObj = new URL(repoUrl);
          if (urlObj.hostname === 'github.com') {
            cloneCmd = `git clone --depth 1 "https://${githubToken}@${urlObj.hostname}${urlObj.pathname}" "${cloneDir}"`;
          }
        }

        await execPromise(cloneCmd, { timeout: 60000 }); // 60 second timeout

        // Create ZIP from cloned repository
        const zipBuffer = await zipDirectory(cloneDir);

        // Upload to Supabase Storage
        const storagePath = `projects/${projectId}/source.zip`;
        await uploadToStorage(storagePath, zipBuffer, 'application/zip');

        // Clean up cloned directory
        try {
          await fs.rm(cloneDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.warn('Failed to clean up clone directory:', cleanupError);
        }

        // Log timeline event
        await supabase
          .from('timeline_events')
          .insert([
            {
              project_id: projectId,
              event_type: 'upload',
              event_message: `Project cloned from ${repoUrl}`
            }
          ]);

        return NextResponse.json({
          success: true,
          projectId: projectId,
          storagePath: storagePath,
          type: 'github_repo'
        });
      } catch (cloneError) {
        console.error('Git clone error:', cloneError);

        // Clean up on error
        try {
          await fs.rm(cloneDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }

        return createErrorResponse(cloneError, 'Failed to clone repository', 500);
      }
    }
  } catch (error) {
    return createErrorResponse(error, 'An internal error occurred', 500);
  } finally {
    // SECURITY: Always clean up temp directory
    if (tempExtractDir) {
      try {
        await fs.rm(tempExtractDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Failed to clean up temp directory:', cleanupError);
      }
    }
  }
}

/**
 * Helper function to recursively get all files
 */
async function getAllFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await getAllFilesRecursive(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error('Error reading directory:', err);
  }
  
  return files;
}
