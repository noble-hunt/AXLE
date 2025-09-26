#!/bin/bash

# Health check script for suggest API endpoints
# Verifies that the suggest endpoints return proper JSON responses
# Usage: ./scripts/health-check-suggest.sh [BASE_URL]

set -e

BASE_URL="${1:-http://localhost:5000}"
SUGGEST_ENDPOINT="$BASE_URL/api/workouts/suggest/today"

echo "🔍 Health Check: Suggest API Endpoints"
echo "Base URL: $BASE_URL"
echo "========================================="

# Test 1: Check that unauthenticated request returns 401 (expected behavior)
echo -n "1. Testing unauthenticated access (expect 401)... "
response=$(curl -s -w "%{http_code}" -o /dev/null \
  -H "Accept: application/json" \
  "$SUGGEST_ENDPOINT" || echo "000")

if [ "$response" = "401" ]; then
  echo "✅ PASS"
else
  echo "❌ FAIL (got $response, expected 401)"
  exit 1
fi

# Test 2: Check that endpoint responds with JSON content-type header when auth fails
echo -n "2. Testing JSON content-type on auth failure... "
response_headers=$(curl -s -i \
  -H "Accept: application/json" \
  "$SUGGEST_ENDPOINT")

content_type=$(echo "$response_headers" | grep -i "content-type" | head -1 || echo "")
response_body=$(echo "$response_headers" | sed -n '/^$/,$p' | tail -n +2)

if [[ "$content_type" == *"application/json"* ]] && [[ "$response_body" != *"<!DOCTYPE html>"* ]]; then
  echo "✅ PASS"
else
  echo "❌ FAIL (content-type: $content_type, body starts: $(echo "$response_body" | head -c 50))"
  exit 1
fi

# Test 3: Check that endpoint returns expected status codes only
echo -n "3. Testing endpoint returns valid status codes... "
response=$(curl -s -w "%{http_code}" -o /dev/null \
  -H "Accept: application/json" \
  "$SUGGEST_ENDPOINT" || echo "000")

# Valid responses: 401 (auth required), 200 (if somehow public), but not 3xx, 5xx, or 404
if [ "$response" = "401" ] || [ "$response" = "200" ]; then
  echo "✅ PASS"
elif [ "$response" = "404" ]; then
  echo "❌ FAIL (404 - endpoint not found)"
  exit 1
elif [[ "$response" =~ ^3[0-9][0-9]$ ]]; then
  echo "❌ FAIL (got $response - unexpected redirect)"
  exit 1
elif [[ "$response" =~ ^5[0-9][0-9]$ ]]; then
  echo "❌ FAIL (got $response - server error)"
  exit 1
else
  echo "❌ FAIL (got $response - unexpected status)"
  exit 1
fi

# Test 4: Check POST endpoint returns JSON and valid status
echo -n "4. Testing POST endpoint returns JSON... "
post_headers=$(curl -s -i \
  -X POST \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$SUGGEST_ENDPOINT/start")

post_status=$(echo "$post_headers" | head -1 | grep -o '[0-9]\{3\}')
post_content_type=$(echo "$post_headers" | grep -i "content-type" | head -1 || echo "")
post_body=$(echo "$post_headers" | sed -n '/^$/,$p' | tail -n +2)

if [ "$post_status" = "404" ]; then
  echo "❌ FAIL (POST endpoint not found)"
  exit 1
elif [[ "$post_status" =~ ^5[0-9][0-9]$ ]]; then
  echo "❌ FAIL (got $post_status - server error)"
  exit 1
elif [[ "$post_body" == *"<!DOCTYPE html>"* ]]; then
  echo "❌ FAIL (POST returned HTML - SPA fallback detected)"
  exit 1
elif [[ "$post_content_type" == *"application/json"* ]]; then
  echo "✅ PASS"
else
  echo "❌ FAIL (content-type: $post_content_type)"
  exit 1
fi

# Test 5: Test JSON-only enforcement (missing Accept header)
echo -n "5. Testing JSON-only enforcement... "
no_accept_response=$(curl -s -w "%{http_code}" -o /tmp/no_accept_body \
  "$SUGGEST_ENDPOINT" || echo "000")
no_accept_body=$(cat /tmp/no_accept_body 2>/dev/null || echo "")

# Should return 406 (Not Acceptable) or 415 (Unsupported Media Type) for JSON-only endpoints
if [ "$no_accept_response" = "406" ] || [ "$no_accept_response" = "415" ]; then
  echo "✅ PASS (JSON-only enforced)"
elif [[ "$no_accept_body" == *"<!DOCTYPE html>"* ]]; then
  echo "❌ FAIL (returned HTML without Accept header - SPA fallback detected)"
  exit 1
else
  echo "⚠️  WARN (got $no_accept_response, may not enforce JSON-only)"
fi

# Test 6: Verify unknown API routes return JSON 404, not HTML
echo -n "6. Testing unknown API route returns JSON, not HTML... "
unknown_headers=$(curl -s -i \
  -H "Accept: application/json" \
  "$BASE_URL/api/workouts/nonexistent")

unknown_status=$(echo "$unknown_headers" | head -1 | grep -o '[0-9]\{3\}')
unknown_content_type=$(echo "$unknown_headers" | grep -i "content-type" | head -1 || echo "")
unknown_body=$(echo "$unknown_headers" | sed -n '/^$/,$p' | tail -n +2)

# Accept 404 or 401 as valid (401 if auth middleware runs first), as long as it's JSON
if ([[ "$unknown_status" = "404" ]] || [[ "$unknown_status" = "401" ]]) && \
   [[ "$unknown_content_type" == *"application/json"* ]] && \
   [[ "$unknown_body" != *"<!DOCTYPE html>"* ]]; then
  echo "✅ PASS"
elif [[ "$unknown_body" == *"<!DOCTYPE html>"* ]]; then
  echo "❌ FAIL (unknown API route returned HTML - SPA fallback issue)"
  exit 1
else
  echo "❌ FAIL (got $unknown_status with content-type: $unknown_content_type)"
  exit 1
fi

rm -f /tmp/no_accept_body

echo ""
echo "🎉 All health checks passed!"
echo ""
echo "Summary:"
echo "- Suggest endpoint properly rejects unauthenticated requests"
echo "- API returns JSON content-type headers"
echo "- Endpoints exist and are routed correctly"
echo "- API routes are not falling back to SPA HTML"
echo ""
echo "Integration notes:"
echo "- Add this script to CI pipeline: scripts/health-check-suggest.sh"
echo "- Run after server startup: npm run dev & sleep 5 && scripts/health-check-suggest.sh"
echo "- For production: scripts/health-check-suggest.sh https://your-domain.com"