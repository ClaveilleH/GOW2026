let canvas;
let engine;
let scene;
let inputStates = {};
let physicsPlugin; // Declare this globally

let followCamera;
let freeCamera;

window.onload = startGame;

async function startGame() {
    canvas = document.querySelector("#myCanvas");
    engine = new BABYLON.Engine(canvas, true);

    //Physic plugin
    const havokInstance = await HavokPhysics();
    physicsPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    scene = new BABYLON.Scene(engine);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), physicsPlugin);
    scene.ambientColor = new BABYLON.Color3(0, 1, 0);
    let { ground, mirrorMaterial } = createGround(scene);
    freeCamera = createFreeCamera(scene);
    let light = createLight(scene);

    createMoto(scene, mirrorMaterial).then(_moto => {
        followCamera = createFollowCamera(scene, _moto);
        scene.activeCamera = followCamera;
    });
    createSphere(scene, mirrorMaterial);
    modifySettings();

    engine.runRenderLoop(() => {
        let moto = scene.getMeshByName("moto");
        if (moto && moto.move) moto.move();
        scene.render();
    });
}

function createScene() {
    scene = new BABYLON.Scene(engine);
    // ambiant color of the scene = green (like a green sun!)
    scene.ambiantColor = new BABYLON.Color3(0, 1, 0);
    let ground, mirrorMaterial = createGround(scene);
    freeCamera = createFreeCamera(scene);
    let light = createLight(scene);
    scene.collisionsEnabled = true; //Collision on scene

    let moto;
    createMoto(scene, mirrorMaterial).then(_moto => {
        moto = _moto;
        followCamera = createFollowCamera(scene, moto);
        scene.activeCamera = followCamera;
    });
    
    // scene.activeCamera = camera;
    createSphere(scene, mirrorMaterial);


    return scene;

}

function switchCamera(newCamera) {
    if (scene.activeCamera == followCamera) {
        scene.activeCamera = freeCamera;
    } else {
        scene.activeCamera = followCamera;
    }
}

function createFreeCamera(scene) {
    
    let camera = new BABYLON.FreeCamera("myCamera", new BABYLON.Vector3(0, 1, -30), scene);
    // This targets the camera to scene origin
    //camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas);
    return camera;
}

function createFollowCamera(scene, target) {
    let camera = new BABYLON.FollowCamera("motoFollowCamera", target.position, scene, target);

    camera.radius = 40; // how far from the object to follow
	camera.heightOffset = 10; // how high above the object to place the camera
	camera.rotationOffset = 0; // the viewing angle
	camera.cameraAcceleration = .1; // how fast to move
	camera.maxCameraSpeed = 5; // speed limit

    return camera;
}

function createMoto(scene, mirrorMaterial) {
    return new Promise((resolve) => {
        BABYLON.SceneLoader.ImportMesh("", "assets/models/", "lightCycleGen1.glb", scene, (meshes) => {
            let moto = meshes[0];

            moto.position = new BABYLON.Vector3(0, 5, 0); 
            moto.scaling = new BABYLON.Vector3(2, 2, 2);
            moto.name = "moto";
            moto.speed = -1;

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

            resolve(moto);
        });
    });
}

function createGround(scene) {
    const groundOptions = { width: 160, height: 5, depth: 160 };
    let ground = BABYLON.MeshBuilder.CreateBox("myGround", groundOptions, scene); //Create a box instead of ground to allow good collision
    ground.position.y = -2.5;
    let mirrorMaterial = new BABYLON.StandardMaterial("mirrorMaterial", scene);
    // mirrorMaterial.ambientColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    // mirrorMaterial.
    mirrorMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1);
    mirrorMaterial.emissiveColor = new BABYLON.Color3(0, 0, 1);
    // no reflection on the ground, specular color = black...
    mirrorMaterial.specularColor = new BABYLON.Color3.Black;

    // 1024 = size of the dynamically generated mirror texture
    // mirrorMaterial.reflectionTexture = new BABYLON.MirrorTexture("mirror", 1024, scene, true);
    mirrorMaterial.reflectionTexture = new BABYLON.MirrorTexture("mirror", 2048, scene, true);
    // Plane ax + by +cz + d = 0
    // first 3 params = normal vector to the plane + offset from the origin
    // try to change last parameter to say -10, or try to set first one to say 0.5
    mirrorMaterial.reflectionTexture.mirrorPlane = new BABYLON.Plane(0, -0.1, 0, -0.0);
    // "strength / opacity of the reflection"
    mirrorMaterial.reflectionTexture.level = 0.5; // between 0 and 1
    
    mirrorMaterial.diffuseTexture = new BABYLON.Texture("assets/textures/TRON_TileX1v2.png", scene);
    // calcule automatiquement le nombre de répétitions nécessaires pour couvrir la surface en gardant les proportions
    mirrorMaterial.diffuseTexture.uScale = 20.0;
    mirrorMaterial.diffuseTexture.vScale = 20.0;
    
    ground.material = mirrorMaterial;
    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene); //Collision for the "ground"
    return {ground, mirrorMaterial};
}

function createLight(scene) {
    var light = new BABYLON.HemisphericLight("myHemiLight", new BABYLON.Vector3(0, 3, 0), scene);
    light.intensity = 0.3;
    // light.diffuse = new BABYLON.Color3(1, 1, 1);
    // light.specular = new BABYLON.Color3(1, 1, 1);
    // light.groundColor = new BABYLON.Color3(1, 1, 1);
    return light;
}



function createSphere(scene, mirrorMaterial) {
    let spheres = [];
    let sphereMaterials = [];

    for (let i = 0; i < 10; i++) {
        spheres[i] = BABYLON.MeshBuilder.CreateSphere("mySphere" + i, { diameter: 2, segments: 32 }, scene);
        spheres[i].position.x += 3 * i - 9;
        spheres[i].position.y = 2;

        sphereMaterials[i] = new BABYLON.StandardMaterial("sphereMaterial" + i, scene);
        spheres[i].material = sphereMaterials[i];

        mirrorMaterial.reflectionTexture.renderList.push(spheres[i]);
    }

    sphereMaterials[0].ambiantColor = new BABYLON.Color3(0, 0.5, 0);
    sphereMaterials[0].diffuseColor = new BABYLON.Color3(5, 0, 0);
    sphereMaterials[0].specularColor = new BABYLON.Color3(0, 0, 0);

    sphereMaterials[1].ambiantColor = new BABYLON.Color3(0, 0.5, 0);
    sphereMaterials[1].diffuseColor = new BABYLON.Color3(5, 0, 1);
    sphereMaterials[1].specularColor = new BABYLON.Color3(0, 0, 3);
    // concentration of specular reflection, higher = smaller reflection spot
    sphereMaterials[1].specularPower = 32;

    sphereMaterials[2].ambiantColor = new BABYLON.Color3(0, 0.5, 0);
    sphereMaterials[2].diffuseColor = new BABYLON.Color3(0, 0, 0);
    // as if the sphere was illuminated from inside
    sphereMaterials[2].emissiveColor = new BABYLON.Color3(0, 0, 1);

    // sphereMaterials[3].diffuseTexture = new BABYLON.Texture("images/lightning.jpg", scene);
    // // as if the sphere was illuminated from inside in Green
    // sphereMaterials[3].emissiveColor = new BABYLON.Color3.Green
    // sphereMaterials[4].diffuseTexture = new BABYLON.Texture("images/lightning.jpg", scene);
    // sphereMaterials[4].emissiveColor = new BABYLON.Color3.Yellow
    // sphereMaterials[5].diffuseTexture = new BABYLON.Texture("images/lightning.jpg", scene);
    // sphereMaterials[5].emissiveColor = new BABYLON.Color3.Red;
    // sphereMaterials[5].diffuseTexture.uScale *= 4;
    sphereMaterials[6].ambientColor = new BABYLON.Color3(0, .8, 0);
    sphereMaterials[6].diffuseColor = new BABYLON.Color3(1, 0, 0);
    // alpha property means "alpha channel" = transparency
    sphereMaterials[6].alpha = 0.2;

    // sphereMaterials[7].diffuseTexture = new BABYLON.Texture("images/coins.png", scene);
    // With .png textures that have some transparent pixels, we can
    // have the texture "see through" if we set the hasAlpha property to true
    // sphereMaterials[7].diffuseTexture.hasAlpha = true;
    sphereMaterials[7].emissiveColor = new BABYLON.Color3.Red;

    // sphereMaterials[8].ambientColor = new BABYLON.Color3(0, .3, 0);
    // sphereMaterials[8].bumpTexture = new BABYLON.Texture("images/normal_map.jpg", scene);
    // sphereMaterials[8].bumpTexture.level = 15.0;
    // sphereMaterials[9].diffuseTexture = new BABYLON.VideoTexture("video", ["videos/michel.mp4"],scene);
    // sphereMaterials[9].diffuseTexture.vScale *= -1;
    let cylinder = BABYLON.MeshBuilder.CreateCylinder("myCylinder", { diameterTop: 3, diameterBottom: 3, height: 5, tessellation: 32 }, scene);
    cylinder.position = new BABYLON.Vector3(10, 2.5, 0);
    let cylinderMaterial = new BABYLON.StandardMaterial("cylinderMaterial", scene);
    cylinder.material = cylinderMaterial;
    mirrorMaterial.reflectionTexture.renderList.push(cylinder);
    cylinderMaterial.alpha = 0.5;
    cylinderMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    cylinderMaterial.emissiveColor = new BABYLON.Color3(1, 0, 1);




    let counter = 0;

    scene.registerBeforeRender(() => {
        for (let i = 0; i < spheres.length; i++) {
            spheres[i].position.z = 2 * i + Math.sin((i * counter) / 2);
            counter += 0.005;

            //sphereMaterials[i].wireframe = true
        }

        // sphereMaterials[4].diffuseTexture.uOffset += 0.005;
        // sphereMaterials[5].diffuseTexture.uScale += 0.03;
        cylinder.rotation.x += 0.01;
    });
}

function modifySettings() {
    // as soon as we click on the game window, the mouse pointer is "locked"
    // you will have to press ESC to unlock it
    scene.onPointerDown = () => {
        if(!scene.alreadyLocked) {
            console.log("requesting pointer lock");
            canvas.requestPointerLock();
        } else {
            console.log("Pointer already locked");
        }
    }

    document.addEventListener("pointerlockchange", () => {
        let element = document.pointerLockElement || null;
        if(element) {
            // lets create a custom attribute
            scene.alreadyLocked = true;
        } else {
            scene.alreadyLocked = false;
        }
    })

    // key listeners for the tank
    inputStates.left = false;
    inputStates.right = false;
    inputStates.up = false;
    inputStates.down = false;
    inputStates.space = false;
    
    //add the listener to the main, window object, and update the states
    window.addEventListener('keydown', (event) => {
        if ((event.key === "q")|| (event.key === "Q")) {
           inputStates.left = true;
           console.log("left key pressed");
        } else if ((event.key === "z")|| (event.key === "Z")){
           inputStates.up = true;
        } else if ((event.key === "d")|| (event.key === "D")){
           inputStates.right = true;
        } else if ((event.key === "s")|| (event.key === "S")) {
           inputStates.down = true;
        }  else if (event.key === " ") {
           inputStates.space = true;
        }  else if (event.key === "c" || (event.key === "C")) {
           switchCamera();
        }
    }, false);

    //if the key will be released, change the states object 
    window.addEventListener('keyup', (event) => {
        if ((event.key === "q")|| (event.key === "Q")) {
           inputStates.left = false;
        } else if ((event.key === "z")|| (event.key === "Z")){
           inputStates.up = false;
        } else if ((event.key === "d")|| (event.key === "D")){
           inputStates.right = false;
        } else if ((event.key === "s")|| (event.key === "S")) {
           inputStates.down = false;
        }  else if (event.key === " ") {
           inputStates.space = false;
        }
    }, false);
}



window.addEventListener("resize", () => {
    engine.resize()
})