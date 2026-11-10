# Evidence captures (GDD §40 Phase 0 exit, §43.6 five-second clip test)

Captured from the real production build (`npm run build`) in headless Chromium with SwiftShader (software GL — framerate in these clips is NOT representative of GPU hardware).

| Capture | Command | What it shows |
|---|---|---|
| `blast/` | `node tools/capture.mjs --stage 14 --at 852 --name blast --best-blast` | Blast terraform: the oldest Glyph's 3×3 holds a full block of 9 Stones; one Blast → chain of 9, tiles rise as warm ground |
| `turn/` | `node tools/capture.mjs --stage 81 --at 864 --name turn` | The Turn prototype: warning pulse, the old face hinges down into a cliff, the figure stands on the ledge, play continues on the new face |

Stills are numbered in time order; each folder has the `.webm` recording.
