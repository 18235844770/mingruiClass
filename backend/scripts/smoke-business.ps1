$ErrorActionPreference = 'Stop'

$results = @()

function Add-Result($name, $ok, $detail) {
  $script:results += [pscustomobject]@{
    name = $name
    ok = $ok
    detail = $detail
  }
}

function Call-Api($method, $url, $headers, $body) {
  try {
    if ($null -ne $body) {
      return Invoke-RestMethod -Method $method -Uri $url -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8)
    }
    return Invoke-RestMethod -Method $method -Uri $url -Headers $headers
  }
  catch {
    $resp = $_.Exception.Response
    if ($resp -and $resp.GetResponseStream) {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $text = $reader.ReadToEnd()
      throw $text
    }
    throw $_
  }
}

try {
  $health = Call-Api 'GET' 'http://localhost:3000/api/health' @{} $null
  Add-Result 'health' ($health.ok -eq $true) ($health | ConvertTo-Json -Compress)
}
catch { Add-Result 'health' $false $_.Exception.Message }

try {
  $admin = Call-Api 'POST' 'http://localhost:3000/api/auth/login' @{} @{ username = 'admin'; password = 'admin123' }
  $adminToken = $admin.accessToken
  Add-Result 'login-admin' (-not [string]::IsNullOrEmpty($adminToken)) 'ok'
}
catch { Add-Result 'login-admin' $false $_.Exception.Message }

try {
  $sales = Call-Api 'POST' 'http://localhost:3000/api/auth/login' @{} @{ username = 'sales'; password = 'admin123' }
  $salesToken = $sales.accessToken
  Add-Result 'login-sales' (-not [string]::IsNullOrEmpty($salesToken)) 'ok'
}
catch { Add-Result 'login-sales' $false $_.Exception.Message }

try {
  $owner = Call-Api 'POST' 'http://localhost:3000/api/auth/login' @{} @{ username = 'owner'; password = 'admin123' }
  $ownerToken = $owner.accessToken
  Add-Result 'login-owner' (-not [string]::IsNullOrEmpty($ownerToken)) 'ok'
}
catch { Add-Result 'login-owner' $false $_.Exception.Message }

if (-not $adminToken -or -not $salesToken -or -not $ownerToken) {
  $results | ConvertTo-Json -Depth 6
  exit 0
}

$adminHeaders = @{ Authorization = "Bearer $adminToken" }
$salesHeadersBase = @{ Authorization = "Bearer $salesToken" }
$ownerHeaders = @{ Authorization = "Bearer $ownerToken" }

try {
  $mine = Call-Api 'GET' 'http://localhost:3000/api/campuses/mine' $salesHeadersBase $null
  $salesCampusId = $mine[0].id
  Add-Result 'sales-campus-mine' (-not [string]::IsNullOrEmpty($salesCampusId)) ($mine | ConvertTo-Json -Compress)
}
catch { Add-Result 'sales-campus-mine' $false $_.Exception.Message }

if (-not $salesCampusId) {
  $results | ConvertTo-Json -Depth 6
  exit 0
}

$salesHeaders = @{ Authorization = "Bearer $salesToken"; 'X-Campus-Id' = $salesCampusId }

try {
  $usersAdmin = Call-Api 'GET' 'http://localhost:3000/api/users?page=1&pageSize=5' $adminHeaders $null
  Add-Result 'admin-users-access' ($usersAdmin.total -ge 0) 'ok'
}
catch { Add-Result 'admin-users-access' $false $_.Exception.Message }

try {
  $null = Call-Api 'GET' 'http://localhost:3000/api/users?page=1&pageSize=5' $salesHeaders $null
  Add-Result 'sales-users-forbidden' $false 'sales should not access /users but succeeded'
}
catch {
  $msg = $_.Exception.Message
  Add-Result 'sales-users-forbidden' ($msg -match '403|Forbidden|无权|权限') $msg
}

$studentName = '流程测试学生-' + (Get-Date -Format 'HHmmss')
try {
  $student = Call-Api 'POST' 'http://localhost:3000/api/students' $salesHeaders @{ name = $studentName; phone = '13800000000'; totalAmount = '3000'; paidStatus = $true; remark = '业务流程测试' }
  $studentId = $student.id
  Add-Result 'student-create' (-not [string]::IsNullOrEmpty($studentId)) ($student | ConvertTo-Json -Compress)
}
catch { Add-Result 'student-create' $false $_.Exception.Message }

if ($studentId) {
  try {
    $null = Call-Api 'POST' 'http://localhost:3000/api/students' $salesHeaders @{ name = $studentName; phone = ''; totalAmount = '1000'; paidStatus = $false; remark = '重复名测试' }
    Add-Result 'student-duplicate-name-check' $false 'expected duplicate conflict but succeeded'
  }
  catch {
    $msg = $_.Exception.Message
    Add-Result 'student-duplicate-name-check' ($msg -match '重复|409|Conflict') $msg
  }

  try {
    $courses = Call-Api 'POST' ("http://localhost:3000/api/students/$studentId/courses") $salesHeaders @{
      courses = @(
        @{ courseName = '数学'; coursePrice = '1000'; totalHours = '10'; remainingHours = '10'; courseType = '1v1'; remark = '测试1' },
        @{ courseName = '英语'; coursePrice = '1200'; totalHours = '12'; remainingHours = '12'; courseType = 'small'; remark = '测试2' }
      )
    }
    $courseId = $courses.data[0].id
    Add-Result 'student-course-batch-create' ($courses.count -ge 1 -and $courseId) 'ok'
  }
  catch { Add-Result 'student-course-batch-create' $false $_.Exception.Message }

  try {
    $detail = Call-Api 'GET' ("http://localhost:3000/api/students/$studentId") $salesHeaders $null
    Add-Result 'student-detail' ($detail.courses.Count -ge 1) 'ok'
  }
  catch { Add-Result 'student-detail' $false $_.Exception.Message }

  if ($courseId) {
    try {
      $consume = Call-Api 'POST' 'http://localhost:3000/api/consumptions' $salesHeaders @{
        studentCourseId = $courseId
        consumedHours = '2'
        consumptionTime = (Get-Date).ToString('o')
        remark = '流程测试消课'
      }
      Add-Result 'consumption-create' ($consume.data.id -ne $null) ($consume | ConvertTo-Json -Compress)
    }
    catch { Add-Result 'consumption-create' $false $_.Exception.Message }

    try {
      $consList = Call-Api 'GET' 'http://localhost:3000/api/consumptions?page=1&pageSize=10' $salesHeaders $null
      Add-Result 'consumption-list' ($consList.total -ge 1) 'ok'
    }
    catch { Add-Result 'consumption-list' $false $_.Exception.Message }
  }

  try {
    $lowHours = Call-Api 'GET' 'http://localhost:3000/api/students?page=1&pageSize=10&lowHours=true' $salesHeaders $null
    Add-Result 'low-hours-query' ($lowHours.total -ge 0) 'ok'
  }
  catch { Add-Result 'low-hours-query' $false $_.Exception.Message }
}

try {
  $dash = Call-Api 'GET' 'http://localhost:3000/api/dashboard/summary' $ownerHeaders $null
  Add-Result 'owner-dashboard-summary' ($dash.activeStudents -ge 0) 'ok'
}
catch { Add-Result 'owner-dashboard-summary' $false $_.Exception.Message }

try {
  $reports = Call-Api 'GET' 'http://localhost:3000/api/reports?page=1&pageSize=10' $ownerHeaders $null
  Add-Result 'owner-reports-list' ($reports.total -ge 0) 'ok'
}
catch { Add-Result 'owner-reports-list' $false $_.Exception.Message }

try {
  $logs = Call-Api 'GET' 'http://localhost:3000/api/logs?page=1&pageSize=20' $adminHeaders $null
  Add-Result 'admin-logs-query' ($logs.total -ge 0) 'ok'
}
catch { Add-Result 'admin-logs-query' $false $_.Exception.Message }

$results | ConvertTo-Json -Depth 8
