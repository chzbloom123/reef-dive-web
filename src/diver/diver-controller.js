import * as THREE from 'three';

// The diver: turns key presses into swimming, and swimming into camera movement.
//
// Each frame:
//   mouse ─> turn head (yaw = left/right, pitch = up/down)
//   keys  ─> thrust (push) in the look direction, pulsing with each fin kick
//   push + buoyancy drift ─> velocity ─> water drag slows it ─> position
//   position ─> keep below the surface, above the seabed, inside the area ─> camera
//
// Water drag is what gives the glide: we never set the speed directly, we only push, and the water
// takes a fixed fraction of the speed away every second. Top speed is where push and drag balance.

const TUNING = {
  lookRadiansPerPixel: 0.0022, // multiplied by the sensitivity slider
  swimPush: 2.2, // m/s² while holding W/A/S/D
  verticalPush: 1.6, // m/s² while holding Space/C
  strongKick: 2.3, // Shift multiplies the push; top speed ≈ push / drag ≈ 1.5 m/s normal, 3.4 m/s strong
  drag: 1.5, // per second; higher = stops sooner. 1.5 means a glide fades out over about 2 seconds
  kickRate: 1.1, // fin kicks per second (x1.45 with Shift)
  breathPeriod: 5.5, // seconds per breath; lungs make divers rise a little on the inhale
  surfaceY: -0.3, // eyes stop just under the surface; you can reach it but not leave the water
  seabedClearance: 0.6, // meters between eyes and sand (your body is under you)
  areaHalfWidth: 14, // soft invisible walls keep you near the reef...
  areaHalfLength: 26,
  wallPush: 1.5, // ...by pushing back gently instead of stopping you dead
};

export function createDiver(camera, input, { groundHeightAt }) {
  const position = camera.position.clone();
  const velocity = new THREE.Vector3();

  // Start by looking wherever the camera was already pointed.
  // 'YXZ' order = turn left/right first, then tilt up/down: how a head actually moves.
  const start = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  let yaw = start.y;
  let pitch = start.x;
  let roll = 0;
  let kickPhase = 0;
  let time = 0;

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const push = new THREE.Vector3();

  function update(dt, { active, sensitivity }) {
    time += dt;

    // Look
    if (active) {
      const mouse = input.consumeMouseDelta();
      const k = TUNING.lookRadiansPerPixel * sensitivity;
      yaw -= mouse.x * k;
      pitch = THREE.MathUtils.clamp(pitch - mouse.y * k, -1.5, 1.5); // just short of straight up/down
    }

    // Which way is "forward"? Where you're looking, including up/down, like a real diver.
    forward.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    const key = (code) => (active && input.isDown(code) ? 1 : 0);
    const ahead = key('KeyW') - key('KeyS');
    const side = key('KeyD') - key('KeyA');
    const rise = key('Space') - key('KeyC');
    const strong = key('ShiftLeft') || key('ShiftRight');

    push.set(0, 0, 0).addScaledVector(forward, ahead).addScaledVector(right, side);
    if (push.lengthSq() > 1) push.normalize(); // diagonal isn't faster
    push.multiplyScalar(TUNING.swimPush);
    push.y += rise * TUNING.verticalPush;

    // Fin kicks: the push pulses instead of being perfectly smooth, which reads as swimming.
    const swimming = ahead !== 0 || side !== 0 || rise !== 0;
    let pulse = 1;
    if (swimming) {
      kickPhase += dt * Math.PI * 2 * TUNING.kickRate * (strong ? 1.45 : 1);
      pulse = 0.7 + 0.6 * Math.max(0, Math.sin(kickPhase));
    }
    velocity.addScaledVector(push, pulse * (strong ? TUNING.strongKick : 1) * dt);

    // Neutral buoyancy: breathing lifts and lowers you slightly, and a slow current nudges you around.
    const breath = Math.sin((time / TUNING.breathPeriod) * Math.PI * 2);
    velocity.y += breath * 0.07 * dt;
    velocity.x += Math.sin(time * 0.21) * 0.04 * dt;
    velocity.z += Math.cos(time * 0.17) * 0.04 * dt;

    // Drag. exp() makes it frame-rate independent: two 1/60 s steps shrink speed exactly as much as one 1/30 s step.
    velocity.multiplyScalar(Math.exp(-TUNING.drag * dt));
    position.addScaledVector(velocity, dt);

    // Limits
    if (position.y > TUNING.surfaceY) {
      position.y = TUNING.surfaceY;
      velocity.y = Math.min(velocity.y, 0);
    }
    const floor = groundHeightAt(position.x, position.z) + TUNING.seabedClearance;
    if (position.y < floor) {
      position.y = floor;
      velocity.y = Math.max(velocity.y, 0);
    }
    softWall(position.x, TUNING.areaHalfWidth, (v) => (velocity.x += v * dt));
    softWall(position.z, TUNING.areaHalfLength, (v) => (velocity.z += v * dt));

    // Camera: tilt slightly into sideways drift and sway with each kick, so the view feels carried by water.
    const sideSpeed = velocity.dot(right);
    const speed = velocity.length();
    const targetRoll = -sideSpeed * 0.04 + Math.sin(kickPhase) * 0.006 * Math.min(speed, 2);
    roll += (targetRoll - roll) * Math.min(1, dt * 3);
    camera.position.copy(position);
    camera.rotation.set(pitch, yaw, roll, 'YXZ');
  }

  // Past the edge, push back in proportion to how far out you are.
  function softWall(value, limit, apply) {
    if (value > limit) apply(-(value - limit) * TUNING.wallPush);
    else if (value < -limit) apply((-limit - value) * TUNING.wallPush);
  }

  return {
    update,
    get depth() {
      return -position.y;
    },
    get speed() {
      return velocity.length();
    },
  };
}
