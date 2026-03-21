Set-Location "C:\Users\favcr\.openclaw\workspace\autoresearch-skill\demo"

# Build video from 8 slide screenshots, each shown 4 seconds with fade transitions
$filter = "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=3.3:d=0.7[s1];" +
          "[1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=3.3:d=0.7[s2];" +
          "[2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=3.3:d=0.7[s3];" +
          "[3:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=3.3:d=0.7[s4];" +
          "[4:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=3.3:d=0.7[s5];" +
          "[5:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=3.3:d=0.7[s6];" +
          "[6:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=3.3:d=0.7[s7];" +
          "[7:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=3.3:d=0.7[s8];" +
          "[s1][s2][s3][s4][s5][s6][s7][s8]concat=n=8:v=1:a=0[out]"

Write-Host "Building video..."
& ffmpeg -y `
  -loop 1 -t 4 -i slide01.jpg `
  -loop 1 -t 4 -i slide02.jpg `
  -loop 1 -t 4 -i slide03.jpg `
  -loop 1 -t 4 -i slide04.jpg `
  -loop 1 -t 4 -i slide05.jpg `
  -loop 1 -t 4 -i slide06.jpg `
  -loop 1 -t 4 -i slide07.jpg `
  -loop 1 -t 4 -i slide08.jpg `
  -filter_complex $filter `
  -map "[out]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 `
  autoresearch-demo.mp4

$size = [math]::Round((Get-Item autoresearch-demo.mp4).Length / 1MB, 2)
Write-Host "Done! autoresearch-demo.mp4 ($size MB)"
