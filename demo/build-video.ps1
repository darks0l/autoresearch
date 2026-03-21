Set-Location "C:\Users\favcr\.openclaw\workspace\autoresearch-skill\demo"

# Build video from 8 slide screenshots, each shown ~4 seconds with crossfade
$inputs = ""
$filter = ""
$outputs = ""

for ($i = 1; $i -le 8; $i++) {
    $pad = $i.ToString("00")
    $inputs += " -loop 1 -t 4 -i slide${pad}.jpg"
    $label = "s${i}"
    $filter += "[${i-1}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=3.3:d=0.7[${label}];"
    $outputs += "[${label}]"
}

$filter += "${outputs}concat=n=8:v=1:a=0[out]"

$cmd = "ffmpeg -y $inputs -filter_complex `"$filter`" -map `"[out]`" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 autoresearch-demo.mp4"

Write-Host "Building video..."
Write-Host $cmd
Invoke-Expression $cmd

$size = [math]::Round((Get-Item autoresearch-demo.mp4).Length / 1MB, 2)
Write-Host "Done! autoresearch-demo.mp4 ($size MB)"
