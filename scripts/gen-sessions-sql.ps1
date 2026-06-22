# Generates import-sessions-v2.sql from the raw CSV.
# Run: .\scripts\gen-sessions-sql.ps1
# Then paste the output SQL into Supabase SQL Editor and run ONCE.

$csvPath = "C:\Users\user\Downloads\הכנסת אימונים למערכת - גיליון1.csv"
$outPath = "C:\Users\user\Downloads\import-sessions-v2.sql"

$emailMap = @{
    'אסף ציקלג'       = 'asafts@gmail.com'
    'ויקטור שימנסקי'  = 'vikshim@gmail.com'
    "נועה אנג'ל"      = 'noaehome@gmail.com'
    'עופר חיים'       = 'ofer.hm@gmail.com'
    'אבי שוקרון'      = 'aviarpal@gmail.com'
    'מוניר אבו רוקין' = 'munir1abr@gmail.com'
    'קרין פולונסקי'   = 'karin19975@gmail.com'
    'אמיר זיטמן'      = 'amir.zietman@gmail.com'
}

if (-not (Test-Path $csvPath)) {
    Write-Host "ERROR: file not found: $csvPath"
    exit 1
}

$raw = Get-Content -Path $csvPath -Encoding UTF8
$inserts = [System.Collections.Generic.List[string]]::new()
$skipped = @{}

foreach ($line in $raw) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    # Try tab-separated first (Google Sheets TSV export), then comma
    $cols = $line -split "`t"
    if ($cols.Count -lt 5) { $cols = $line -split ',' }
    if ($cols.Count -lt 5) { continue }

    $coachName = $cols[0].Trim()
    $dateStr   = $cols[1].Trim()
    $source    = $cols[3].Trim()
    $location  = $cols[4].Trim()

    # Price = last numeric column
    $priceNis = 0
    for ($i = $cols.Count - 1; $i -ge 5; $i--) {
        if ($cols[$i].Trim() -match '^\d+$') {
            $priceNis = [int]$cols[$i].Trim()
            break
        }
    }

    # Skip empty coach name or header rows
    if ([string]::IsNullOrWhiteSpace($coachName)) { continue }
    if ($dateStr -notmatch '\d') { continue }

    # Skip unknown coaches
    if (-not $emailMap.ContainsKey($coachName)) {
        if ($skipped.ContainsKey($coachName)) { $skipped[$coachName]++ }
        else { $skipped[$coachName] = 1 }
        continue
    }

    $email = $emailMap[$coachName]

    # Date: DD/MM/YYYY -> YYYY-MM-DD
    if ($dateStr -notmatch '^(\d{2})/(\d{2})/(\d{4})$') { continue }
    $sqlDate = "$($Matches[3])-$($Matches[2])-$($Matches[1])"

    # Training type: G1* locations are group sessions
    $trainingType = if ($location -match '^G1') { 'group' } else { 'private' }

    # Escape single quotes for SQL
    $locEsc = $location -replace "'", "''"
    $srcEsc = $source  -replace "'", "''"

    $inserts.Add("  (gen_random_uuid(), '$sqlDate', '', '', '$email', '$trainingType', 'completed', $priceNis, '$srcEsc', '$locEsc')")
}

if ($inserts.Count -eq 0) {
    Write-Host "ERROR: no rows generated. Check file path and encoding."
    exit 1
}

$sql  = "INSERT INTO sessions (id, date, start_time, end_time, coach_email, training_type, status, price_nis, source, name)`n"
$sql += "VALUES`n"
$sql += ($inserts -join ",`n") + ";"

[System.IO.File]::WriteAllText($outPath, $sql, [System.Text.Encoding]::UTF8)

Write-Host "OK: $($inserts.Count) rows -> $outPath"
Write-Host ""
if ($skipped.Count -gt 0) {
    Write-Host "Skipped (not in coaches table):"
    foreach ($k in ($skipped.Keys | Sort-Object)) {
        Write-Host "  - $k ($($skipped[$k]) sessions)"
    }
}
