# Evidence captures (GDD §40 Phase 0 exit, §43.6 five-second clip test)

Captured from the real production build (`npm run build`) in headless Chromium with SwiftShader (software GL — framerate here is NOT representative of GPU hardware). Since DECISIONS #79 stills are taken at exact presentation frames (`--stills`, sim + render stepped in lockstep).

| Folder / file | Command | What it shows |
|---|---|---|
| `visual-bar/<name>-before-after.png` | — | side-by-side: Blast, chain (6), Last Stand, Turn |
| `visual-bar/before/` | captures from the build before the visual-bar pass | |
| `visual-bar/after/blast` | `node tools/capture.mjs --stage 14 --at 852 --name blast --best-blast --stills 1,3,6,10,16,26,60` | Blast: inhale → shockwave → staggered shatter → rising wave |
| `visual-bar/after/chain` | `node tools/capture.mjs --stage 13 --at 996 --name chain --stills 1,3,6,10,16,26,60` | 6-chain (best chain in the Hundred witnesses) |
| `visual-bar/after/laststand` | `node tools/capture.mjs --stage 52 --at 857 --name laststand --stills 1,3,6,10,16,26,60` | Last Stand kill, guttering core, push-in |
| `visual-bar/after/turn` | `node tools/capture.mjs --stage 81 --at 864 --name turn --stills 2,10,25,45,60,90` | The Turn |
| `feel/daily-bot.webm` | `node tools/clip.mjs --day 2026-11-19 --seconds 20 --warm 40 --w 960 --h 540` | 20 s, 60 fps, with audio: expert bot on a Daily (audio recorded at true 60 Hz with rendering frozen; video rendered frame-exact from the identical deterministic run, then muxed) |
| `blast/`, `turn/` | Phase 0 originals | |
