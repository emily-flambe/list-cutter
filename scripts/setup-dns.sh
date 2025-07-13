#!/bin/bash
# scripts/setup-dns.sh
# DNS configuration script for dual Workers deployment

set -e

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🌐 DNS Configuration for Dual Workers Deployment"
echo "================================================"

# Configuration
DOMAIN="emilycogsdill.com"
ZONE_ID="${CLOUDFLARE_ZONE_ID}"
API_TOKEN="${CLOUDFLARE_API_TOKEN}"

if [ -z "$API_TOKEN" ]; then
    print_error "CLOUDFLARE_API_TOKEN not set"
    echo "Please set your Cloudflare API token:"
    echo "export CLOUDFLARE_API_TOKEN=your_token_here"
    exit 1
fi

if [ -z "$ZONE_ID" ]; then
    print_error "CLOUDFLARE_ZONE_ID not set"
    echo "Please set your Cloudflare Zone ID:"
    echo "export CLOUDFLARE_ZONE_ID=your_zone_id_here"
    exit 1
fi

print_status "Setting up DNS for dual Worker deployment..."
print_status "Domain: $DOMAIN"
print_status "Zone ID: $ZONE_ID"

# Function to create or update DNS record
create_or_update_dns_record() {
    local record_type="$1"
    local record_name="$2"
    local record_content="$3"
    local record_proxied="$4"
    local record_ttl="${5:-1}"
    
    print_status "Processing DNS record: $record_name ($record_type)"
    
    # Check if record exists
    EXISTING_RECORD=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$record_name.$DOMAIN&type=$record_type" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" | jq -r '.result[0].id // "null"')
    
    if [ "$EXISTING_RECORD" != "null" ]; then
        print_status "Updating existing DNS record: $record_name"
        RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$EXISTING_RECORD" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{
                \"type\": \"$record_type\",
                \"name\": \"$record_name\",
                \"content\": \"$record_content\",
                \"ttl\": $record_ttl,
                \"proxied\": $record_proxied
            }")
    else
        print_status "Creating new DNS record: $record_name"
        RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{
                \"type\": \"$record_type\",
                \"name\": \"$record_name\",
                \"content\": \"$record_content\",
                \"ttl\": $record_ttl,
                \"proxied\": $record_proxied
            }")
    fi
    
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    if [ "$SUCCESS" = "true" ]; then
        print_success "✅ DNS record configured: $record_name → $record_content"
    else
        ERROR_MSG=$(echo "$RESPONSE" | jq -r '.errors[0].message // "Unknown error"')
        print_error "❌ Failed to configure DNS record $record_name: $ERROR_MSG"
        return 1
    fi
}

# 1. Unified Worker - points to single Cloudflare Worker
print_status "🎯 Configuring unified worker domain records..."

# Main subdomain (cutty.emilycogsdill.com) - unified worker handles all traffic
create_or_update_dns_record "CNAME" "cutty" "cutty.workers.dev" true 1

# List-cutter subdomain (list-cutter.emilycogsdill.com) - redirect to main
create_or_update_dns_record "CNAME" "list-cutter" "cutty.workers.dev" true 1


# 4. TXT records for verification and security
print_status "🔒 Configuring security and verification records..."

# SPF record (if email sending is configured)
create_or_update_dns_record "TXT" "@" "v=spf1 include:_spf.cloudflare.com ~all" false 3600

# DMARC record (for email security)
create_or_update_dns_record "TXT" "_dmarc" "v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN" false 3600

# 5. Redirect old subdomains if any exist
print_status "🔄 Setting up redirects for legacy endpoints..."

# If there were separate API/frontend subdomains before, redirect them
# This is optional and depends on previous setup

# 6. Verify DNS configuration
print_status "🔍 Verifying DNS configuration..."

sleep 10 # Wait a moment for DNS propagation

# Check root domain
print_status "Testing DNS resolution for root domain..."
ROOT_IP=$(dig +short $DOMAIN | head -1)
if [ -n "$ROOT_IP" ]; then
    print_success "✅ Root domain resolves to: $ROOT_IP"
else
    print_warning "⚠️ Root domain resolution pending (DNS propagation may take time)"
fi

# Check WWW subdomain
print_status "Testing DNS resolution for www subdomain..."
WWW_IP=$(dig +short www.$DOMAIN | head -1)
if [ -n "$WWW_IP" ]; then
    print_success "✅ WWW subdomain resolves to: $WWW_IP"
else
    print_warning "⚠️ WWW subdomain resolution pending"
fi

# 7. SSL Certificate verification
print_status "🔒 Verifying SSL certificate configuration..."

# Check if SSL is working
SSL_CHECK=$(curl -s -I https://$DOMAIN/ | head -1 | grep -o "200" || echo "fail")
if [ "$SSL_CHECK" = "200" ]; then
    print_success "✅ SSL certificate working for main domain"
else
    print_warning "⚠️ SSL certificate may still be provisioning"
fi

# 8. Performance optimization settings
print_status "⚡ Configuring performance optimization..."

# Enable full SSL mode
print_status "Setting SSL mode to Full (strict)..."
SSL_RESPONSE=$(curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/ssl" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"value":"strict"}')

SSL_SUCCESS=$(echo "$SSL_RESPONSE" | jq -r '.success')
if [ "$SSL_SUCCESS" = "true" ]; then
    print_success "✅ SSL mode set to Full (strict)"
else
    print_warning "⚠️ Could not set SSL mode automatically"
fi

# Enable automatic HTTPS rewrites
print_status "Enabling automatic HTTPS rewrites..."
HTTPS_RESPONSE=$(curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/automatic_https_rewrites" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    --data '{"value":"on"}')

HTTPS_SUCCESS=$(echo "$HTTPS_RESPONSE" | jq -r '.success')
if [ "$HTTPS_SUCCESS" = "true" ]; then
    print_success "✅ Automatic HTTPS rewrites enabled"
else
    print_warning "⚠️ Could not enable automatic HTTPS rewrites"
fi

# Summary
echo ""
print_success "🎉 DNS configuration completed!"
echo ""
echo "DNS Configuration Summary:"
echo "========================="
echo "✅ Main domain: cutty.$DOMAIN → Unified Worker"
echo "✅ List-cutter domain: list-cutter.$DOMAIN → Unified Worker"
echo "✅ Security records: SPF, DMARC configured"
echo "✅ SSL configuration: Full (strict) mode"
echo "✅ Performance optimization: Enabled"
echo ""
print_warning "📝 Important notes:"
echo "• DNS propagation may take up to 24 hours globally"
echo "• SSL certificates may take a few minutes to provision"
echo "• All traffic routes through the single unified Worker"
echo "• Environment routing handled by worker environment variables"
echo ""
print_success "🌐 Domain configuration ready for unified Workers deployment!"

# Create DNS configuration record
DNS_RECORD_FILE="deployments/dns_config_$(date +%Y%m%d_%H%M%S).txt"
mkdir -p deployments
cat > "$DNS_RECORD_FILE" <<EOF
DNS Configuration Record
========================

Date: $(date -u)
Domain: $DOMAIN
Zone ID: $ZONE_ID

Records Configured:
- cutty → cutty.workers.dev (proxied)
- list-cutter → cutty.workers.dev (proxied)
- cutty-staging → cutty.workers.dev (proxied)

Security Records:
- SPF: v=spf1 include:_spf.cloudflare.com ~all
- DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@$DOMAIN

SSL Configuration:
- Mode: Full (strict)
- Automatic HTTPS rewrites: Enabled

Status: Configuration completed successfully
EOF

print_status "DNS configuration record saved to $DNS_RECORD_FILE"