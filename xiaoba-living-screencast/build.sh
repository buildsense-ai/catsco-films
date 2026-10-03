#!/bin/sh
# Rebuild 《小八上班了》 from source: narration → events → sound → frames → mux → checks.
# Needs: python3 (playwright + chromium, numpy, scipy, pillow), ffmpeg. MINIMAX_API_KEY only when lines.json changes.
set -e
cd "$(dirname "$0")"
python3 tools/tts.py                       # MiniMax speech-2.8-hd; cached per line (voices/.hash.json)
python3 tools/render.py events             # page → events.json (EV, captions, cues)
python3 tools/sound.py                     # → out/mix.wav (-14 LUFS)
python3 tools/srt.py                       # → catsco-xiaoba.srt
python3 tools/render.py video out/picture-only-silent.mp4
ffmpeg -y -loglevel error -i out/picture-only-silent.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart catsco-xiaoba.mp4
ffmpeg -y -loglevel error -ss 44.6 -i catsco-xiaoba.mp4 -frames:v 1 -q:v 2 poster.jpg
ffmpeg -hide_banner -nostats -i catsco-xiaoba.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
ffmpeg -hide_banner -nostats -i catsco-xiaoba.mp4 -vf blackdetect=d=0.2:pix_th=0.05 -an -f null - 2>&1 | grep blackdetect || echo "no black frames (besides the fades)"
echo "done: catsco-xiaoba.mp4"
