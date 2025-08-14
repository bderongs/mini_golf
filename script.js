document.addEventListener('DOMContentLoaded', () => {
    // --- Canvas and 2D Context ---
    const canvas = document.getElementById('course-canvas');
    const ctx = canvas.getContext('2d');

    // --- DOM References (for UI outside the canvas) ---
    const strokeCountElement = document.getElementById('stroke-count');
    const holeNumberElement = document.getElementById('hole-number');
    const holeParElement = document.getElementById('hole-par');
    const messageAreaElement = document.getElementById('message-area');
    const totalParElement = document.getElementById('total-par');
    const totalStrokesElement = document.getElementById('total-strokes');
    const putterBtn = document.getElementById('putter-btn');
    const wedgeBtn = document.getElementById('wedge-btn');
    const versionDisplayElement = document.getElementById('version-display');
    const terrainDebugDisplay = document.getElementById('terrain-debug-display');
    const levelSelectionScreen = document.getElementById('level-selection-screen');
    const gameUI = document.getElementById('game-ui');
    const levelList = document.getElementById('level-list');
    const playAllBtn = document.getElementById('play-all-btn');

    // Display version
    versionDisplayElement.textContent = `Version: ${new Date().toISOString()}`;

    // --- Game State ---
    let selectedClub = 'putter';
    let gameMode = 'campaign';
    let holeData = [];
    let currentHoleIndex = 0;
    let currentCourse = null;
    let strokes = 0;
    let totalStrokes = 0;
    let totalPar = 0;
    let ballPos = { x: 50, y: 50, z: 0 };
    let ballVel = { x: 0, y: 0, z: 0 };
    let holePos = { x: 650, y: 225 };
    let isAiming = false;
    let isMoving = false;
    let aimStartPos = { x: 0, y: 0 };
    let aimEndPos = { x: 0, y: 0 };
    let animationFrameId = null;
    let renderableObstacles = [];
    let allPhysicsShapes = [];

    // --- Game Constants ---
    const NORMAL_FRICTION = 0.985;
    const SAND_FRICTION = 0.88;
    const ROUGH_FRICTION = 0.95;
    const MIN_VELOCITY = 0.08;
    const MAX_POWER = 18;
    const POWER_SENSITIVITY = 12;
    const WATER_PENALTY = 1;
    const OUT_OF_BOUNDS_PENALTY = 1;
    const GRAVITY = 0.2;
    const HOLE_RADIUS = 16;
    const BALL_RADIUS = 10;
    const NUM_LEVELS = 1;

    const terrainColors = {
        fairway: '#4caf50',
        sand: '#F4A460',
        water: '#1E90FF',
        rough: '#006400',
        green: '#90EE90'
    };

    // --- Screen Management ---
    function showLevelSelection() {
        levelSelectionScreen.style.display = 'block';
        gameUI.style.display = 'none';
        levelList.innerHTML = '';

        holeData.forEach((hole, index) => {
            const levelBtn = document.createElement('button');
            levelBtn.textContent = `Level ${index + 1}`;
            levelBtn.classList.add('level-btn');
            levelBtn.addEventListener('click', () => {
                gameMode = 'free-play';
                startGame(index);
            });
            levelList.appendChild(levelBtn);
        });
    }

    function showGameUI() {
        levelSelectionScreen.style.display = 'none';
        gameUI.style.display = 'block';
    }

    function startGame(levelIndex) {
        showGameUI();
        setupHole(levelIndex);
    }

    playAllBtn.addEventListener('click', () => {
        gameMode = 'campaign';
        startGame(0);
    });

    // --- Course Loading ---
    async function loadCourseData(levelIndex) {
        try {
            const response = await fetch(`courses/course${levelIndex + 1}.json`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Could not load course ${levelIndex + 1}:`, error);
            return null;
        }
    }

    async function loadAllCourses() {
        const coursePromises = Array.from({ length: NUM_LEVELS }, (_, i) => loadCourseData(i));
        const results = await Promise.all(coursePromises);
        holeData = results.filter(data => data !== null);
    }

    // --- Game Logic ---
    function setupHole(holeIndex) {
        if (holeIndex >= holeData.length) {
            gameOver();
            return;
        }
        currentHoleIndex = holeIndex;
        currentCourse = holeData[holeIndex];

        strokes = 0;
        isMoving = false;
        ballVel = { x: 0, y: 0, z: 0 };

        ballPos = {
            x: currentCourse.start.x / 100 * canvas.width,
            y: currentCourse.start.y / 100 * canvas.height,
            z: 0
        };
        holePos = {
            x: currentCourse.hole.x / 100 * canvas.width,
            y: currentCourse.hole.y / 100 * canvas.height
        };

        renderableObstacles = [];
        allPhysicsShapes = [];
        currentCourse.obstacles.forEach(obs => {
            const shapes = Array.isArray(obs.shape) ? obs.shape : [obs.shape];

            shapes.forEach(shape => {
                const visualShape = { ...shape, terrainType: obs.type };
                if (visualShape.type === 'rect') {
                    visualShape.x = shape.x / 100 * canvas.width;
                    visualShape.y = shape.y / 100 * canvas.height;
                    visualShape.width = shape.width / 100 * canvas.width;
                    visualShape.height = shape.height / 100 * canvas.height;
                } else if (visualShape.type === 'circle') {
                    visualShape.cx = shape.cx / 100 * canvas.width;
                    visualShape.cy = shape.cy / 100 * canvas.height;
                    visualShape.radius = shape.radius / 100 * Math.min(canvas.width, canvas.height);
                } else if (visualShape.type === 'oval') {
                    visualShape.cx = shape.cx / 100 * canvas.width;
                    visualShape.cy = shape.cy / 100 * canvas.height;
                    visualShape.rx = shape.rx / 100 * canvas.width;
                    visualShape.ry = shape.ry / 100 * canvas.height;
                } else if (visualShape.type === 'polygon') {
                    visualShape.points = shape.points.map(p => ({
                        x: p.x / 100 * canvas.width,
                        y: p.y / 100 * canvas.height
                    }));
                }
                renderableObstacles.push(visualShape);
            });

            const physicsShapeData = obs.physicsShapes || shapes;
            physicsShapeData.forEach(ps => {
                const newShape = { ...ps, terrainType: obs.type };
                 if (newShape.type === 'rect') {
                    newShape.left = (ps.x / 100 * canvas.width);
                    newShape.top = (ps.y / 100 * canvas.height);
                    newShape.right = newShape.left + (ps.width / 100 * canvas.width);
                    newShape.bottom = newShape.top + (ps.height / 100 * canvas.height);
                } else if (newShape.type === 'circle') {
                    newShape.cx = ps.cx / 100 * canvas.width;
                    newShape.cy = ps.cy / 100 * canvas.height;
                    newShape.radius = ps.radius / 100 * Math.min(canvas.width, canvas.height);
                } else if (newShape.type === 'oval') {
                    newShape.cx = ps.cx / 100 * canvas.width;
                    newShape.cy = ps.cy / 100 * canvas.height;
                    newShape.rx = ps.rx / 100 * canvas.width;
                    newShape.ry = ps.ry / 100 * canvas.height;
                } else if (newShape.type === 'polygon') {
                    newShape.points = ps.points.map(p => ({
                        x: p.x / 100 * canvas.width,
                        y: p.y / 100 * canvas.height
                    }));
                }
                allPhysicsShapes.push(newShape);
            });
        });

        holeNumberElement.textContent = holeIndex + 1;
        holeParElement.textContent = currentCourse.par;
        strokeCountElement.textContent = strokes;
        totalPar = holeData.slice(0, holeIndex + 1).reduce((sum, h) => sum + h.par, 0);
        totalParElement.textContent = totalPar;
        totalStrokesElement.textContent = totalStrokes;
        showMessage(`Hole ${holeIndex + 1} (Par ${currentCourse.par}). Aim and shoot!`);
    }

    function gameOver() {
        let message = `Game Over! Total score: ${totalStrokes}`;
        const diff = totalStrokes - totalPar;
        if (diff === 0) message += " (Par)";
        else if (diff > 0) message += ` (+${diff})`;
        else message += ` (${diff})`;
        showMessage(message, 'success');
        setTimeout(showLevelSelection, 2000);
    }

    function gameLoop() {
        if (isMoving) {
            updatePhysics();
        }
        render();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function updatePhysics() {
        if (!isMoving) return;

        if (ballPos.z > 0 || ballVel.z > 0) {
            ballVel.z -= GRAVITY;
            ballPos.z += ballVel.z;
            if (ballPos.z <= 0) {
                ballPos.z = 0;
                ballVel.z = 0;
            }
        }

        if (ballPos.z === 0) {
            const terrain = getBallTerrain(ballPos);
            let currentFriction = NORMAL_FRICTION;
            if (terrain === 'sand') currentFriction = SAND_FRICTION;
            else if (terrain === 'rough') currentFriction = ROUGH_FRICTION;
            ballVel.x *= currentFriction;
            ballVel.y *= currentFriction;
        }

        const nextX = ballPos.x + ballVel.x;
        const nextY = ballPos.y + ballVel.y;

        if (ballPos.z === 0 && distance(ballPos, holePos) <= HOLE_RADIUS && Math.hypot(ballVel.x, ballVel.y) < 2) {
            isMoving = false;
            ballVel = { x: 0, y: 0, z: 0 };
            let scoreMsg = "";
            if (strokes === 1) scoreMsg = " (Hole in one!)";
            else if (strokes < currentCourse.par) scoreMsg = ` (${currentCourse.par - strokes} under par, Birdie/Eagle!)`;
            else if (strokes === currentCourse.par) scoreMsg = " (Par)";
            else scoreMsg = ` (+${strokes - currentCourse.par} over par)`;
            showMessage(`Hole ${currentHoleIndex + 1} completed in ${strokes} strokes!${scoreMsg}`, 'success');

            if (gameMode === 'campaign') {
                setTimeout(() => setupHole(currentHoleIndex + 1), 2000);
            } else {
                setTimeout(showLevelSelection, 2000);
            }
            return;
        }

        if (ballPos.z === 0 && Math.hypot(ballVel.x, ballVel.y) < MIN_VELOCITY) {
            isMoving = false;
            ballVel = { x: 0, y: 0, z: 0 };
            showMessage(`Ready for stroke ${strokes + 1}.`);
            return;
        }

        if (nextX - BALL_RADIUS < 0 || nextX + BALL_RADIUS > canvas.width) ballVel.x *= -1;
        if (nextY - BALL_RADIUS < 0 || nextY + BALL_RADIUS > canvas.height) ballVel.y *= -1;

        // Hazard collision only applies if the ball is on the ground
        if (ballPos.z === 0) {
            for (const shape of allPhysicsShapes) {
                if (shape.terrainType === 'water' && isPointInShape({x: nextX, y: nextY}, shape)) {
                    showMessage(`Splash! ${WATER_PENALTY} stroke penalty.`, 'penalty');
                    strokes += WATER_PENALTY;
                    totalStrokes += WATER_PENALTY;
                    setupHole(currentHoleIndex);
                    return;
                }
                if (shape.terrainType === 'tree-patch' && isPointInShape({x: nextX, y: nextY}, shape)) {
                     ballVel.x *= -1;
                     ballVel.y *= -1;
                     break;
                }
            }
        }

        ballPos.x += ballVel.x;
        ballPos.y += ballVel.y;
    }

    function distance(p1, p2) { return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)); }
    function isPointInPolygon(point, polygon) {
        let isInside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }
    function isPointInShape(point, shape) {
        if (shape.type === 'rect') return (point.x > shape.left && point.x < shape.right && point.y > shape.top && point.y < shape.bottom);
        if (shape.type === 'circle') return (distance(point, { x: shape.cx, y: shape.cy }) < shape.radius);
        if (shape.type === 'polygon') return isPointInPolygon(point, shape.points);
        if (shape.type === 'oval') return (Math.pow(point.x - shape.cx, 2) / Math.pow(shape.rx, 2) + Math.pow(point.y - shape.cy, 2) / Math.pow(shape.ry, 2) < 1);
        return false;
    }
    function showMessage(msg, type = 'info') {
        messageAreaElement.textContent = msg;
        messageAreaElement.className = 'message-area'; // Reset classes
        if (type === 'success') {
            messageAreaElement.classList.add('success');
        } else if (type === 'penalty') {
            messageAreaElement.classList.add('penalty');
        }
    }
    function getTerrainAtPoint(point) {
        const terrains = [];
        for (const shape of allPhysicsShapes) {
            if (isPointInShape(point, shape)) {
                terrains.push(shape.terrainType);
            }
        }
        if (terrains.length === 0) terrains.push('rough');
        return terrains;
    }
    function getBallTerrain(currentBallPos) {
        const terrains = getTerrainAtPoint(currentBallPos);
        if (terrains.includes('sand')) return 'sand';
        if (terrains.includes('water')) return 'rough';
        if (terrains.includes('green')) return 'fairway';
        if (terrains.includes('fairway')) return 'fairway';
        return 'rough';
    }

    function drawRect(shape, ctx) { ctx.fillRect(shape.x, shape.y, shape.width, shape.height); }
    function drawCircle(shape, ctx) { ctx.beginPath(); ctx.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2); ctx.fill(); }
    function drawOval(shape, ctx) { ctx.beginPath(); ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2); ctx.fill(); }
function drawPolygon(shape, ctx) {
    if (!shape.points || shape.points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
}

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = terrainColors.rough;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        renderableObstacles.forEach(shape => {
            ctx.fillStyle = terrainColors[shape.terrainType] || '#CCCCCC';
            if (shape.type === 'rect') drawRect(shape, ctx);
            else if (shape.type === 'circle') drawCircle(shape, ctx);
            else if (shape.type === 'oval') drawOval(shape, ctx);
            else if (shape.type === 'polygon') drawPolygon(shape, ctx);
        });

        // Draw hole
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(holePos.x, holePos.y, HOLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Draw shadow if ball is in the air
        if (ballPos.z > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            // Shadow gets smaller as the ball gets higher
            const shadowRadius = BALL_RADIUS * Math.max(0.4, 1 - ballPos.z / 100);
            ctx.arc(ballPos.x, ballPos.y, shadowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw ball
        const visualBallRadius = BALL_RADIUS * (1 + ballPos.z / 200);
        const visualBallY = ballPos.y - ballPos.z;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ballPos.x, visualBallY, visualBallRadius, 0, Math.PI * 2);
        ctx.fill();

        if (isAiming) {
            // The aiming line should start from the ball's logical position on the ground
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(ballPos.x, ballPos.y);
            let dx = ballPos.x - aimEndPos.x;
            let dy = ballPos.y - aimEndPos.y;
            const dist = Math.hypot(dx, dy);
            const visualPowerRatio = Math.min(1, dist / (MAX_POWER * POWER_SENSITIVITY * 0.5));
            const endX = ballPos.x + dx * visualPowerRatio;
            const endY = ballPos.y + dy * visualPowerRatio;
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }
    function handleAimStart(e) {
        if (isMoving) return;
        isAiming = true;
        aimStartPos = getMousePos(canvas, e);
        aimEndPos = aimStartPos;
    }
    function handleAimMove(e) {
        if (isAiming) aimEndPos = getMousePos(canvas, e);
        const mousePos = getMousePos(canvas, e);
        const terrains = getTerrainAtPoint(mousePos);
        terrainDebugDisplay.textContent = `Mouse over terrain: ${terrains.join(', ')}`;
    }
    function handleAimEnd(e) {
        if (!isAiming) return;
        isAiming = false;

        const aimEnd = getMousePos(canvas, e);
        let dx = ballPos.x - aimEnd.x;
        let dy = ballPos.y - aimEnd.y;

        const power = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const actualPower = Math.min(power / POWER_SENSITIVITY, MAX_POWER);

        if (actualPower > 0.5) {
            ballVel.x = Math.cos(angle) * actualPower;
            ballVel.y = Math.sin(angle) * actualPower;
            if (selectedClub === 'wedge') ballVel.z = actualPower * 0.5;
            strokes++;
            totalStrokes++;
            strokeCountElement.textContent = strokes;
            totalStrokesElement.textContent = totalStrokes;
            isMoving = true;
            showMessage("In play!", 'info');
        }
    }

    canvas.addEventListener('mousedown', handleAimStart);
    canvas.addEventListener('mousemove', handleAimMove);
    canvas.addEventListener('mouseup', handleAimEnd);
    canvas.addEventListener('mouseout', () => { if (isAiming) handleAimEnd({clientX: aimEndPos.x, clientY: aimEndPos.y}); });

    function selectClub(club) {
        selectedClub = club;
        if (club === 'putter') {
            putterBtn.classList.add('active');
            wedgeBtn.classList.remove('active');
        } else if (club === 'wedge') {
            wedgeBtn.classList.add('active');
            putterBtn.classList.remove('active');
        }
    }

    putterBtn.addEventListener('click', () => selectClub('putter'));
    wedgeBtn.addEventListener('click', () => selectClub('wedge'));

    async function initializeGame() {
        await loadAllCourses();
        showLevelSelection();
        gameLoop();
    }
    initializeGame();
});