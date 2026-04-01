export function moveBot(moto) {
    if (!moto || !moto.physicsAggregate) return;
    if (moto.getAbsolutePosition().y > 0.2) return; // no air movement

    const body = moto.physicsAggregate.body;
    const dir  = moto.forward;
    const pos  = moto.getAbsolutePosition();

    const THRUST_FORCE = 10;
    const MAX_SPEED    = 20;
    const TURN_SPEED   = 0.07;

    if (!moto._botTimer) moto._botTimer = 0;
    moto._botTimer++;

    if (moto._botTimer > 10) {
        moto._botTurn = (Math.random() - 0.25) * 2;
        moto._botTimer = 0;
    }

    if (moto._botTurn) {
        moto.rotate(BABYLON.Axis.Y, moto._botTurn * TURN_SPEED, BABYLON.Space.WORLD);
    }

    const velocity     = body.getLinearVelocity();
    const forwardSpeed = BABYLON.Vector3.Dot(velocity, dir);
    if (Math.abs(forwardSpeed) < MAX_SPEED) {
        body.applyImpulse(
            new BABYLON.Vector3(-dir.x * THRUST_FORCE, 0, -dir.z * THRUST_FORCE),
            pos
        );
    }
}