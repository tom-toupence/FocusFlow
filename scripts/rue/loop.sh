#!/usr/bin/env bash
# Assemble la boucle vidéo du fond de la landing (components/RueLoop.tsx).
#
# 1. Construire avec le labo et lancer le serveur :
#      NEXT_PUBLIC_LAB=1 npx next build && npx next start -p 3100
# 2. Capturer chaque rue (7,5 s à 24 i/s, 1920x1080) :
#      node scripts/rue/loop_record.cjs $W/<scène> <scène> 7.5 1920 1080
# 3. Assembler : bash scripts/rue/loop.sh $W
#
# Chaque rue dure SEG s dans la boucle (4,5 par défaut), fondu FADE compris. La boucle
# commence 1,5 s dans la première rue et se termine par un fondu vers le
# début de cette même rue : le raccord de la boucle est invisible.
# L'ordre doit rester celui de RUE_LOOP_ORDER (components/RueLoop.tsx), et SEG / HALF_FADE
# (= FADE / 2) ceux de ce même fichier, sinon le crédit affiché se décale.
set -euo pipefail
W=${1:?dossier des captures}
OUT=${2:-public/rue/loop}
# Ordre, durée par rue et fondu : surchargeables (ORDER="a b c" SEG=5 FADE=1.2).
read -r -a ORDER <<< "${ORDER:-kabukicho pont sannenzaka ninenzaka hoian-nuit dotonbori sapa sapa-vallee avenue ruelle kanazawa takayama gion-nuit shirakawa tegallalang batad carrefour ecrans hoian ubud-maisons banaue bandung manhattan times-square seattle reine sakrisoy geiranger bryggen viaduc pavillon boulevard fleuve tours}"
FADE=${FADE:-1.2}; SEG=${SEG:-4.5}; FPS=24
mkdir -p "$OUT"

inputs=(); filter=""
for i in "${!ORDER[@]}"; do inputs+=(-framerate $FPS -i "$W/${ORDER[$i]}/f%04d.jpg"); done
inputs+=(-framerate $FPS -i "$W/${ORDER[0]}/f%04d.jpg")   # retour à la première rue
n=${#ORDER[@]}
filter+="[0:v]trim=start=$FADE,setpts=PTS-STARTPTS,format=yuv420p[v0];"
for i in $(seq 1 $n); do filter+="[$i:v]setpts=PTS-STARTPTS,format=yuv420p[s$i];"; done
prev=v0
for i in $(seq 1 $n); do
  off=$(echo "$SEG*$i - $FADE" | bc)
  filter+="[$prev][s$i]xfade=transition=fade:duration=$FADE:offset=$off[x$i];"
  prev=x$i
done
total=$(echo "$SEG*$n" | bc)
filter+="[$prev]trim=duration=$total,setpts=PTS-STARTPTS,split=4[a][b][c][d];[a]scale=1920:1080:flags=lanczos[o1080];[b]scale=1280:720:flags=lanczos[o720];[c]scale=1920:1080:flags=lanczos[w1080];[d]scale=1280:720:flags=lanczos[w720]"

ffmpeg -y -v error "${inputs[@]}" -filter_complex "$filter" \
  -map "[o1080]" -c:v libx264 -preset slow -crf 37 -pix_fmt yuv420p -movflags +faststart -an "$OUT/rue-1080.mp4" \
  -map "[o720]"  -c:v libx264 -preset slow -crf 35 -pix_fmt yuv420p -movflags +faststart -an "$OUT/rue-720.mp4" \
  -map "[w1080]" -c:v libsvtav1 -preset 6 -crf 58 -pix_fmt yuv420p -an "$OUT/rue-1080.webm" \
  -map "[w720]"  -c:v libsvtav1 -preset 6 -crf 56 -pix_fmt yuv420p -an "$OUT/rue-720.webm"
ls -la "$OUT"
