const AdmZip = require('adm-zip');
import path from 'path';
import { promises as fs } from 'fs';

/**
 * SECURITY: Validates that a resolved path is within the expected directory
 * Prevents directory traversal attacks (e.g., ../../etc/passwd)
 */
function validateExtractPath(targetPath: string, baseDir: string): void {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedBase = path.resolve(baseDir);

  // Ensure the target is within the base directory
  if (!normalizedTarget.startsWith(normalizedBase + path.sep) && normalizedTarget !== normalizedBase) {
    throw new Error('Path traversal attempt detected');
  }
}

/**
 * SECURITY: List of dangerous file extensions that should be rejected
 */
const DANGEROUS_EXTENSIONS = ['.exe', '.sh', '.bat', '.ps1', '.dll', '.so', '.scr', '.cmd', '.com'];

/**
 * SECURITY: Check if file has a dangerous extension
 */
function isDangerousFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return DANGEROUS_EXTENSIONS.includes(ext);
}

/**
 * SECURITY: Validate ZIP entry name for path traversal and other attacks
 */
function validateZipEntryName(entryName: string): void {
  // Reject entries with path traversal sequences
  if (entryName.includes('..') || entryName.startsWith('/') || entryName.startsWith('\\')) {
    throw new Error(`Invalid entry name: ${entryName}`);
  }

  // Reject entries with null bytes
  if (entryName.includes('\x00')) {
    throw new Error('Entry name contains null bytes');
  }
}

// Constants for size limits
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB total
const MAX_FILES = 1000; // Maximum files in ZIP

export default async function extractZip(zipPath: string, extractTo: string): Promise<void> {
  try {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    // SECURITY: Validate ZIP bomb prevention (file count)
    if (zipEntries.length > MAX_FILES) {
      throw new Error(`ZIP contains too many files (${zipEntries.length} > ${MAX_FILES})`);
    }

    let totalSize = 0;
    const extractDir = path.resolve(extractTo);

    // Create extraction directory if it doesn't exist
    try {
      await fs.mkdir(extractDir, { recursive: true });
    } catch (mkdirError) {
      throw new Error(`Failed to create extraction directory: ${mkdirError instanceof Error ? mkdirError.message : 'Unknown error'}`);
    }
    
    // Create all directories first with validation
    for (const entry of zipEntries) {
      // SECURITY: Validate entry name before processing
      validateZipEntryName(entry.entryName);

      const entryPath = path.join(extractDir, entry.entryName);
      
      // SECURITY: Validate resolved path is within extraction directory
      validateExtractPath(entryPath, extractDir);
      
      if (entry.isDirectory) {
        try {
          await fs.mkdir(entryPath, { recursive: true });
        } catch (mkdirError) {
          // Directory might already exist, continue
          console.warn(`Could not create directory ${entryPath}:`, mkdirError);
        }
      }
    }
    
    // Extract all files with security checks
    for (const entry of zipEntries) {
      const entryPath = path.join(extractDir, entry.entryName);
      
      if (!entry.isDirectory) {
        // SECURITY: Reject dangerous file extensions
        if (isDangerousFile(entryPath)) {
          throw new Error(`Dangerous file type rejected: ${entry.entryName}`);
        }

        // SECURITY: Check file size before extraction
        const fileSize = entry.getData().length;
        if (fileSize > MAX_FILE_SIZE) {
          throw new Error(`File too large: ${entry.entryName} (${fileSize} > ${MAX_FILE_SIZE} bytes)`);
        }

        // SECURITY: Check total extracted size against limit
        totalSize += fileSize;
        if (totalSize > MAX_TOTAL_SIZE) {
          throw new Error(`Total extracted size exceeds limit (${totalSize} > ${MAX_TOTAL_SIZE} bytes)`);
        }

        // Ensure parent directory exists
        const dirPath = path.dirname(entryPath);
        try {
          await fs.mkdir(dirPath, { recursive: true });
        } catch (mkdirError) {
          console.warn(`Could not create directory ${dirPath}:`, mkdirError);
        }
        
        // Write file
        try {
          await fs.writeFile(entryPath, entry.getData());
        } catch (writeError) {
          throw new Error(`Failed to extract file ${entry.entryName}: ${writeError instanceof Error ? writeError.message : 'Unknown error'}`);
        }
      }
    }
  } catch (error) {
    console.error('ZIP extraction error:', error);
    throw new Error(`Failed to extract ZIP file: ${error instanceof Error ? error.message : String(error)}`);
  }
}