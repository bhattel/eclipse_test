$inputFile = ".\Seq1.mp4"
$outputFastStart = ".\webFastStart.mp4"
$outputPreview = ".\webPreview.mp4"


# ffmpeg -i $inputFile -c:v libx264 -preset slow -crf 20 -c:a aac -b:a 128k -movflags +faststart $outputFastStart
ffmpeg -y -ss 0 -t 8 -i $inputFile -c:v libx264 -preset veryfast -crf 28 -c:a aac -b:a 64k -movflags +faststart $outputPreview