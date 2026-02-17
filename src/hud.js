let hudDiv;
let metricsCanvas, metricsCtx;
let speedHistory = [];
let fpsHistory = [];

const MAX_POINTS = 200;


function initHUD() {
    hudDiv = document.getElementById("hud");
    metricsCanvas = document.getElementById("metricsCanvas");
    metricsCtx = metricsCanvas.getContext("2d");
}


function updateHUD(moto, fps) {

        let speed = 0;
        if (moto && moto.move) {

            let body = moto.physicsAggregate?.body;
            if (body) {
                let vel = body.getLinearVelocity();
                speed = Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z);
            }
        }
        // let fps = engine.getFps();

        // HUD texte
        if (hudDiv) {
            hudDiv.innerHTML =
                "Vitesse: <span style='color: #00ffff'>" + speed.toFixed(1) + " u/s</span> | " +
                "FPS: <span style='color: #00ff00'>" + fps.toFixed(0) + "</span>";
        }

        // Historiques
        speedHistory.push(speed);
        fpsHistory.push(fps);
        if (speedHistory.length > MAX_POINTS) speedHistory.shift();
        if (fpsHistory.length > MAX_POINTS) fpsHistory.shift();

        drawMetricsGraph();
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
