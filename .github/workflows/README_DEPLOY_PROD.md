# Deploy to Production on Label - Workflow Documentation

## ⚠️ PRODUCTION DEPLOYMENT - USE WITH CAUTION

This GitHub Actions workflow deploys your application to **PRODUCTION** at `list-cutter.com` when a pull request is labeled with `deploy-prod`.

## Key Differences from Dev Deployment

1. **Tests are mandatory** - Build fails if tests don't pass
2. **Deploys to production worker** - Uses `wrangler deploy` (no --env flag)
3. **Production environment** - Marked as production in GitHub deployments
4. **Live user traffic** - Changes affect real users immediately

## How It Works

1. **Label Trigger**: When you add the `deploy-prod` label to a PR, the workflow starts
2. **Test Requirement**: All tests must pass before deployment proceeds
3. **Build Process**: Builds both React frontend and Cloudflare Worker
4. **Deploy**: Uses Cloudflare Wrangler to deploy to production
5. **Feedback**: Comments on PR with deployment status

## Setup Requirements

### 1. Create the Label

Create the `deploy-prod` label with a red color to indicate danger:

```bash
gh label create deploy-prod --description "Deploy this PR to PRODUCTION" --color "D73A4A"
```

Or manually in GitHub:
1. Go to your repository → Issues → Labels
2. Click "New label"
3. Name: `deploy-prod`
4. Description: "Deploy this PR to PRODUCTION"
5. Color: Red (#D73A4A)

### 2. Required Secrets

These should already be configured if you set up the dev deployment:

- **`CLOUDFLARE_API_TOKEN`**: Your Cloudflare API token
- **`CLOUDFLARE_ACCOUNT_ID`**: Your Cloudflare account ID

## Usage

### ⚠️ Production Deployment Checklist

Before adding the `deploy-prod` label:

- [ ] PR has been thoroughly tested in `cutty-dev`
- [ ] All tests are passing
- [ ] Code has been reviewed
- [ ] No console.log or debug code remains
- [ ] Environment variables are production-ready
- [ ] You're prepared for immediate user impact

### Deploy to Production

1. Complete the checklist above
2. Add the `deploy-prod` label to the PR
3. Monitor the deployment progress
4. Verify the deployment at https://list-cutter.com

### Rollback Procedure

If issues occur after deployment:

1. Remove the `deploy-prod` label
2. Revert the PR or push a fix
3. Deploy the fix with the same process

## Workflow Details

### Production Configuration

The workflow uses the default (production) environment in `wrangler.toml`:
- Worker name: `cutty`
- URL: https://list-cutter.com
- Environment: Production

### Key Differences from Dev

1. **Test enforcement**: Tests must pass (no `continue-on-error`)
2. **Deployment command**: `wrangler deploy` (not `deploy --env dev`)
3. **GitHub environment**: Marked as `production_environment: true`
4. **Warning indicators**: Red label color, warning emojis in comments

## Security Considerations

- **No direct push to main**: Always use PRs for production deployments
- **Review requirement**: Have someone review before deploying to prod
- **Monitoring**: Watch error rates and performance after deployment
- **Rollback plan**: Know how to quickly revert if issues arise

## Best Practices

1. **Test in dev first**: Always deploy to `cutty-dev` before production
2. **Small changes**: Deploy small, focused changes
3. **Off-peak hours**: Consider deploying during low-traffic periods
4. **Monitor after deploy**: Watch logs and metrics after deployment
5. **Communicate**: Let team know about production deployments

## Emergency Contacts

If something goes wrong:
1. Check Cloudflare Workers dashboard for errors
2. Review GitHub Actions logs
3. Rollback if necessary using git revert

## Workflow File Location

The workflow is defined in: `.github/workflows/deploy-prod-on-label.yml`