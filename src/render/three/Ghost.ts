import * as THREE from "three";
import type { World } from "../../sim/World";
import { PALETTE } from "../../data/palette";
import { TILE, wx, wz } from "./Scene";

/**
 * Daily ghost (brief §3.3): another validated run of the same seed, re-simulated in lockstep. Purely visual — a
 * translucent amber outline of their figure and their ground as a faint wireframe. Never touches the live sim.
 */
export class GhostView {
  readonly group = new THREE.Group();
  private figure: THREE.LineSegments;
  private ground: THREE.LineSegments;
  private positions = new Float32Array(400 * 8 * 3);
  private lastSig = "";

  constructor() {
    const ob = new THREE.CylinderGeometry(0.16, 0.25, 1.4, 4, 1);
    ob.rotateY(Math.PI / 4);
    ob.translate(0, 0.7, 0);
    this.figure = new THREE.LineSegments(new THREE.EdgesGeometry(ob), new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.mark).multiplyScalar(1.6), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    g.setDrawRange(0, 0);
    this.ground = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: PALETTE.mark, transparent: true, opacity: 0.16, depthWrite: false }));
    this.group.add(this.ground, this.figure);
    this.group.visible = false;
  }

  update(ghost: World | null): void {
    this.group.visible = !!ghost;
    if (!ghost) return;
    const p = ghost.player;
    this.figure.visible = p.alive;
    this.figure.position.set(wx(p.x), 0.02, wz(p.z));
    const tiles = ghost.grid.list();
    let sum = 0;
    for (const t of tiles) sum = (sum * 31 + t.z * 8 + t.x) | 0;
    const sig = `${tiles.length}:${sum}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    const h = TILE * 0.46;
    let n = 0;
    for (const t of tiles) {
      if (n >= 400) break;
      const x = wx(t.x);
      const z = wz(t.z);
      const c = [x - h, z - h, x + h, z - h, x + h, z - h, x + h, z + h, x + h, z + h, x - h, z + h, x - h, z + h, x - h, z - h];
      for (let i = 0; i < 8; i++) this.positions.set([c[i * 2]!, 0.03, c[i * 2 + 1]!], (n * 8 + i) * 3);
      n++;
    }
    const attr = this.ground.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.needsUpdate = true;
    this.ground.geometry.setDrawRange(0, n * 8);
  }
}
