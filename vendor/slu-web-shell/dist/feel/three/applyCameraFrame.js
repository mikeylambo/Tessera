import * as THREE from "three";
const q = new THREE.Quaternion(), e = new THREE.Euler();
/** Map a renderer-neutral CameraFrame (+ optional trauma shake) onto a THREE camera. */
export function applyCameraFrame(camera, frame, shake) {
    camera.position.set(frame.position.x, frame.position.y, frame.position.z);
    camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
    if (frame.roll)
        camera.rotateZ(frame.roll);
    if (shake) {
        camera.position.x += shake.x;
        camera.position.y += shake.y;
        camera.position.z += shake.z;
        camera.quaternion.multiply(q.setFromEuler(e.set(shake.pitch, shake.yaw, shake.roll)));
    }
    const p = camera;
    if (p.isPerspectiveCamera && Math.abs(p.fov - frame.fov) > 1e-3) {
        p.fov = frame.fov;
        p.updateProjectionMatrix();
    }
}
