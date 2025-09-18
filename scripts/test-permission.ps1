# Simple Permission API Test Script
$BaseUrl = "https://iomt.hoangphucthanh.vn:3030/actlog"
$Token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIzMWVlODA2LWIxZDItNDRiMy05ZTUxLTY5ZDczNzcxY2U3ZSIsInVzZXJuYW1lIjoiQlNOSGhhaSIsImVtYWlsIjoibmd1eWVuaG9uZ2hhaW13ZzIwMDVAZ21haWwuY29tIiwib3JnYW5pemF0aW9uX2lkIjoiN2U5ODNhNzMtYzJiMi00NzVkLWExZGQtODViNzIyYWI0NTgxIiwiZGVwYXJ0bWVudF9pZCI6IjA1OWJkNWIyLWMwZjUtNDM1Ni1iYjM2LTAxMzYxOTU1MWI0MSIsImlhdCI6MTc1ODA5NzQ2MCwiZXhwIjoxNzU4MTgzODYwfQ.TqQioRl9ItivhiCt-ZBQpjyzO_ZuFUAZwV_ZC6Ds-lY"
$OrgId = "7e983a73-c2b2-475d-a1dd-85b722ab4581"

$Headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

Write-Host "Testing Permission APIs..." -ForegroundColor Green

# Test 1: Get permissions
try {
    Write-Host "1. Testing GET /permissions" -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "$BaseUrl/permissions" -Method GET -Headers $Headers
    Write-Host "   SUCCESS: Found $($response.data.Count) permissions" -ForegroundColor Green
} catch {
    Write-Host "   FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Get roles
try {
    Write-Host "2. Testing GET /roles" -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "$BaseUrl/roles?organization_id=$OrgId" -Method GET -Headers $Headers
    Write-Host "   SUCCESS: Found $($response.data.Count) roles" -ForegroundColor Green
} catch {
    Write-Host "   FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Create permission
try {
    Write-Host "3. Testing POST /permissions" -ForegroundColor Cyan
    $newPermission = @{
        name = "test.read"
        description = "Test permission"
        resource = "test"
        action = "read"
        is_active = $true
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BaseUrl/permissions" -Method POST -Headers $Headers -Body $newPermission
    Write-Host "   SUCCESS: Created permission $($response.data.name)" -ForegroundColor Green
} catch {
    Write-Host "   FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Permission API test completed!" -ForegroundColor Magenta