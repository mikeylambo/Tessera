import * as THREE from "three";
import type { CameraFrame } from "../CameraRig.js";
import type { ShakeOffset } from "../TraumaShake.js";
/** Map a renderer-neutral CameraFrame (+ optional trauma shake) onto a THREE camera. */
export declare function applyCameraFrame(camera: THREE.PerspectiveCamera | THREE.Camera, frame: CameraFrame, shake?: ShakeOffset): void;
