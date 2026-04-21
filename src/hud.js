import { wanderParams } from './bot.js';
import { resetMoto } from './moto.js';

let hudDiv;
let metricsCanvas, metricsCtx;
let speedHistory = [];
let fpsHistory = [];

let showGraph = false;
let showWanderParams = false;

const MAX_POINTS = 200;

function initHUD() {
    hudDiv = document.getElementById("hud");
    metricsCanvas = document.getElementById("metricsCanvas");
    metricsCtx = metricsCanvas.getContext("2d");

    const menuBtn = document.getElementById("menuToggleBtn");
    const menuPanel = document.getElementById("menuPanel");
    const graphBtn = document.getElementById("toggleGraphBtn");

    // Toggle menu
    menuBtn.addEventListener("click", () => {
        const isVisible = menuPanel.style.display === "flex";
        menuPanel.style.display = isVisible ? "none" : "flex";
    });

    // Toggle graph
    graphBtn.addEventListener("click", () => {
        showGraph = !showGraph;
        metricsCanvas.style.display = showGraph ? "block" : "none";
        graphBtn.textContent = showGraph ? "Cacher Graph" : "Afficher Graph";
    });

    // Toggle debug AI
    const debugBtn = document.getElementById("debugAi");
    debugBtn.addEventListener("click", () => {
        window.debugAI = !window.debugAI;
        debugBtn.textContent = window.debugAI ? "Cacher Debug AI" : "Afficher Debug AI";
    });

    // Toggle godMode
    const godModeBtn = document.getElementById("godModeBtn");
    godModeBtn.addEventListener("click", () => {
        window.godMode = !window.godMode;
        godModeBtn.textContent = window.godMode ? "Désactiver Godmod" : "Activer Godmod";
    });

    // Toggle wander params menu
    const wanderBtn = document.getElementById("wanderParamsBtn");
    const wanderPanel = document.getElementById("wanderParamsPanel");
    if (wanderBtn && wanderPanel) {
        wanderBtn.addEventListener("click", () => {
            showWanderParams = !showWanderParams;
            wanderPanel.style.display = showWanderParams ? "flex" : "none";
            wanderBtn.textContent = showWanderParams ? "Cacher Wander" : "Wander Params";
        });
        wanderPanel.style.display = "none";
    }

    // Initialize wander params controls
    initWanderControls();

    // Respawn button
    const respawnBtn = document.getElementById("respawnBtn");
    if (respawnBtn) {
        respawnBtn.addEventListener("click", () => {
            if (window.playerMoto) resetMoto(window.playerMoto);
            if (window.botMoto) resetMoto(window.botMoto);
            console.log("Respawn activated");
        });
    }

    // caché au départ
    metricsCanvas.style.display = "none";
}

function initWanderControls() {
    const params = ['distanceCercle', 'wanderRadius', 'displaceRange', 'maxForce', 'THRUST_FORCE', 'MAX_SPEED', 'TURN_SPEED'];
    
    params.forEach(param => {
        const inputId = `wander_${param}`;
        const input = document.getElementById(inputId);
        if (!input) return;

        input.value = wanderParams[param];
        input.addEventListener("change", (e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                wanderParams[param] = value;
                document.getElementById(`${inputId}_label`).textContent = `${param}: ${value.toFixed(2)}`;
            }
        });
        input.addEventListener("input", (e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                document.getElementById(`${inputId}_label`).textContent = `${param}: ${value.toFixed(2)}`;
            }
        });
    });

    // Toggle debug visualization
    const debugCheckbox = document.getElementById("wander_debug");
    if (debugCheckbox) {
        debugCheckbox.checked = wanderParams.debug;
        debugCheckbox.addEventListener("change", (e) => {
            wanderParams.debug = e.target.checked;
        });
    }
}

document.addEventListener("click", (e) => {
    const menu = document.getElementById("menuContainer");
    if (!menu.contains(e.target)) {
        const menuPanel = document.getElementById("menuPanel");
        const wanderPanel = document.getElementById("wanderParamsPanel");
        if (menuPanel) menuPanel.style.display = "none";
        if (wanderPanel) wanderPanel.style.display = "none";
        showWanderParams = false;
    }
});

function updateHUD(moto, fps) {
    let speed = 0;
    if (moto && moto.move) {
        let body = moto.physicsAggregate?.body;
        if (body) {
            let vel = body.getLinearVelocity();
            speed = Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z);
        }
    }

    // HUD texte
    if (hudDiv) {
        hudDiv.innerHTML =
            "Vitesse: <span style='color: #00ffff'>" + speed.toFixed(1) + " u/s</span> | " +
            "FPS: <span style='color: #00ff00'>" + fps.toFixed(0) + "</span>";
    }

    // Historique
    speedHistory.push(speed);
    fpsHistory.push(fps);

    if (speedHistory.length > MAX_POINTS) speedHistory.shift();
    if (fpsHistory.length > MAX_POINTS) fpsHistory.shift();

    // draw seulement si activé
    if (showGraph) {
        drawMetricsGraph();
    }
}

function drawMetricsGraph() {
    if (!metricsCtx) return;

    const w = metricsCanvas.width;
    const h = metricsCanvas.height;

    metricsCtx.clearRect(0, 0, w, h);

    // axes
    metricsCtx.strokeStyle = "#444";
    metricsCtx.lineWidth = 1;
    metricsCtx.beginPath();
    metricsCtx.moveTo(0, h/2);
    metricsCtx.lineTo(w, h/2);
    metricsCtx.stroke();

    // normalisation
    const maxSpeed = Math.max(1, ...speedHistory);
    const maxFps   = Math.max(1, ...fpsHistory);

    const len = speedHistory.length;
    if (len < 2) return;

    const dx = w / (MAX_POINTS - 1);

    // courbe vitesse (cyan)
    metricsCtx.strokeStyle = "#00ffff";
    metricsCtx.beginPath();
    for (let i = 0; i < len; i++) {
        const x = i * dx;
        const y = h - (speedHistory[i] / maxSpeed) * (h - 10) - 5;
        if (i === 0) metricsCtx.moveTo(x, y);
        else metricsCtx.lineTo(x, y);
    }
    metricsCtx.stroke();

    // courbe FPS (vert)
    metricsCtx.strokeStyle = "#00ff00";
    metricsCtx.beginPath();
    for (let i = 0; i < len; i++) {
        const x = i * dx;
        const y = h - (fpsHistory[i] / maxFps) * (h - 10) - 5;
        if (i === 0) metricsCtx.moveTo(x, y);
        else metricsCtx.lineTo(x, y);
    }
    metricsCtx.stroke();
}

export { initHUD, updateHUD };
