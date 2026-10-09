import { Octokit } from '@octokit/rest';

export interface GitHubCommitOptions {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

/**
 * SECURITY: Validate GitHub token format before use
 * Prevents token leakage and ensures token is properly formatted
 */
function validateGitHubToken(token: string): void {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid GitHub token provided');
  }

  // GitHub tokens are typically 40+ characters
  if (token.length < 20) {
    throw new Error('Invalid GitHub token format');
  }

  // Warn if token appears to be exposed in logs (don't log it)
  if (token.includes('\n') || token.includes(' ')) {
    throw new Error('Invalid GitHub token format');
  }
}

/**
 * Commit files to a GitHub repository
 * This is a full implementation that creates blobs, trees, commits, and PRs
 */
export async function commitToGitHub(options: GitHubCommitOptions): Promise<{ prUrl?: string }> {
  try {
    // Validate inputs
    if (!options.owner || !options.repo || !options.branch || !options.message || !options.files) {
      throw new Error('Missing required parameters for GitHub commit');
    }

    // Validate token separately to avoid logging it
    try {
      validateGitHubToken(options.token);
    } catch (tokenError) {
      throw tokenError;
    }

    const octokit = new Octokit({ auth: options.token });

    // Get the base branch SHA
    let baseRef;
    try {
      const response = await octokit.git.getRef({
        owner: options.owner,
        repo: options.repo,
        ref: `heads/main`
      });
      baseRef = response.data;
    } catch (error) {
      // Try master branch if main doesn't exist
      try {
        const response = await octokit.git.getRef({
          owner: options.owner,
          repo: options.repo,
          ref: `heads/master`
        });
        baseRef = response.data;
      } catch (masterError) {
        throw new Error('Could not find main or master branch in repository');
      }
    }

    // Create a new branch
    try {
      await octokit.git.createRef({
        owner: options.owner,
        repo: options.repo,
        ref: `refs/heads/${options.branch}`,
        sha: baseRef.object.sha
      });
    } catch (branchError: any) {
      // Check if it's a branch already exists error
      if (branchError.status === 422) {
        console.warn('Branch may already exist, continuing...');
      } else {
        console.warn('Error creating branch:', branchError);
      }
    }

    // Create blobs for each file
    const blobs: Array<{
      path: string;
      sha: string;
      mode: '100644';
      type: 'blob';
    }> = [];
    
    for (const file of options.files) {
      // Skip empty files
      if (!file.content) {
        continue;
      }
      
      try {
        const { data: blob } = await octokit.git.createBlob({
          owner: options.owner,
          repo: options.repo,
          content: file.content
        });
        blobs.push({
          path: file.path,
          sha: blob.sha,
          mode: '100644', // file mode
          type: 'blob'
        });
      } catch (blobError) {
        console.error(`Error creating blob for ${file.path}:`, blobError);
        // Continue with other files
      }
    }

    // If no blobs were created, return early
    if (blobs.length === 0) {
      throw new Error('No files were able to be committed');
    }

    // Create a tree with the blobs
    const { data: tree } = await octokit.git.createTree({
      owner: options.owner,
      repo: options.repo,
      base_tree: baseRef.object.sha,
      tree: blobs
    });

    // Create a commit with the tree
    const { data: commit } = await octokit.git.createCommit({
      owner: options.owner,
      repo: options.repo,
      message: options.message,
      tree: tree.sha,
      parents: [baseRef.object.sha]
    });

    // Update the branch reference
    await octokit.git.updateRef({
      owner: options.owner,
      repo: options.repo,
      ref: `heads/${options.branch}`,
      sha: commit.sha
    });

    // Create a pull request
    const { data: pr } = await octokit.pulls.create({
      owner: options.owner,
      repo: options.repo,
      title: options.message,
      head: options.branch,
      base: baseRef.ref.replace('refs/heads/', ''), // Use the same branch name as baseRef
      body: 'Automated security fixes from DevSentinel AI'
    });

    return {
      prUrl: pr.html_url
    };
  } catch (error) {
    console.error('GitHub commit error:', error);
    throw new Error(`Failed to commit to GitHub: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract repository info from a GitHub URL
 */
export function extractRepoInfo(repoUrl: string): { owner: string; repo: string } | null {
  try {
    // Handle different GitHub URL formats
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\.]+)/,  // Standard format
      /github\.com\/([^\/]+)\/([^\/]+)\.git$/,  // Git format
    ];
    
    for (const pattern of patterns) {
      const match = repoUrl.match(pattern);
      if (match && match[1] && match[2]) {
        return {
          owner: match[1],
          repo: match[2]
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting repo info:', error);
    return null;
  }
}