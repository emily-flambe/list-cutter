# Deploy to cutty-dev on Label - Workflow Documentation

## Overview

This GitHub Actions workflow automatically builds and deploys your application to `cutty-dev.emilycogsdill.com` when a pull request is labeled with `deploy-dev`.

## How It Works

1. **Label Trigger**: When you add the `deploy-dev` label to a PR, the workflow starts
2. **Auto-Deploy on Updates**: Any new commits pushed to a labeled PR will automatically trigger a re-deployment
3. **Build Process**: The workflow builds both the React frontend and Cloudflare Worker
4. **Deploy**: Uses Cloudflare Wrangler to deploy to the `cutty-dev` environment
5. **Feedback**: Comments on the PR with deployment status and URLs

## Setup Requirements

### 1. Create the Label

First, create the `deploy-dev` label in your repository:

```bash
gh label create deploy-dev --description "Deploy this PR to cutty-dev environment" --color "0E8A16"
```

Or manually in GitHub:
1. Go to your repository → Issues → Labels
2. Click "New label"
3. Name: `deploy-dev`
4. Description: "Deploy this PR to cutty-dev environment"
5. Color: Green (#0E8A16)

### 2. Add Required Secrets

Add these secrets to your repository (Settings → Secrets and variables → Actions):

- **`CLOUDFLARE_API_TOKEN`**: Your Cloudflare API token with Workers deployment permissions
  - Create at: https://dash.cloudflare.com/profile/api-tokens
  - Required permissions: `Account:Cloudflare Workers Scripts:Edit`
  
- **`CLOUDFLARE_ACCOUNT_ID`**: Your Cloudflare account ID
  - Find at: https://dash.cloudflare.com → Right sidebar → Account ID

## Usage

### Deploy a PR to cutty-dev

1. Create a pull request with your changes
2. Add the `deploy-dev` label to the PR
3. The workflow will automatically:
   - Build the frontend and backend
   - Deploy to cutty-dev.emilycogsdill.com
   - Comment on the PR with the deployment status

### Update a Deployment

Simply push new commits to a PR that already has the `deploy-dev` label. The workflow will automatically re-deploy with your latest changes.

### Remove a Deployment

Remove the `deploy-dev` label from the PR. Note: This doesn't remove the deployed code from cutty-dev, it just stops automatic deployments for that PR.

## Workflow Details

### Build Steps

1. **Frontend Build** (`/app/frontend`):
   - Installs dependencies with `npm ci`
   - Builds production bundle with `npm run build`

2. **Cloudflare Worker Build** (`/cloudflare/workers`):
   - Installs dependencies with `npm ci`
   - Runs tests (non-blocking for dev deployments)
   - Deploys using `wrangler deploy --env dev`

### Environment Configuration

The workflow deploys to the `dev` environment as configured in your `wrangler.toml`:
- URL: https://cutty-dev.emilycogsdill.com
- Environment: `cutty-dev`

### GitHub Features

- **Deployment Tracking**: Creates GitHub deployment records for visibility
- **PR Comments**: Automatic comments with deployment status and links
- **Status Checks**: Updates deployment status (success/failure)

## Troubleshooting

### Common Issues

1. **"Missing CLOUDFLARE_API_TOKEN secret"**
   - Ensure you've added the secret to your repository settings
   - Check the token has correct permissions

2. **"Build failed"**
   - Check the workflow logs for specific error messages
   - Ensure all dependencies are properly listed in package.json

3. **"Deployment succeeded but site not accessible"**
   - Verify the custom domain is configured in Cloudflare
   - Check DNS propagation
   - Ensure the worker route is properly configured

### Viewing Logs

Click on the workflow run in the Actions tab or use the link provided in the PR comment to view detailed logs.

## Security Considerations

- The `CLOUDFLARE_API_TOKEN` should have minimal required permissions
- Only deploy trusted code to the dev environment
- The dev environment may have access to development secrets - ensure proper isolation from production

## Workflow File Location

The workflow is defined in: `.github/workflows/deploy-dev-on-label.yml`