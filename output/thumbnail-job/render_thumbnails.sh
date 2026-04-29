#!/bin/zsh
set -euo pipefail

ROOT="/Users/marti/Desktop/custom-crm/output/thumbnail-job"
SRC="$ROOT/references/Projecte nou-15.png"
OUT="$ROOT/finals"
FONT="/System/Library/Fonts/Supplemental/Arial Bold.ttf"

mkdir -p "$OUT"

ffmpeg -y -i "$SRC" -filter_complex "
[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=18:2,eq=brightness=-0.45:saturation=0.5[bg];
[0:v]crop=720:860:120:40,scale=-1:720[face];
[bg]drawbox=x=0:y=0:w=1280:h=720:color=black@0.18:t=fill[bg2];
[bg2][face]overlay=x=10:y=0[tmp];
[tmp]drawbox=x=575:y=108:w=640:h=340:color=0xE6A437@1.0:t=6[tmp2];
[tmp2]drawbox=x=575:y=108:w=640:h=340:color=black@0.84:t=fill[tmp3];
[tmp3]drawtext=fontfile='$FONT':text='5 REASONS':fontcolor=0xE6A437:fontsize=42:x=625:y=145[tmp4];
[tmp4]drawtext=fontfile='$FONT':text='SOUNDS':fontcolor=white:fontsize=90:x=625:y=198[tmp5];
[tmp5]drawtext=fontfile='$FONT':text='ROBOTIC':fontcolor=white:fontsize=90:x=625:y=294[tmp6];
[tmp6]drawbox=x=625:y=395:w=180:h=46:color=0xD62828@1.0:t=fill[tmp7];
[tmp7]drawtext=fontfile='$FONT':text='VOICE AGENTS':fontcolor=white:fontsize=24:x=646:y=406
" -update 1 -frames:v 1 "$OUT/thumbnail_01.png"

ffmpeg -y -i "$SRC" -filter_complex "
[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=16:2,eq=brightness=-0.52:saturation=0.4[bg];
[0:v]crop=760:900:140:30,scale=-1:700[face];
[bg]drawbox=x=0:y=0:w=1280:h=720:color=0x111111@0.55:t=fill[bg2];
[bg2][face]overlay=x=730:y=20[tmp];
[tmp]drawbox=x=72:y=138:w=560:h=144:color=black@0.72:t=fill[tmp2];
[tmp2]drawtext=fontfile='$FONT':text='WHY THEY':fontcolor=white:fontsize=84:x=98:y=150[tmp3];
[tmp3]drawtext=fontfile='$FONT':text='BREAK':fontcolor=white:fontsize=104:x=160:y=225[tmp4];
[tmp4]drawbox=x=88:y=326:w=142:h=46:color=0xF2B134@1.0:t=fill[tmp5];
[tmp5]drawtext=fontfile='$FONT':text='LATENCY':fontcolor=black:fontsize=24:x=110:y=337[tmp6];
[tmp6]drawbox=x=244:y=326:w=92:h=46:color=0xF2B134@1.0:t=fill[tmp7];
[tmp7]drawtext=fontfile='$FONT':text='TTS':fontcolor=black:fontsize=24:x=268:y=337[tmp8];
[tmp8]drawbox=x=350:y=326:w=130:h=46:color=0xF2B134@1.0:t=fill[tmp9];
[tmp9]drawtext=fontfile='$FONT':text='PROMPTS':fontcolor=black:fontsize=24:x=366:y=337[tmp10];
[tmp10]drawbox=x=502:y=326:w=112:h=46:color=0xD62828@1.0:t=fill[tmp11];
[tmp11]drawtext=fontfile='$FONT':text='AUDIO':fontcolor=white:fontsize=24:x=522:y=337
" -update 1 -frames:v 1 "$OUT/thumbnail_02.png"

ffmpeg -y -i "$SRC" -filter_complex "
[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,gblur=sigma=16,eq=brightness=0.02:saturation=0.9,colorchannelmixer=rr=1:gg=0.96:bb=1.05[bg];
[bg]drawbox=x=0:y=0:w=1280:h=720:color=0xFFD9E9@0.38:t=fill[bg2];
[0:v]crop=740:900:140:30,scale=-1:700[face];
[bg2][face]overlay=x=715:y=20[tmp];
[tmp]drawbox=x=64:y=155:w=550:h=182:color=0x1155CC@0.96:t=fill[tmp2];
[tmp2]drawtext=fontfile='$FONT':text='NOT HUMAN':fontcolor=white:fontsize=82:x=92:y=175[tmp3];
[tmp3]drawtext=fontfile='$FONT':text='YET':fontcolor=white:fontsize=112:x=226:y=252[tmp4];
[tmp4]drawbox=x=88:y=368:w=152:h=46:color=0xFF8C1A@1.0:t=fill[tmp5];
[tmp5]drawtext=fontfile='$FONT':text='VOICE AI':fontcolor=white:fontsize=24:x=104:y=379[tmp6];
[tmp6]drawbox=x=264:y=382:w=210:h=12:color=0xFF4D5A@1.0:t=fill
" -update 1 -frames:v 1 "$OUT/thumbnail_03.png"
