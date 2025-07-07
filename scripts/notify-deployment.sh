#!/bin/bash
# scripts/notify-deployment.sh
# Deployment notification script

STATUS=$1
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
DEPLOYMENT_URL="https://cutty.com"

if [ -z "$STATUS" ]; then
    echo "Usage: $0 <success|failure>"
    exit 1
fi

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

if [ "$STATUS" = "success" ]; then
    MESSAGE="🎉 List Cutter Production Deployment Successful

✅ Deployment completed at: $TIMESTAMP
🌐 Application URL: $DEPLOYMENT_URL
📊 Health Check: $DEPLOYMENT_URL/health
📈 Metrics: $DEPLOYMENT_URL/metrics

The unified Cloudflare Workers architecture is now live!"

    print_success "Deployment successful notification"
    
elif [ "$STATUS" = "failure" ]; then
    MESSAGE="❌ List Cutter Production Deployment Failed

⚠️ Deployment failed at: $TIMESTAMP
🔍 Check logs and consider rollback
📊 Health Check: $DEPLOYMENT_URL/health

Manual intervention may be required."

    print_error "Deployment failed notification"
    
else
    print_error "Unknown status: $STATUS"
    exit 1
fi

# Log the notification
echo "$MESSAGE" >> deployment.log

# Send notification via multiple channels
print_status "Sending deployment notifications..."

# 1. Email notification (if configured)
if [ -n "$NOTIFICATION_EMAIL" ]; then
    echo "$MESSAGE" | mail -s "List Cutter Deployment - $STATUS" "$NOTIFICATION_EMAIL" 2>/dev/null && \
        print_success "Email notification sent to $NOTIFICATION_EMAIL" || \
        print_error "Failed to send email notification"
fi

# 2. Slack notification (if webhook configured)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    SLACK_PAYLOAD=$(cat <<EOF
{
    "text": "List Cutter Deployment Notification",
    "attachments": [
        {
            "color": "$([ "$STATUS" = "success" ] && echo "good" || echo "danger")",
            "fields": [
                {
                    "title": "Status",
                    "value": "$STATUS",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$TIMESTAMP",
                    "short": true
                },
                {
                    "title": "URL",
                    "value": "$DEPLOYMENT_URL",
                    "short": false
                }
            ]
        }
    ]
}
EOF
)
    
    curl -X POST -H 'Content-type: application/json' \
        --data "$SLACK_PAYLOAD" \
        "$SLACK_WEBHOOK_URL" 2>/dev/null && \
        print_success "Slack notification sent" || \
        print_error "Failed to send Slack notification"
fi

# 3. Discord notification (if webhook configured)
if [ -n "$DISCORD_WEBHOOK_URL" ]; then
    DISCORD_COLOR=$([ "$STATUS" = "success" ] && echo "3066993" || echo "15158332")
    DISCORD_PAYLOAD=$(cat <<EOF
{
    "embeds": [
        {
            "title": "List Cutter Deployment",
            "description": "Deployment status notification",
            "color": $DISCORD_COLOR,
            "fields": [
                {
                    "name": "Status",
                    "value": "$STATUS",
                    "inline": true
                },
                {
                    "name": "Timestamp",
                    "value": "$TIMESTAMP",
                    "inline": true
                },
                {
                    "name": "URL",
                    "value": "$DEPLOYMENT_URL",
                    "inline": false
                }
            ]
        }
    ]
}
EOF
)
    
    curl -X POST -H 'Content-type: application/json' \
        --data "$DISCORD_PAYLOAD" \
        "$DISCORD_WEBHOOK_URL" 2>/dev/null && \
        print_success "Discord notification sent" || \
        print_error "Failed to send Discord notification"
fi

# 4. Teams notification (if webhook configured)
if [ -n "$TEAMS_WEBHOOK_URL" ]; then
    TEAMS_COLOR=$([ "$STATUS" = "success" ] && echo "00FF00" || echo "FF0000")
    TEAMS_PAYLOAD=$(cat <<EOF
{
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "$TEAMS_COLOR",
    "summary": "List Cutter Deployment",
    "sections": [{
        "activityTitle": "List Cutter Deployment",
        "activitySubtitle": "Status: $STATUS",
        "facts": [{
            "name": "Timestamp",
            "value": "$TIMESTAMP"
        }, {
            "name": "URL",
            "value": "$DEPLOYMENT_URL"
        }]
    }]
}
EOF
)
    
    curl -X POST -H 'Content-type: application/json' \
        --data "$TEAMS_PAYLOAD" \
        "$TEAMS_WEBHOOK_URL" 2>/dev/null && \
        print_success "Teams notification sent" || \
        print_error "Failed to send Teams notification"
fi

# 5. Console output
echo ""
echo "================================================"
echo "$MESSAGE"
echo "================================================"
echo ""

# 6. Create deployment record
DEPLOYMENT_RECORD_FILE="deployments/$(date +%Y%m%d_%H%M%S)_${STATUS}.txt"
mkdir -p deployments
echo "$MESSAGE" > "$DEPLOYMENT_RECORD_FILE"
print_status "Deployment record saved to $DEPLOYMENT_RECORD_FILE"

print_success "Deployment notifications completed"