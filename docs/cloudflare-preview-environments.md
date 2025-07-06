# Cloudflare Workers Preview Environments

This project uses Cloudflare Workers' native versioning and preview functionality to create preview environments for each pull request.

## How It Works

1. **Version Upload**: When you push to a PR or feature branch, the CI workflow runs `wrangler versions upload` to create a new version of your Worker
2. **Preview Deployment**: The version is deployed with 0% traffic and tagged with the PR number or branch name
3. **Preview URLs**: Preview URLs are automatically generated in the format:
   - `https://pr-123.list-cutter-api.workers.dev` (for API)
   - `https://pr-123.cutty-frontend.workers.dev` (for frontend)

## Configuration

### Prerequisites

1. **Enable Versioning**: Both `wrangler.toml` files have versioning enabled:
   ```toml
   [version_metadata]
   enable_versions = true
   ```

2. **GitHub Secrets**: Add `CLOUDFLARE_API_TOKEN` to your repository secrets with these permissions:
   - Account: Cloudflare Workers Scripts:Edit
   - Account: Worker Routes:Edit
   - Zone: Zone:Read

### CI/CD Workflow

The `.github/workflows/cloudflare-preview-deploy.yml` workflow:
- Triggers on pull requests and feature branches
- Uploads new versions using `wrangler versions upload`
- Deploys versions as previews with 0% traffic
- Comments on PRs with preview URLs

## Usage

1. **Create a PR**: Preview environments are automatically created
2. **View Preview**: Click the preview URLs in the PR comment
3. **Update Preview**: Push new commits to automatically update the preview
4. **Manage Versions**: View all versions in the Cloudflare dashboard

## Local Testing

To test version uploads locally:

```bash
# Upload a new version
wrangler versions upload --message "Test version"

# Deploy as preview with tag
wrangler versions deploy <version-id> --percentage 0 --tag preview-test
```

## Troubleshooting

### Preview URLs Not Working

1. Check that versioning is enabled in your Worker settings
2. Verify the GitHub Actions workflow ran successfully
3. Check the Cloudflare dashboard for the uploaded versions

### Version Upload Fails

1. Ensure your `CLOUDFLARE_API_TOKEN` has the correct permissions
2. Check that your `wrangler.toml` is valid
3. Verify the Worker builds successfully locally

## Best Practices

1. **Version Messages**: Include PR numbers or commit SHAs in version messages for tracking
2. **Cleanup**: Old preview versions can be managed through the Cloudflare dashboard
3. **Testing**: Always test changes locally before pushing to ensure successful deployments