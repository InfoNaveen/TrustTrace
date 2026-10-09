import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import AdmZip from 'adm-zip';
import { supabaseServiceRole } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import { applyPatches } from '@/lib/patcher';
import { createErrorResponse } from '@/lib/api-error';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Rate limit per user (10 patch exports per hour)
    const isAllowed = checkRateLimit(user.id, 10, 60 * 60 * 1000);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 patch exports per hour.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { projectId, export: shouldExport } = body;

    // Validate input
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = supabaseServiceRole();

    // SECURITY: Verify project ownership - never trust user-supplied projectId alone
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // For export, we'll need to download from storage
    // For now, using /tmp which works on Vercel
    const projectPath = path.join('/tmp', `devsentinel-${projectId}`);
    
    // Note: In production, this should load from storage
    // For now, this is a placeholder - the actual patching should happen during orchestration
    // This route is mainly for exporting already-patched code

    if (shouldExport) {
      try {
        // Create ZIP file of the patched project
        const zip = new AdmZip();
        zip.addLocalFolder(projectPath);
        
        const zipBuffer = zip.toBuffer();
        
        // Log timeline event
        const { error: timelineError } = await supabase
          .from('timeline_events')
          .insert([
            {
              project_id: projectId,
              event_type: 'export',
              event_message: 'Patched code exported as ZIP file'
            }
          ]);
        
        if (timelineError) {
          console.error('Error logging timeline event:', timelineError);
          return createErrorResponse(timelineError, 'Failed to export patches', 500);
        }
        
        // @ts-ignore
        return new NextResponse(zipBuffer, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="patched-code.zip"',
          },
        });
      } catch (zipError) {
        console.error('Error creating ZIP file:', zipError);
        return createErrorResponse(zipError, 'Failed to create ZIP file', 500);
      }
    } else {
      // Get patches from database by joining with scans and vulnerabilities tables
      const { data: patches, error: patchesError } = await supabase
        .from('patches')
        .select(`
          *,
          vulnerabilities(file_path)
        `)
        .eq('vulnerabilities.scan.project_id', projectId);
      
      if (patchesError) {
        console.error('Error fetching patches:', patchesError);
        return createErrorResponse(patchesError, 'Failed to fetch patches', 500);
      }
      
      // Convert database patches to patch objects
      const patchObjects = patches.map(patch => ({
        file: patch.vulnerabilities?.file_path || '',
        change: 'Database patch',
        before: patch.before_code || undefined,
        after: patch.after_code || undefined
      }));
      
      // Apply patches to files
      const patchResult = await applyPatches(projectPath, patchObjects);
      
      // Log timeline event
      const { error: timelineError } = await supabase
        .from('timeline_events')
        .insert([
          {
            project_id: projectId,
            event_type: 'patch_apply',
            event_message: `Patches applied to project (${patchResult.applied} successful, ${patchResult.errors.length} errors)`
          }
        ]);
      
      if (timelineError) {
        console.error('Error logging timeline event:', timelineError);
        return createErrorResponse(timelineError, 'Failed to log patch event', 500);
      }
      
      return NextResponse.json({ 
        success: patchResult.success, 
        message: `Patches applied: ${patchResult.applied} successful, ${patchResult.errors.length} errors`,
        errors: patchResult.errors
      });
    }
  } catch (error) {
    return createErrorResponse(error, 'An internal error occurred', 500);
  }
}