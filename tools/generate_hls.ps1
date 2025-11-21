<#
generate_hls.ps1

Usage:
  1) Install ffmpeg and ensure `ffmpeg` is on your PATH.
  2) Place your source MP4 (e.g. large_video.mp4) next to this script or provide full path.
  3) Run: .\tools\generate_hls.ps1 -InputPath "C:\path\to\large_video.mp4"

This script will create a `video/` folder with multiple rendition playlists
and a master playlist (video/playlist.m3u8) suitable for serving from GitHub Pages.

Notes:
 - GitHub Pages can serve the small HLS segments and playlists as static files.
 - Make sure each generated .ts segment is <100MB (default hls_time 6s, this will be small).
 - Commit the generated `video/` folder to your repository and push; GitHub Pages will serve it.
 - This avoids storing a single >100MB file in the repo.

Requires: ffmpeg (https://ffmpeg.org/) installed locally.

#>

param(
    [Parameter(Mandatory=$true)]
    [string]$InputPath,
    [string]$OutDir = "video",
    [int]$SegmentTime = 6
)

if (!(Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Error "ffmpeg is not installed or not on PATH. Install ffmpeg first: https://ffmpeg.org/download.html"
    exit 1
}

$absIn = Resolve-Path $InputPath
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root $OutDir
New-Item -ItemType Directory -Path $out -Force | Out-Null

Write-Host "Input:" $absIn
Write-Host "Output directory:" $out

# Renditions settings: label => (resolution, bitrate)
$renditions = @{
    '1080' = @{ res = '1920x1080'; br = '5000k'; maxrate='5350k'; buf='7500k' }
    '720'  = @{ res = '1280x720';  br = '2500k'; maxrate='2675k'; buf='3750k' }
    '480'  = @{ res = '854x480';   br = '1000k'; maxrate='1100k'; buf='1500k' }
}

foreach ($label in $renditions.Keys) {
    $r = $renditions[$label]
    $segPattern = Join-Path $out "$label`p_%03d.ts"
    $playlist  = Join-Path $out "$label`p.m3u8"

    $scale = $r.res
    $bitrate = $r.br
    $maxrate = $r.maxrate
    $bufsize = $r.buf

    $ffArgs = @(
        '-y',
        '-i', "$absIn",
        '-vf', "scale=$scale",
        '-c:a', 'aac',
        '-ar', '48000',
        '-c:v', 'libx264',
        '-profile:v', 'main',
        '-crf', '20',
        '-sc_threshold', '0',
        '-g', '48',
        '-keyint_min', '48',
        '-b:v', $bitrate,
        '-maxrate', $maxrate,
        '-bufsize', $bufsize,
        '-hls_time', "$SegmentTime",
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', "$segPattern",
        "$playlist"
    )

    Write-Host "Creating rendition:" $label
    & ffmpeg @ffArgs
}

# Build master playlist
$master = Join-Path $out 'playlist.m3u8'
"#EXTM3U`n#EXT-X-VERSION:3" | Out-File -FilePath $master -Encoding ascii
foreach ($label in $renditions.Keys) {
    $r = $renditions[$label]
    $playlist = "$label`p.m3u8"
    $resolution = $r.res
    # Estimate bandwidth: add some overhead to bitrate
    $bandwidth = ([int]($r.br -replace 'k','')) * 1000 + 100000
    "`n#EXT-X-STREAM-INF:BANDWIDTH=$bandwidth,RESOLUTION=$resolution`n$playlist" | Out-File -FilePath $master -Append -Encoding ascii
}

Write-Host "HLS generation complete. Master playlist:" $master
Write-Host "Commit the generated '$OutDir' folder to your repo and push to GitHub Pages."
