import { inputStates } from './main.js';

function createMoto(scene, mirrorMaterial) {
    return new Promise((resolve) => {
        BABYLON.SceneLoader.ImportMesh("", "assets/models/", "lightCycleGen1.glb", scene, (meshes) => {
            let moto = meshes[0];

            moto.position = new BABYLON.Vector3(0, 5, 0); 
            moto.scaling = new BABYLON.Vector3(2, 2, 2);
            moto.name = "moto";
            moto.speed = -1;
            moto.currentSpeed = 0;

            // == Trail derriere la moto ==
            // Créer deux points pour former un mur vertical
            const trailSourceBottom = new BABYLON.TransformNode("trailSourceBottom", scene);
            trailSourceBottom.parent = moto;
            trailSourceBottom.position = new BABYLON.Vector3(0, 0, 1.5); // Point bas du mur
            
            const trailSourceTop = new BABYLON.TransformNode("trailSourceTop", scene);
            trailSourceTop.parent = moto;
            trailSourceTop.position = new BABYLON.Vector3(0, 1.3, 1.5); // Point haut du mur (5 unités de hauteur)
            

            // Créer un ribbon personnalisé pour un mur vertical
            const lightWall = new BABYLON.RibbonBuilder.CreateRibbon("lightWall", {
                pathArray: [[trailSourceBottom.position, trailSourceTop.position]],
                updatable: true,
                closeArray: false
            }, scene);
            
            // Stocker les positions pour mettre à jour le ribbon
            lightWall.trailPoints = [];
            scene.registerBeforeRender(() => {
                if (lightWall.trailPoints.length < 200) {
                    lightWall.trailPoints.push({
                        bottom: trailSourceBottom.getAbsolutePosition().clone(),
                        top: trailSourceTop.getAbsolutePosition().clone()
                    });
                } else {
                    lightWall.trailPoints.shift(); // Supprimer le point le plus ancien
                    lightWall.trailPoints.push({
                        bottom: trailSourceBottom.getAbsolutePosition().clone(),
                        top: trailSourceTop.getAbsolutePosition().clone()
                    });
                }
                
                // Reconstruire le ribbon avec les nouveaux points
                let pathArray = [];
                for (let i = 0; i < lightWall.trailPoints.length; i++) {
                    pathArray.push([lightWall.trailPoints[i].bottom, lightWall.trailPoints[i].top]);
                }
                
                if (pathArray.length > 1) {
                    lightWall.dispose();
                    const newWall = BABYLON.MeshBuilder.CreateRibbon("lightWall", {
                        pathArray: pathArray,
                        updatable: true,
                        closeArray: false,
                        sideOrientation: BABYLON.Mesh.DOUBLESIDESIDEDNESS
                    }, scene);
                    
                    // Appliquer le matériau
                    const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
                    wallMat.diffuseColor = new BABYLON.Color3(0, 0.5, 1);
                    wallMat.emissiveColor = new BABYLON.Color3(0, 0, 1);
                    wallMat.specularColor = new BABYLON.Color3(0, 1, 1);
                    wallMat.alpha = 0.9;
                    wallMat.backFaceCulling = false; // Afficher les deux côtés du mur
                    newWall.material = wallMat;
                    
                    Object.assign(lightWall, newWall);
                }
            });

            // matériau émissif bleu
            // const wallMat = new BABYLON.StandardMaterial(    "wallMat", scene);
            // wallMat.diffuseColor = new BABYLON.Color3(0, 0.5, 0.5);
            // wallMat.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
            // wallMat.specularColor = new BABYLON.Color3(0, 0, 0);
            // wallMat.alpha = 0.9;

            // lightWall.material = wallMat;



            // Setup Mirror
            mirrorMaterial.reflectionTexture.renderList.push(moto);
            if (moto.getChildMeshes) {
                moto.getChildMeshes().forEach(child => mirrorMaterial.reflectionTexture.renderList.push(child));
            }

            // Create Physics
            moto.physicsAggregate = new BABYLON.PhysicsAggregate(
                moto,
                BABYLON.PhysicsShapeType.BOX,
                { mass: 1, friction: 0.5, restitution: 0.1 },
                scene
            );

            //Physic config disable physic body to enable rotation for the moto
            moto.physicsAggregate.body.disablePreStep = false; 

            moto.physicsAggregate.body.setMassProperties({
                inertia: new BABYLON.Vector3(0, 1, 0) //gravity
            });

            moto.move = () => {
                let body = moto.physicsAggregate.body;
                
                if (inputStates.left) {
                    moto.rotate(BABYLON.Axis.Y, -0.05, BABYLON.Space.WORLD);
                }
                if (inputStates.right) {
                    moto.rotate(BABYLON.Axis.Y, 0.05, BABYLON.Space.WORLD);
                }
                let velocity = body.getLinearVelocity();
                let speedMultiplier = 50;
                let dir = moto.forward; //Get direction and rotation
                let moveX = 0;
                let moveZ = 0;

                if (inputStates.up) {
                    moveX = dir.x * moto.speed * speedMultiplier;
                    moveZ = dir.z * moto.speed * speedMultiplier;
                }
                if (inputStates.down) {
                    moveX = -dir.x * moto.speed * speedMultiplier;
                    moveZ = -dir.z * moto.speed * speedMultiplier;
                }
                //Brake
                if (!inputStates.up && !inputStates.down) {
                    moveX = velocity.x * 0.5; 
                    moveZ = velocity.z * 0.5;
                }

                //Y = gravity
                body.setLinearVelocity(new BABYLON.Vector3(moveX, velocity.y, moveZ));
            };

            // let murParameters = { width: 1, height: 5, depth: 160 };
            // const mur = new BABYLON.StandardMaterial("mur", murParameters, scene);
            // mur.position = new BABYLON.Vector3(0, 0, 80);
            // mur.material = new BABYLON.StandardMaterial("murMat", scene);
            // mur.material.diffuseColor = new BABYLON.Color3(0, 0, 0);
            // // mur.material.emissiveColor = new BABYLON.Color3(1, 0, 1);
            // mur.isVisible = true;
            
            resolve(moto);
        });
    });
}

export { createMoto };