// ─── Paramètres (modifiables depuis ton menu debug) ──────────────────────────
export const wanderParams = {
  distanceCercle:   10,
  wanderRadius:     2,
  displaceRange:    0.3,
  maxForce:         8,
  THRUST_FORCE:     10,
  MAX_SPEED:        35,
  TURN_SPEED:       0.07,
  maxSteerAngle:    Math.PI * 0.65,   // angle max de braquage par rapport au cap actuel (radians)
  // --- wall avoidance ---
  wallAvoidRadius:  25,
  wallAvoidWeight:  2.5,
  ARENA_HALF:       78,
  // --- moto avoidance ---
  motoAvoidRadius:  30,
  motoAvoidWeight:  5,
  // --- trail avoidance ---
  trailAvoidRadius: 20,
  trailAvoidWeight: 7,
  debug:            true,
};

// ─── Calcul de la force de poursuite (pursuit) ────────────────────────────────
function computePursuit(moto, pos) {
  const allMotos = [window.playerMoto, window.botMoto].filter(m => m && m !== moto);
  if (allMotos.length === 0) return new BABYLON.Vector3(0, 0, 0);

  // Trouver la cible la plus proche
  let target = null;
  let closestDist = Infinity;
  for (const other of allMotos) {
    const otherPos = other.getAbsolutePosition();
    const dist = BABYLON.Vector3.Distance(pos, otherPos);
    if (dist < closestDist) {
      closestDist = dist;
      target = other; 
    }
  }
  if (!target) return new BABYLON.Vector3(0, 0, 0);

  // Prédiction : où sera la cible dans ~3 frames ?
  const targetPos = target.getAbsolutePosition();
  const targetVel = target.physicsAggregate?.body.getLinearVelocity() || new BABYLON.Vector3(0, 0, 0);
  const predictedPos = new BABYLON.Vector3(
    targetPos.x + targetVel.x * 0.05,
    0,
    targetPos.z + targetVel.z * 0.05,
  );

  // Force vers la position prédite
  let pursueForce = predictedPos.subtract(pos);
  pursueForce.y = 0;
  if (pursueForce.length() > 0.01) {
    pursueForce.normalize().scaleInPlace(wanderParams.maxForce);
  }
  return pursueForce;
}

// ─── Calcul de la force de poursuite (pursuit) ────────────────────────────────
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

// ─── Calcul de la force de répulsion des autres motos (prédictif) ────────────
function computeMotoAvoidance(selfMoto, pos) {
  const p = wanderParams;
  const force = new BABYLON.Vector3(0, 0, 0);
  const others = [window.playerMoto, window.botMoto].filter(m => m && m !== selfMoto);

  const selfVel = selfMoto.physicsAggregate?.body.getLinearVelocity() ?? new BABYLON.Vector3(0, 0, 0);

  for (const other of others) {
    const otherPos = other.getAbsolutePosition();
    const otherVel = other.physicsAggregate?.body.getLinearVelocity() ?? new BABYLON.Vector3(0, 0, 0);

    const dx = pos.x - otherPos.x;
    const dz = pos.z - otherPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.01) continue;

    // Force actuelle (quadratique = plus forte à courte distance)
    if (dist < p.motoAvoidRadius) {
      const t = 1 - dist / p.motoAvoidRadius;
      const strength = p.motoAvoidWeight * p.maxForce * t * t;
      force.x += (dx / dist) * strength;
      force.z += (dz / dist) * strength;
    }

    // Force prédictive : position dans 1 seconde
    const T = 1.0;
    const futDx = (pos.x + selfVel.x * T) - (otherPos.x + otherVel.x * T);
    const futDz = (pos.z + selfVel.z * T) - (otherPos.z + otherVel.z * T);
    const futDist = Math.sqrt(futDx * futDx + futDz * futDz);
    if (futDist < p.motoAvoidRadius * 0.6 && futDist > 0.01) {
      const t = 1 - futDist / (p.motoAvoidRadius * 0.6);
      const strength = p.motoAvoidWeight * p.maxForce * t * 1.5;
      force.x += (futDx / futDist) * strength;
      force.z += (futDz / futDist) * strength;
    }
  }
  return force;
}

// ─── Calcul de la force de répulsion des traînées (lightWalls) ───────────────
function computeTrailAvoidance(selfMoto, pos) {
  const p = wanderParams;
  const force = new BABYLON.Vector3(0, 0, 0);
  const allMotos = [window.playerMoto, window.botMoto].filter(m => m);

  for (const moto of allMotos) {
    const pts = moto._trailPoints;
    if (!pts || pts.length < 2) continue;

    const isSelf = moto === selfMoto;
    // Pour le mur propre : ignorer les ~60 derniers points (traîne directement
    // derrière la moto) pour ne pas se repousser soi-même en permanence.
    // Pour les autres : ignorer les 20 derniers (gérés par motoAvoidance).
    const skipTail = isSelf ? 60 : 20;
    const end = Math.max(0, pts.length - skipTail);

    for (let i = 0; i < end; i += 2) {
      const tp = pts[i].bottom;
      const dx = pos.x - tp.x;
      const dz = pos.z - tp.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > p.trailAvoidRadius * p.trailAvoidRadius || distSq < 0.01) continue;

      const dist = Math.sqrt(distSq);
      const t = 1 - dist / p.trailAvoidRadius;
      const strength = p.trailAvoidWeight * p.maxForce * t * t;
      force.x += (dx / dist) * strength;
      force.z += (dz / dist) * strength;
    }
  }
  return force;
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
  const forward = moto.forward.negate();

  // ── Pursuit (chasse la cible la plus proche) ──────────────────────────────
  const pursueForce = computePursuit(moto, pos);

  // ── Wall avoidance ────────────────────────────────────────────────────────
  const wallForce = computeWallAvoidance(pos);

  // ── Moto avoidance ────────────────────────────────────────────────────────
  const motoForce = computeMotoAvoidance(moto, pos);

  // ── Trail avoidance (lightWalls) ──────────────────────────────────────────
  const trailForce = computeTrailAvoidance(moto, pos);

  // ── Force totale ──────────────────────────────────────────────────────────
  const totalForce = pursueForce.add(wallForce).add(motoForce).add(trailForce);
  totalForce.y = 0;

  // ── Debug helpers ─────────────────────────────────────────────────────────
  // (debug helpers skipped pour pursuit mode)

  // ── Application physique ──────────────────────────────────────────────────
  const velocity = body.getLinearVelocity();

  // Vélocité linéaire = toujours dans la direction forward à MAX_SPEED
  // (le bot est un agent, pas un objet physique réaliste)
  body.setLinearVelocity(new BABYLON.Vector3(
    forward.x * p.MAX_SPEED,
    velocity.y,
    forward.z * p.MAX_SPEED,
  ));

  // ── Rotation via vitesse angulaire (compatible Havok)
  const heading = Math.atan2(forward.x, forward.z);
  const totalAngle = Math.atan2(totalForce.x, totalForce.z);
  let angleDiff    = totalAngle - heading;
  while (angleDiff >  Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  // Clamp à l'angle de braquage max pour éviter les virages trop brusques
  angleDiff = Math.max(-p.maxSteerAngle, Math.min(p.maxSteerAngle, angleDiff));
  body.setAngularVelocity(new BABYLON.Vector3(0, angleDiff * p.TURN_SPEED * 30, 0));

  // ── DEBUG LOGS (toutes les 60 frames) ────────────────────────────────────
  if (!moto._dbgFrame) moto._dbgFrame = 0;
  if (++moto._dbgFrame % 60 === 0) {
    const velNow = body.getLinearVelocity();
    const angVel = body.getAngularVelocity();
    console.log('[BOT]',
      'pos=(',    pos.x.toFixed(1), pos.y.toFixed(2), pos.z.toFixed(1), ')',
      '| fwd=(',  forward.x.toFixed(2), forward.z.toFixed(2), ')',
      '| vel=',   velNow.length().toFixed(2),
      '| angDiff=', (angleDiff * 180 / Math.PI).toFixed(1) + '°',
      'angVelY=', angVel.y.toFixed(3),
    );
  }
}

// ─── Nettoyage ────────────────────────────────────────────────────────────────
export function disposeWanderDebug(moto) {
  if (!moto._wanderDebug) return;
  Object.values(moto._wanderDebug).forEach(m => m.dispose());
  delete moto._wanderDebug;
}