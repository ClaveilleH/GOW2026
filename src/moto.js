import { inputStates } from './main.js';
import { moveBot } from './bot.js';

function setMotoPosition(moto, x, y, z) {
    const newPos = new BABYLON.Vector3(x, y, z);
    moto.position = newPos;
    moto.physicsAggregate.body.setTargetTransform(newPos, moto.rotationQuaternion);
}

function setMotoRotation(moto, angle) {
    const rotQuat = BABYLON.Quaternion.FromEulerAngles(0, angle, 0);
    moto.rotationQuaternion = rotQuat;
    moto.physicsAggregate.body.setTargetTransform(moto.position, rotQuat);
}

function resetMoto(moto) {
    // Reset velocity and angular velocity
    if (moto.physicsAggregate && moto.physicsAggregate.body) {
        moto.physicsAggregate.body.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
        moto.physicsAggregate.body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
    }
    
    if(moto.name === "moto_player") {
        setMotoPosition(moto, 50, 3.0, 0);
        setMotoRotation(moto, Math.PI * 0.5);
    }else {
        setMotoPosition(moto, 0, 5, 0);
        setMotoRotation(moto, 0);
    }
}

export { resetMoto };

function createMoto(scene, mirrorMaterial, player = true) {
    return new Promise((resolve) => {
        BABYLON.SceneLoader.ImportMesh("", "assets/models/", "lightCycleGen1.glb", scene, (meshes) => {
            let moto = meshes[0];
            moto.position = new BABYLON.Vector3(0, 5, 0);
            moto.scaling = new BABYLON.Vector3(2, 2, 2);
            moto.name = player ? "moto_player" : "moto_bot"; // unique names


            const trailSourceBottom = new BABYLON.TransformNode("trailSourceBottom", scene);
            trailSourceBottom.parent = moto;
            trailSourceBottom.position = new BABYLON.Vector3(0.0, 0, 1.5);

            const trailSourceTop = new BABYLON.TransformNode("trailSourceTop", scene);
            trailSourceTop.parent = moto;
            trailSourceTop.position = new BABYLON.Vector3(0.0, 1.3, 1.5);


            const wallMat = new BABYLON.StandardMaterial("wallMat", scene);

            // Create wall material ONCE — not every frame
            if (moto.name === "moto_player") {
                wallMat.diffuseColor  = new BABYLON.Color3(0, 0.5, 1);
                wallMat.emissiveColor = new BABYLON.Color3(0, 0, 1);   // blue glow
                wallMat.specularColor = new BABYLON.Color3(0, 1, 1);
            } else {
                wallMat.diffuseColor  = new BABYLON.Color3(1, 0, 0);
                wallMat.emissiveColor = new BABYLON.Color3(1, 0, 0);   // red glow
                wallMat.specularColor = new BABYLON.Color3(1, 0, 0);
            }
            wallMat.alpha = 0.9;
            wallMat.backFaceCulling = false;

            let trailPoints = [];
            moto._trailPoints = trailPoints; // expose for bot avoidance (same array reference)
            let currentWall = null;
            let trailActive = true; // flag to pause trail on reset

            scene.registerBeforeRender(() => {
                if (!trailActive) return; // pause recording during reset

                if (trailPoints.length >= 200) trailPoints.shift();
                trailPoints.push({
                    bottom: trailSourceBottom.getAbsolutePosition().clone(),
                    top:    trailSourceTop.getAbsolutePosition().clone()
                });

                if (trailPoints.length > 1) {
                    const pathArray = trailPoints.map(p => [p.bottom, p.top]);
                    if (currentWall) currentWall.dispose();
                    currentWall = BABYLON.MeshBuilder.CreateRibbon("lightWall", {
                        pathArray,
                        updatable: false,
                        closeArray: false,
                        sideOrientation: BABYLON.Mesh.DOUBLESIDE
                    }, scene);
                    currentWall.material = wallMat;

                    // Enable physics on the ribbon so collisions are detected
                    new BABYLON.PhysicsAggregate(
                        currentWall,
                        BABYLON.PhysicsShapeType.MESH,
                        { mass: 0 },
                        scene
                    );
                }
            });

            // Mirror
            mirrorMaterial.reflectionTexture.renderList.push(moto);
            if (moto.getChildMeshes) {
                moto.getChildMeshes().forEach(child =>
                    mirrorMaterial.reflectionTexture.renderList.push(child)
                );
            }

            // Physics
            moto.physicsAggregate = new BABYLON.PhysicsAggregate(
                moto,
                BABYLON.PhysicsShapeType.BOX,
                { mass: 1, friction: 0.5, restitution: 0.0 },
                scene
            );

            const body = moto.physicsAggregate.body;
            body.disablePreStep = false;
            body.setMassProperties({
                inertia: new BABYLON.Vector3(0, 1, 0)
            });

            // Constant of the movement
            const THRUST_FORCE = 20;    // impulse magnitude per frame
            const MAX_SPEED    = 50;    // hard horizontal cap (units/s)
            const DRAG_FACTOR  = 0.88;  // velocity multiplier when coasting
            const TURN_SPEED   = 0.05;  // radians per frame
    

            moto.move = () => {
                if (moto.getAbsolutePosition().y < 0.5) {
                    const velocity = body.getLinearVelocity();
                    const dir      = moto.forward;
                    const pos      = moto.getAbsolutePosition();

                    let isThrusting = false; // declare OUTSIDE both branches

                    if (moto.name === "moto_player") {
                        if (inputStates.left)  moto.rotate(BABYLON.Axis.Y, -TURN_SPEED, BABYLON.Space.WORLD);
                        if (inputStates.right) moto.rotate(BABYLON.Axis.Y,  TURN_SPEED, BABYLON.Space.WORLD);

                        isThrusting = inputStates.up || inputStates.down;

                        if (inputStates.up) {
                            const forwardSpeed = BABYLON.Vector3.Dot(velocity, dir);
                            if (Math.abs(forwardSpeed) < MAX_SPEED) {
                                body.applyImpulse(
                                    new BABYLON.Vector3(-dir.x * THRUST_FORCE, 0, -dir.z * THRUST_FORCE),
                                    pos
                                );
                            }
                        }
                        if (inputStates.down) {
                            const forwardSpeed = BABYLON.Vector3.Dot(velocity, dir);
                            if (Math.abs(forwardSpeed) < MAX_SPEED) {
                                body.applyImpulse(
                                    new BABYLON.Vector3(dir.x * THRUST_FORCE, 0, dir.z * THRUST_FORCE),
                                    pos
                                );
                            }
                        }
                    } else {
                        isThrusting = true; // bot is always thrusting
                        moveBot(moto);
                    }

                    if (!isThrusting) {
                        body.setLinearVelocity(new BABYLON.Vector3(
                            velocity.x * DRAG_FACTOR,
                            velocity.y,
                            velocity.z * DRAG_FACTOR
                        ));
                    }

                    const vAfter = body.getLinearVelocity();
                    const hSpeed = Math.sqrt(vAfter.x ** 2 + vAfter.z ** 2);
                    if (hSpeed > MAX_SPEED) {
                        const scale = MAX_SPEED / hSpeed;
                        body.setLinearVelocity(new BABYLON.Vector3(
                            vAfter.x * scale,
                            vAfter.y,
                            vAfter.z * scale
                        ));
                    }
                }
            }

            moto.resetTrail = () => {
                trailActive = false;
                trailPoints.length = 0; // mutate in place to keep _trailPoints reference valid
                if (currentWall) {
                    currentWall.dispose();
                    currentWall = null;
                }
                setTimeout(() => {
                    trailPoints.length = 0;
                    trailActive = true;
                }, 500);
            };

            // Collision
            body.setCollisionCallbackEnabled(true);
            body.getCollisionObservable().add((collisionEvent) => {
                // Skip collision if godMode is enabled
                if (window.godMode) return;

                const hitName = collisionEvent.collidedAgainst?.transformNode?.name ?? "unknown";
                if (hitName === "wall") {
                    body.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));

                    // Reset own trail
                    moto.resetTrail();
                    resetMoto(moto);
                }

                // If moto hits the OTHER moto's ribbon (lightWall)
                if (hitName === "lightWall") {
                    body.setLinearVelocity(new BABYLON.Vector3(0, 0, 0));
                    moto.resetTrail();
                    resetMoto(moto);

                    // Reset the other moto's trail too
                    const otherName = moto.name === "moto_player" ? "moto_bot" : "moto_player";
                    const otherMoto = scene.getTransformNodeByName(otherName);
                    if (otherMoto && otherMoto.resetTrail) otherMoto.resetTrail();
                }
            });
            resetMoto(moto);
            console.log(player)
            resolve(moto);
        });
    });
}

export { createMoto };