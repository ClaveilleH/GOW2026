// ─── Paramètres (modifiables depuis ton menu debug) ──────────────────────────
export const wanderParams = {
  distanceCercle:   10,
  wanderRadius:     2,
  displaceRange:    0.3,
  maxForce:         8,
  THRUST_FORCE:     10,
  MAX_SPEED:        20,
  TURN_SPEED:       0.07,
  // --- wall avoidance ---
  wallAvoidRadius:  25,   // distance (unités monde) à partir de laquelle on fuit
  wallAvoidWeight:  2.5,  // multiplicateur de la force de répulsion
  ARENA_HALF:       78,   // demi-taille de l'arène (tes murs sont à ±80, un peu de marge)
  debug:            true,
};

// ─── Helpers visuels ─────────────────────────────────────────────────────────
function getOrCreateDebugHelpers(moto, scene) {
  if (moto._wanderDebug) return moto._wanderDebug;

  const segments = 64;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new BABYLON.Vector3(Math.cos(a), 0, Math.sin(a)));
  }
  const circle = BABYLON.MeshBuilder.CreateLines("wanderCircle", { points: pts, updatable: true }, scene);
  circle.color = new BABYLON.Color3(1, 1, 1);

  const centerSphere = BABYLON.MeshBuilder.CreateSphere("wanderCenter", { diameter: 0.15 }, scene);
  centerSphere.material = Object.assign(new BABYLON.StandardMaterial("mRed", scene), {
    emissiveColor: new BABYLON.Color3(1, 0.1, 0.1), disableLighting: true,
  });

  const targetSphere = BABYLON.MeshBuilder.CreateSphere("wanderTarget", { diameter: 0.25 }, scene);
  targetSphere.material = Object.assign(new BABYLON.StandardMaterial("mGreen", scene), {
    emissiveColor: new BABYLON.Color3(0.1, 0.9, 0.3), disableLighting: true,
  });

  const dirLine = BABYLON.MeshBuilder.CreateLines("wanderDir", {
    points: [BABYLON.Vector3.Zero(), BABYLON.Vector3.One()], updatable: true,
  }, scene);
  dirLine.color = new BABYLON.Color3(0.2, 0.6, 1);

  // Ligne répulsion mur (orange) — visible seulement quand un mur est proche
  const wallLine = BABYLON.MeshBuilder.CreateLines("wallRepulse", {
    points: [BABYLON.Vector3.Zero(), BABYLON.Vector3.One()], updatable: true,
  }, scene);
  wallLine.color = new BABYLON.Color3(1, 0.6, 0.1);

  moto._wanderDebug = { circle, centerSphere, targetSphere, dirLine, wallLine };
  return moto._wanderDebug;
}

function updateDebugHelpers(moto, centerPoint, targetPoint, wallForce, scene) {
  const p = wanderParams;
  const h = getOrCreateDebugHelpers(moto, scene);
  const pos = moto.getAbsolutePosition();

  h.circle.setEnabled(p.debug);
  h.centerSphere.setEnabled(p.debug);
  h.targetSphere.setEnabled(p.debug);
  h.dirLine.setEnabled(p.debug);
  h.wallLine.setEnabled(p.debug);

  if (!p.debug) return;

  h.circle.position = new BABYLON.Vector3(centerPoint.x, 0.05, centerPoint.z);
  h.circle.scaling  = new BABYLON.Vector3(p.wanderRadius, 1, p.wanderRadius);
  h.centerSphere.position = new BABYLON.Vector3(centerPoint.x, 0.1, centerPoint.z);
  h.targetSphere.position = new BABYLON.Vector3(targetPoint.x, 0.1, targetPoint.z);

  BABYLON.MeshBuilder.CreateLines("wanderDir", {
    points: [new BABYLON.Vector3(pos.x, 0.1, pos.z), new BABYLON.Vector3(targetPoint.x, 0.1, targetPoint.z)],
    instance: h.dirLine,
  });

  // Ligne orange = vecteur de répulsion depuis la position du bot
  const wallEnd = new BABYLON.Vector3(pos.x + wallForce.x, 0.1, pos.z + wallForce.z);
  BABYLON.MeshBuilder.CreateLines("wallRepulse", {
    points: [new BABYLON.Vector3(pos.x, 0.1, pos.z), wallEnd],
    instance: h.wallLine,
  });
}

// ─── Calcul de la force de répulsion des murs ─────────────────────────────────
function computeWallAvoidance(pos) {
  const p = wanderParams;
  const R = p.wallAvoidRadius;
  const H = p.ARENA_HALF;
  const force = new BABYLON.Vector3(0, 0, 0);

  // Distance à chacun des 4 murs (plan XZ, murs à ±H)
  const dPosX = H - pos.x;   // mur Est  (+X)
  const dNegX = H + pos.x;   // mur Ouest (-X)
  const dPosZ = H - pos.z;   // mur Nord  (+Z)
  const dNegZ = H + pos.z;   // mur Sud   (-Z)

  // Pour chaque mur : si on est dans la zone de danger, ajouter une force
  // qui pousse vers l'intérieur, proportionnelle à la proximité
  if (dPosX < R) force.x -= p.wallAvoidWeight * p.maxForce * (1 - dPosX / R);
  if (dNegX < R) force.x += p.wallAvoidWeight * p.maxForce * (1 - dNegX / R);
  if (dPosZ < R) force.z -= p.wallAvoidWeight * p.maxForce * (1 - dPosZ / R);
  if (dNegZ < R) force.z += p.wallAvoidWeight * p.maxForce * (1 - dNegZ / R);

  return force;
}

// ─── Algorithme wander + wall avoidance ──────────────────────────────────────
export function moveBot(moto, scene) {
  if (!moto || !moto.physicsAggregate) return;
  if (moto.getAbsolutePosition().y > 0.2) return;

  const p       = wanderParams;
  const body    = moto.physicsAggregate.body;
  const pos     = moto.getAbsolutePosition();
  const forward = moto.forward;

  // ── Wander ────────────────────────────────────────────────────────────────
  const centerPoint = pos.add(forward.scale(p.distanceCercle));

  if (moto._wanderTheta === undefined) moto._wanderTheta = 0;
  const heading     = Math.atan2(forward.x, forward.z);
  const theta       = moto._wanderTheta + heading;

  const targetPoint = centerPoint.add(new BABYLON.Vector3(
    p.wanderRadius * Math.sin(theta),
    0,
    p.wanderRadius * Math.cos(theta),
  ));

  let wanderForce = targetPoint.subtract(pos);
  wanderForce.y = 0;
  wanderForce.normalize().scaleInPlace(p.maxForce);

  moto._wanderTheta += (Math.random() - 0.5) * 2 * p.displaceRange;

  // ── Wall avoidance ────────────────────────────────────────────────────────
  const wallForce = computeWallAvoidance(pos);

  // ── Force totale ──────────────────────────────────────────────────────────
  const totalForce = wanderForce.add(wallForce);
  totalForce.y = 0;

  // ── Debug helpers ─────────────────────────────────────────────────────────
  updateDebugHelpers(moto, centerPoint, targetPoint, wallForce, scene);

  // ── Application physique ──────────────────────────────────────────────────
  const velocity     = body.getLinearVelocity();
  const forwardSpeed = BABYLON.Vector3.Dot(velocity, forward);

  if (Math.abs(forwardSpeed) < p.MAX_SPEED) {
    body.applyImpulse(
      new BABYLON.Vector3(totalForce.x * p.THRUST_FORCE / p.maxForce, 0, totalForce.z * p.THRUST_FORCE / p.maxForce),
      pos,
    );
  }

  // Rotation vers la direction totale
  const totalAngle = Math.atan2(totalForce.x, totalForce.z);
  const angleDiff  = totalAngle - heading;
  const turn       = Math.max(-1, Math.min(1, angleDiff));
  moto.rotate(BABYLON.Axis.Y, turn * p.TURN_SPEED, BABYLON.Space.WORLD);
}

// ─── Nettoyage ────────────────────────────────────────────────────────────────
export function disposeWanderDebug(moto) {
  if (!moto._wanderDebug) return;
  Object.values(moto._wanderDebug).forEach(m => m.dispose());
  delete moto._wanderDebug;
}