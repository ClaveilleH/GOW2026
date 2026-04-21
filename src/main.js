import { createMoto } from './moto.js';
import { moveBot } from './bot.js';

let canvas;
let engine;
let scene;
export let inputStates = {};
let physicsPlugin; // Declare this globally

let followCamera;
let freeCamera;
let botCamera;

let cameras; // Declare cameras array globally
let currentCameraIndex = 0;

// let debugAI = false; // Flag to toggle AI debugging
window.debugAI = false; // Make it accessible globally for HUD toggle


const GRAVITY = -9.81


window.onload = startGame;

async function startGame() {
    canvas = document.querySelector("#myCanvas");
    engine = new BABYLON.Engine(canvas, true);
    initHUD();

    //Physic plugin
    const havokInstance = await HavokPhysics();
    physicsPlugin = new BABYLON.HavokPlugin(true, havokInstance);
    scene = new BABYLON.Scene(engine);
    scene.enablePhysics(new BABYLON.Vector3(0, GRAVITY, 0), physicsPlugin);
    scene.ambientColor = new BABYLON.Color3(0, 1, 0);

    let { ground, mirrorMaterial } = createGround(scene);
    freeCamera = createFreeCamera(scene);
    let light = createLight(scene);
    let skybox = createSkyBox(scene);
    // North Wall
    createWall(0, 80, 160, 1, 0);
    // South Wall
    createWall(0, -80, 160, 1, 0);
    // East Wall (Rotated 90 degrees)
    createWall(80, 0, 160, 1, Math.PI / 2);
    // West Wall (Rotated 90 degrees)
    createWall(-80, 0, 160, 1, Math.PI / 2);

    let playerMoto = await createMoto(scene, mirrorMaterial, true);
    followCamera = createFollowCamera(scene, playerMoto);
    scene.activeCamera = followCamera;
    
    let botMoto = await createMoto(scene, mirrorMaterial, false);
    // botCamera = createBotCamera(scene, botMoto);
    botCamera = createFollowCamera(scene, botMoto);
    // createMoto(scene, mirrorMaterial, true).then(_moto => {
    //     playerMoto = _moto;
    //     followCamera = createFollowCamera(scene, _moto);
    //     scene.activeCamera = followCamera;
    // });

    // createMoto(scene, mirrorMaterial, false).then(_moto => {
    //     botMoto = _moto;
    //     botCamera = createBotCamera(scene, _moto);
    // });
    
    // createSphere(scene, mirrorMaterial);
    modifySettings();

    const music = new Audio("assets/sounds/df_dl.mp3");
    music.loop = true;
    music.volume = 0.5;

    const playMusic = () => {
        music.play().then(() => {
            console.log("music playing");
        }).catch(e => console.log("audio error:", e));
        window.removeEventListener("click", playMusic);
        window.removeEventListener("keydown", playMusic);
    };
    window.addEventListener("click", playMusic);
    window.addEventListener("keydown", playMusic);

    engine.runRenderLoop(() => {
        if (playerMoto && playerMoto.move) playerMoto.move();
        if (botMoto && botMoto.move) botMoto.move(); // move() already calls moveBot internally
        if (window.debugAI) aiDebugInfo(botMoto);
        updateHUD(playerMoto, engine.getFps());
        scene.render();
    });

    // une liste de cameras à basculer avec la touche C
    cameras = [followCamera, freeCamera, botCamera];
    // cameras = [followCamera, freeCamera]; // Temporarily exclude botCamera since it's not working well
    currentCameraIndex = 0;
}

function aiDebugInfo(botMoto) {
    if (!botMoto || !botMoto.physicsAggregate) return;
    const body = botMoto.physicsAggregate.body;
    const velocity = body.getLinearVelocity();
    // console.log("Bot Velocity:", velocity);
    // You can also add more info like position, rotation, etc.

    // Draw moto velocity vector in the scene for debugging
    const origin = botMoto.getAbsolutePosition();
    const dir = velocity.normalize().scale(5); // scale for visibility
    const debugLine = BABYLON.MeshBuilder.CreateLines("debugLine", {
        points: [origin, origin.add(dir)],
        updatable: true
    }, scene);
    debugLine.color = new BABYLON.Color3(0, 1, 0); // green color for velocity vector
    // augementer l'epaisseur de la ligne


    // Remove the debug line after a short time to avoid clutter
    setTimeout(() => {
        debugLine.dispose();
    }, 100);
}

function switchCamera() {
    // if (scene.activeCamera == followCamera) {
    //     scene.activeCamera = freeCamera;
    // } else {
    //     scene.activeCamera = followCamera;
    // }
    console.log("cameras array:", cameras);
    console.log("cameras length:", cameras.length);
    currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
    console.log("Switching to camera index:", currentCameraIndex);

    if (!cameras[currentCameraIndex]) {
        console.warn("Camera undefined, skipping...");
        return;
    }
    
    scene.activeCamera = cameras[currentCameraIndex];
    console.log("Active camera is now:", cameras[currentCameraIndex].name);
    // scene.activeCamera = followCamera; // Force followCamera for now, since botCamera is not working well
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

    camera.radius = 30; // how far from the object to follow
	camera.heightOffset = 10; // how high above the object to place the camera
	camera.rotationOffset = 0; // the viewing angle
	camera.cameraAcceleration = .1; // how fast to move
	camera.maxCameraSpeed = 5; // speed limit

    return camera;
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
    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0, restitution: 0}, scene); //Collision for the "ground"
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

function createSkyBox(scene) {
    let skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size:800.0}, scene);
    let skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(
        "assets/textures/", 
        scene, 
        ["_px.png", "_nx.png", "_py.png", "_ny.png", "_pz.png", "_nz.png"]
    );
    skybox.rotation.z = Math.PI / 2;
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.disableLighting = true; 
    skybox.material = skyboxMaterial;

    return skybox

}

function createWall(x, z, width, depth, rotation) {
    const wall = BABYLON.MeshBuilder.CreateBox("wall", {
        width: width,
        height: 10,
        depth: depth
    }, scene);

    wall.position = new BABYLON.Vector3(x, 5, z);
    wall.name = "wall";
    wall.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, rotation);

    const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
    const wallTex = new BABYLON.Texture("assets/textures/circuit.jpg", scene);
    wallTex.uScale = width / 20;  // repeat texture along the wall length
    wallTex.vScale = 1;
    wallMat.diffuseTexture = wallTex;
    wallMat.emissiveTexture = wallTex; // makes it glow without needing light
    wallMat.backFaceCulling = false;
    wall.material = wallMat;

    const wallAggregate = new BABYLON.PhysicsAggregate(
        wall,
        BABYLON.PhysicsShapeType.BOX,
        { mass: 0, friction: 0.5 },
        scene
    );
    wallAggregate.body.setCollisionCallbackEnabled(true);
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