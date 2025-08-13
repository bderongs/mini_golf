document.addEventListener('DOMContentLoaded', () => {
    // DOM References
    const ballElement = document.getElementById('ball');
    const holeElement = document.getElementById('hole');
    const courseElement = document.getElementById('course');
    const strokeCountElement = document.getElementById('stroke-count');
    const holeNumberElement = document.getElementById('hole-number');
    const holeParElement = document.getElementById('hole-par');
    const messageAreaElement = document.getElementById('message-area');
    const totalParElement = document.getElementById('total-par');
    const totalStrokesElement = document.getElementById('total-strokes');
    const fairwayGroup = document.getElementById('fairway-group');
    const aimLineElement = document.getElementById('aim-line');
    const putterBtn = document.getElementById('putter-btn');
    const wedgeBtn = document.getElementById('wedge-btn');
    const ballShadowElement = document.getElementById('ball-shadow');
    const versionDisplayElement = document.getElementById('version-display');
    const holeCoordsDisplay = document.getElementById('hole-coords-display');
    const mouseCoordsDisplay = document.getElementById('mouse-coords-display');
    const liveHoleCoordsDisplay = document.getElementById('live-hole-coords-display');
    const terrainDebugDisplay = document.getElementById('terrain-debug-display');

    // Display version
    versionDisplayElement.textContent = `Version: ${new Date().toISOString()}`;

    // Game State
    let selectedClub = 'putter';
    let gameMode = 'campaign'; // 'campaign' or 'free-play'

    // --- Screen Management ---
    const levelSelectionScreen = document.getElementById('level-selection-screen');
    const gameUI = document.getElementById('game-ui');
    const levelList = document.getElementById('level-list');
    const playAllBtn = document.getElementById('play-all-btn');

    function showLevelSelection() {
        levelSelectionScreen.style.display = 'block';
        gameUI.style.display = 'none';
        levelList.innerHTML = ''; // Clear previous buttons

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


    // Club selection logic
    putterBtn.addEventListener('click', () => {
        selectedClub = 'putter';
        putterBtn.classList.add('active');
        wedgeBtn.classList.remove('active');
    });

    wedgeBtn.addEventListener('click', () => {
        selectedClub = 'wedge';
        wedgeBtn.classList.add('active');
        putterBtn.classList.remove('active');
    });

    // Game Constants
    const NORMAL_FRICTION = 0.985;
    const SAND_FRICTION = 0.88;
    const ROUGH_FRICTION = 0.95;
    const MIN_VELOCITY = 0.08;
    const MAX_POWER = 18;
    const POWER_SENSITIVITY = 12;
    const WATER_PENALTY = 1;
    const OUT_OF_BOUNDS_PENALTY = 1;
    const GRAVITY = 0.2;
    let HOLE_RADIUS = 16;
    let BALL_RADIUS = 10;

    let holeData = [];
    const NUM_LEVELS = 1; // Assuming 1 level for now, can be dynamic later

    async function loadCourseData(levelIndex) {
        try {
            const response = await fetch(`courses/course${levelIndex + 1}.json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Could not load course ${levelIndex + 1}:`, error);
            return null; // Return null on error
        }
    }

    async function loadAllCourses() {
        const coursePromises = [];
        for (let i = 0; i < NUM_LEVELS; i++) {
            coursePromises.push(loadCourseData(i));
        }
        const results = await Promise.all(coursePromises);
        holeData = results.filter(data => data !== null);
    }

    let strokes = 0;
    let totalStrokes = 0;
    let totalPar = 0;
    let isAiming = false;
    let isMoving = false;
    let aimStartPos = { x: 0, y: 0 };
    let animationFrameId = null;
    let currentObstacles = [];
    let currentFairwayShapes = [];
    let currentHoleIndex;

    // --- Utility Functions ---
    function getElementCenter(element) {
        return {
            x: element.offsetLeft + element.offsetWidth / 2,
            y: element.offsetTop + element.offsetHeight / 2
        };
    }
    function distance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
    function updateElementPosition(element, pos) {
        element.style.left = `${pos.x}px`;
        element.style.top = `${pos.y}px`;
    }
    // Message function with CSS classes for styling
    function showMessage(msg, type = 'info') {
        messageAreaElement.textContent = msg;
        messageAreaElement.className = 'message-area'; // Reset classes
        if (type === 'success') {
            messageAreaElement.classList.add('success');
        } else if (type === 'penalty') {
            messageAreaElement.classList.add('penalty');
        }
    }

    // --- Game Logic ---

    function setupHole(holeIndex) {
        if (holeIndex >= holeData.length) {
            gameOver();
            return;
        }

        const courseRect = courseElement.getBoundingClientRect();
        BALL_RADIUS = ballElement.offsetWidth / 2;
        HOLE_RADIUS = holeElement.offsetWidth / 2;

        const data = holeData[holeIndex];
        currentHoleIndex = holeIndex;
        strokes = 0;
        isMoving = false;
        ballVel = { x: 0, y: 0, z: 0 };

        ballPos = {
            x: data.start.x / 100 * courseRect.width,
            y: data.start.y / 100 * courseRect.height,
            z: 0
        };
        currentHolePos = {
            x: data.hole.x / 100 * courseRect.width,
            y: data.hole.y / 100 * courseRect.height
        };

        updateElementPosition(ballElement, ballPos);
        updateElementPosition(holeElement, currentHolePos);
        holeCoordsDisplay.textContent = `Hole: (${currentHolePos.x.toFixed(2)}, ${currentHolePos.y.toFixed(2)})`;

        // Clean up old elements
        fairwayGroup.innerHTML = '';
        currentFairwayShapes = [];
        currentObstacles.forEach(obs => obs.remove());
        currentObstacles = [];

        // Create Fairway
        if (data.fairway) {
            // Create visual path
            if (data.fairway.path) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', data.fairway.path);
                path.classList.add('fairway-path');
                fairwayGroup.appendChild(path);
            }

            // Create physics shapes
            if (data.fairway.physicsShapes && Array.isArray(data.fairway.physicsShapes)) {
                data.fairway.physicsShapes.forEach(shapeData => {
                    let shape;
                    switch (shapeData.type) {
                        case 'rect':
                            const fwX = shapeData.x / 100 * courseRect.width;
                            const fwY = shapeData.y / 100 * courseRect.height;
                            const fwWidth = shapeData.width / 100 * courseRect.width;
                            const fwHeight = shapeData.height / 100 * courseRect.height;
                            shape = { type: 'rect', left: fwX, top: fwY, right: fwX + fwWidth, bottom: fwY + fwHeight };
                            break;
                        case 'circle':
                            const cx = shapeData.cx / 100 * courseRect.width;
                            const cy = shapeData.cy / 100 * courseRect.height;
                            const radius = shapeData.radius / 100 * Math.min(courseRect.width, courseRect.height);
                            shape = { type: 'circle', cx: cx, cy: cy, radius: radius };
                            break;
                        case 'polygon':
                            const points = shapeData.points.map(p => ({
                                x: p.x / 100 * courseRect.width,
                                y: p.y / 100 * courseRect.height
                            }));
                            shape = { type: 'polygon', points: points };
                            break;
                    }
                    if (shape) currentFairwayShapes.push(shape);
                });
            }
        }

        if (currentFairwayShapes.length === 0) {
            currentFairwayShapes.push({ type: 'rect', left: 0, top: 0, right: courseRect.width, bottom: courseRect.height });
        }


        // Add new obstacles
        if (data.obstacles) {
            data.obstacles.forEach(obsData => {
                const obsElement = document.createElement('div');
                obsElement.classList.add('obstacle', `obstacle-${obsData.type}`);

                const shape = obsData.shape;
                let obsX, obsY, obsWidth, obsHeight;

                if (shape.type === 'rect') {
                    obsX = shape.x / 100 * courseRect.width;
                    obsY = shape.y / 100 * courseRect.height;
                    obsWidth = shape.width / 100 * courseRect.width;
                    obsHeight = shape.height / 100 * courseRect.height;
                    obsElement.style.left = `${obsX}px`;
                    obsElement.style.top = `${obsY}px`;
                    obsElement.style.width = `${obsWidth}px`;
                    obsElement.style.height = `${obsHeight}px`;
                } else if (shape.type === 'circle') {
                    const cx = shape.cx / 100 * courseRect.width;
                    const cy = shape.cy / 100 * courseRect.height;
                    const radius = shape.radius / 100 * Math.min(courseRect.width, courseRect.height);
                    obsX = cx - radius;
                    obsY = cy - radius;
                    obsWidth = obsHeight = radius * 2;
                    obsElement.style.left = `${obsX}px`;
                    obsElement.style.top = `${obsY}px`;
                    obsElement.style.width = `${obsWidth}px`;
                    obsElement.style.height = `${obsHeight}px`;
                    obsElement.style.borderRadius = '50%';
                } else if (shape.type === 'oval') {
                    const cx = shape.cx / 100 * courseRect.width;
                    const cy = shape.cy / 100 * courseRect.height;
                    const rx = shape.rx / 100 * courseRect.width;
                    const ry = shape.ry / 100 * courseRect.height;
                    obsX = cx - rx;
                    obsY = cy - ry;
                    obsWidth = rx * 2;
                    obsHeight = ry * 2;
                    obsElement.style.left = `${obsX}px`;
                    obsElement.style.top = `${obsY}px`;
                    obsElement.style.width = `${obsWidth}px`;
                    obsElement.style.height = `${obsHeight}px`;
                    obsElement.style.borderRadius = '50%';
                }


                // Special handling for tree patches
                if (obsData.type === 'tree-patch') {
                    const treeDensity = 0.5; // Trees per 100x100 pixel area
                    const treeArea = (obsWidth * obsHeight) / (100*100);
                    const numTrees = Math.ceil(treeArea * treeDensity * 10);

                    for (let i = 0; i < numTrees; i++) {
                        const tree = document.createElement('div');
                        tree.classList.add('tree-in-patch');

                        const size = (Math.random() * 0.5 + 0.75) * 30; // 75% to 125% of base size
                        tree.style.width = `${size}px`;
                        tree.style.height = `${size}px`;

                        tree.style.left = `${Math.random() * (obsWidth - size)}px`;
                        tree.style.top = `${Math.random() * (obsHeight - size)}px`;
                        tree.style.zIndex = 20 + i; // Give stacking order

                        obsElement.appendChild(tree);
                    }
                }

                // Store pixel values in dataset for collision detection
                obsElement.dataset.obsType = obsData.type;
                obsElement.dataset.shape = JSON.stringify(shape);


                courseElement.appendChild(obsElement);
                currentObstacles.push(obsElement);
            });
        }

        // Update UI
        holeNumberElement.textContent = holeIndex + 1;
        holeParElement.textContent = data.par;
        strokeCountElement.textContent = strokes;
        totalPar = holeData.slice(0, holeIndex + 1).reduce((sum, h) => sum + h.par, 0);
        totalParElement.textContent = totalPar;
        totalStrokesElement.textContent = totalStrokes;

        showMessage(`Hole ${holeIndex + 1} (Par ${data.par}). Aim and shoot!`);
        aimLineElement.parentElement.style.visibility = 'hidden';
    }

    function gameOver() {
        let message = `Game Over! Total score: ${totalStrokes}`;
        const diff = totalStrokes - totalPar;
        if (diff === 0) {
            message += " (Par)";
        } else if (diff > 0) {
            message += ` (+${diff})`;
        } else {
            message += ` (${diff})`;
        }
        showMessage(message, 'success');
    }

    function isPointInPolygon(point, polygon) {
        let isInside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }

    function isBallInFairway(ballPos) {
        for (const shape of currentFairwayShapes) {
            if (shape.type === 'rect') {
                if (ballPos.x > shape.left && ballPos.x < shape.right &&
                    ballPos.y > shape.top && ballPos.y < shape.bottom) {
                    return true;
                }
            } else if (shape.type === 'circle') {
                if (distance(ballPos, { x: shape.cx, y: shape.cy }) < shape.radius) {
                    return true;
                }
            } else if (shape.type === 'polygon') {
                if (isPointInPolygon(ballPos, shape.points)) {
                    return true;
                }
            }
        }
        return false;
    }

    function getBallTerrain(currentBallPos) {
        const courseRect = courseElement.getBoundingClientRect();
        for (const obs of currentObstacles) {
            const shape = JSON.parse(obs.dataset.shape);
            if (obs.dataset.obsType === 'sand') {
                if (shape.type === 'rect') {
                    const rect = {
                        left: shape.x / 100 * courseRect.width,
                        top: shape.y / 100 * courseRect.height,
                        right: (shape.x + shape.width) / 100 * courseRect.width,
                        bottom: (shape.y + shape.height) / 100 * courseRect.height
                    };
                    if (currentBallPos.x > rect.left && currentBallPos.x < rect.right &&
                        currentBallPos.y > rect.top && currentBallPos.y < rect.bottom) {
                        return 'sand';
                    }
                } else if (shape.type === 'circle') {
                    const cx = shape.cx / 100 * courseRect.width;
                    const cy = shape.cy / 100 * courseRect.height;
                    const radius = shape.radius / 100 * Math.min(courseRect.width, courseRect.height);
                    if (distance(currentBallPos, { x: cx, y: cy }) < radius) {
                        return 'sand';
                    }
                } else if (shape.type === 'oval') {
                    const cx = shape.cx / 100 * courseRect.width;
                    const cy = shape.cy / 100 * courseRect.height;
                    const rx = shape.rx / 100 * courseRect.width;
                    const ry = shape.ry / 100 * courseRect.height;
                    if (Math.pow(currentBallPos.x - cx, 2) / Math.pow(rx, 2) + Math.pow(currentBallPos.y - cy, 2) / Math.pow(ry, 2) < 1) {
                        return 'sand';
                    }
                }
            }
        }

        if (isBallInFairway(currentBallPos)) {
            return 'fairway';
        }

        return 'rough';
    }

    function getTerrainAtPoint(point) {
        const terrains = [];
        const courseRect = courseElement.getBoundingClientRect();

        // Check obstacles first
        for (const obs of currentObstacles) {
            const shape = JSON.parse(obs.dataset.shape);
            const obsType = obs.dataset.obsType;
            let isInObstacle = false;

            if (shape.type === 'rect') {
                const rect = {
                    left: shape.x / 100 * courseRect.width,
                    top: shape.y / 100 * courseRect.height,
                    right: (shape.x + shape.width) / 100 * courseRect.width,
                    bottom: (shape.y + shape.height) / 100 * courseRect.height
                };
                if (point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom) {
                    isInObstacle = true;
                }
            } else if (shape.type === 'circle') {
                const cx = shape.cx / 100 * courseRect.width;
                const cy = shape.cy / 100 * courseRect.height;
                const radius = shape.radius / 100 * Math.min(courseRect.width, courseRect.height);
                if (distance(point, { x: cx, y: cy }) < radius) {
                    isInObstacle = true;
                }
            } else if (shape.type === 'oval') {
                const cx = shape.cx / 100 * courseRect.width;
                const cy = shape.cy / 100 * courseRect.height;
                const rx = shape.rx / 100 * courseRect.width;
                const ry = shape.ry / 100 * courseRect.height;
                if (Math.pow(point.x - cx, 2) / Math.pow(rx, 2) + Math.pow(point.y - cy, 2) / Math.pow(ry, 2) < 1) {
                    isInObstacle = true;
                }
            }

            if (isInObstacle) {
                terrains.push(obsType);
            }
        }

        // Check fairway
        if (isBallInFairway(point)) {
            terrains.push('fairway');
        }

        // If no other terrain, it's rough
        if (terrains.length === 0) {
            terrains.push('rough');
        }

        return terrains;
    }

    function update() {
        if (!isMoving) return;

        // 3D Physics
        if (ballPos.z > 0 || ballVel.z > 0) {
            ballVel.z -= GRAVITY;
            ballPos.z += ballVel.z;

            if (ballPos.z <= 0) {
                ballPos.z = 0;
                ballVel.z = 0;
                ballShadowElement.style.display = 'none';
                ballElement.style.transform = 'translate(-50%, -50%) scale(1)';
            } else {
                ballShadowElement.style.display = 'block';
                const shadowScale = 1 + ballPos.z * 0.1;
                const ballScale = 1 + ballPos.z * 0.05;
                ballShadowElement.style.transform = `translate(-50%, -50%) scale(${shadowScale})`;
                ballShadowElement.style.opacity = 0.5 - ballPos.z * 0.02;
                updateElementPosition(ballShadowElement, ballPos);
                ballElement.style.transform = `translate(-50%, -50%) scale(${ballScale})`;
            }
        }

        // Friction
        if (ballPos.z === 0) {
            const terrain = getBallTerrain(ballPos);
            let currentFriction = NORMAL_FRICTION;
            if (terrain === 'sand') {
                currentFriction = SAND_FRICTION;
            } else if (terrain === 'rough') {
                currentFriction = ROUGH_FRICTION;
            }
            ballVel.x *= currentFriction;
            ballVel.y *= currentFriction;
        }

        // Update position
        const nextX = ballPos.x + ballVel.x;
        const nextY = ballPos.y + ballVel.y;
        let potentialCollision = false;

        // Obstacle Collision
        for (const obs of currentObstacles) {
            if (potentialCollision) break;
            const obsType = obs.dataset.obsType;
            const shape = JSON.parse(obs.dataset.shape);
            const courseRect = courseElement.getBoundingClientRect();
            let collides = false;

            if (shape.type === 'rect') {
                const rect = {
                    left: shape.x / 100 * courseRect.width,
                    top: shape.y / 100 * courseRect.height,
                    right: (shape.x + shape.width) / 100 * courseRect.width,
                    bottom: (shape.y + shape.height) / 100 * courseRect.height
                };
                collides = (
                    nextX + BALL_RADIUS > rect.left &&
                    nextX - BALL_RADIUS < rect.right &&
                    nextY + BALL_RADIUS > rect.top &&
                    nextY - BALL_RADIUS < rect.bottom
                );

                if (collides && obsType === 'tree-patch') {
                    // More precise collision for tree patches
                    if (ballPos.y + BALL_RADIUS > rect.top && ballPos.y - BALL_RADIUS < rect.bottom) {
                        if ((ballPos.x + BALL_RADIUS <= rect.left && nextX + BALL_RADIUS > rect.left) ||
                            (ballPos.x - BALL_RADIUS >= rect.right && nextX - BALL_RADIUS < rect.right)) {
                            ballVel.x *= -1;
                        }
                    }
                    if (ballPos.x + BALL_RADIUS > rect.left && ballPos.x - BALL_RADIUS < rect.right) {
                        if ((ballPos.y + BALL_RADIUS <= rect.top && nextY + BALL_RADIUS > rect.top) ||
                            (ballPos.y - BALL_RADIUS >= rect.bottom && nextY - BALL_RADIUS < rect.bottom)) {
                            ballVel.y *= -1;
                        }
                    }
                }

            } else if (shape.type === 'circle') {
                const cx = shape.cx / 100 * courseRect.width;
                const cy = shape.cy / 100 * courseRect.height;
                const radius = shape.radius / 100 * Math.min(courseRect.width, courseRect.height);
                if (distance({x: nextX, y: nextY}, { x: cx, y: cy }) < radius + BALL_RADIUS) {
                    collides = true;
                    if (obsType === 'tree-patch') {
                        // Reflect velocity vector
                        const normal = { x: nextX - cx, y: nextY - cy };
                        const normalMag = Math.hypot(normal.x, normal.y);
                        normal.x /= normalMag;
                        normal.y /= normalMag;
                        const dot = ballVel.x * normal.x + ballVel.y * normal.y;
                        ballVel.x -= 2 * dot * normal.x;
                        ballVel.y -= 2 * dot * normal.y;
                    }
                }
            } else if (shape.type === 'oval') {
                const cx = shape.cx / 100 * courseRect.width;
                const cy = shape.cy / 100 * courseRect.height;
                const rx = shape.rx / 100 * courseRect.width;
                const ry = shape.ry / 100 * courseRect.height;
                // Simplified collision for ovals - treat as a bounding box for collision response
                 const rect = { left: cx - rx, top: cy - ry, right: cx + rx, bottom: cy + ry };
                 if (nextX + BALL_RADIUS > rect.left && nextX - BALL_RADIUS < rect.right &&
                     nextY + BALL_RADIUS > rect.top && nextY - BALL_RADIUS < rect.bottom) {

                    if (Math.pow(nextX - cx, 2) / Math.pow(rx, 2) + Math.pow(nextY - cy, 2) / Math.pow(ry, 2) < 1) {
                         collides = true;
                         if (obsType === 'tree-patch') {
                            // Simplified reflection
                            if (nextX > cx - rx && nextX < cx + rx) ballVel.y *= -1;
                            else if (nextY > cy - ry && nextY < cy + ry) ballVel.x *= -1;
                            else { // Corner, reflect both
                                ballVel.x *= -1;
                                ballVel.y *= -1;
                            }
                         }
                    }
                 }
            }

            if (collides && obsType === 'water' && ballPos.z === 0) {
                showMessage(`Splash! ${WATER_PENALTY} stroke penalty.`, 'penalty');
                strokes += WATER_PENALTY;
                totalStrokes += WATER_PENALTY;
                strokeCountElement.textContent = strokes;
                totalStrokesElement.textContent = totalStrokes;
                // Reset ball position
                ballPos = {
                    x: holeData[currentHoleIndex].start.x / 100 * courseRect.width,
                    y: holeData[currentHoleIndex].start.y / 100 * courseRect.height,
                    z: 0
                };
                ballVel = { x: 0, y: 0, z: 0 };
                isMoving = false;
                potentialCollision = true;
                updateElementPosition(ballElement, ballPos);
                setTimeout(() => showMessage(`Ready for stroke ${strokes + 1}.`), 1000);
                break;
            }
        }

        if (potentialCollision && isMoving) { // only stop if a collision actually happened
            // No need to cancel animation frame here if we want bounce to continue
        }

        ballPos.x += ballVel.x;
        ballPos.y += ballVel.y;

        // Boundary Collision (Out of Bounds)
        const courseRect = courseElement.getBoundingClientRect();
        if (ballPos.x - BALL_RADIUS < 0 || ballPos.x + BALL_RADIUS > courseRect.width ||
            ballPos.y - BALL_RADIUS < 0 || ballPos.y + BALL_RADIUS > courseRect.height) {

            showMessage(`Out of Bounds! ${OUT_OF_BOUNDS_PENALTY} stroke penalty.`, 'penalty');
            strokes += OUT_OF_BOUNDS_PENALTY;
            totalStrokes += OUT_OF_BOUNDS_PENALTY;
            strokeCountElement.textContent = strokes;
            totalStrokesElement.textContent = totalStrokes;

            // Reset ball position
            ballPos = {
                x: holeData[currentHoleIndex].start.x / 100 * courseRect.width,
                y: holeData[currentHoleIndex].start.y / 100 * courseRect.height,
                z: 0
            };
            ballVel = { x: 0, y: 0, z: 0 };
            isMoving = false;
            updateElementPosition(ballElement, ballPos);
            setTimeout(() => showMessage(`Ready for stroke ${strokes + 1}.`), 1500);
            return; // Stop the update loop for this frame
        }

        // Update visual position
        updateElementPosition(ballElement, ballPos);

        // Debug displays
        const distToHole = distance(ballPos, currentHolePos);
        liveHoleCoordsDisplay.textContent = `Live Hole: (${currentHolePos.x.toFixed(2)}, ${currentHolePos.y.toFixed(2)})`;
        if (distToHole < HOLE_RADIUS * 2) {
            console.log({ distToHole, ballVel: { ...ballVel }, ballPos: { ...ballPos }, HOLE_RADIUS, speed: Math.hypot(ballVel.x, ballVel.y) });
        }

        // Check for win
        if (ballPos.z === 0 && distToHole <= HOLE_RADIUS && Math.hypot(ballVel.x, ballVel.y) < 2) {
            isMoving = false;
            ballVel = { x: 0, y: 0, z: 0 };
            cancelAnimationFrame(animationFrameId);
            const holePar = holeData[currentHoleIndex].par;
            let scoreMsg = "";
            if (strokes === 1) scoreMsg = " (Hole in one!)";
            else if (strokes < holePar) scoreMsg = ` (${holePar - strokes} under par, Birdie/Eagle!)`;
            else if (strokes === holePar) scoreMsg = " (Par)";
            else scoreMsg = ` (+${strokes - holePar} over par)`;

            showMessage(`Hole ${currentHoleIndex + 1} completed in ${strokes} strokes!${scoreMsg}`, 'success');

            if (gameMode === 'campaign') {
                totalStrokes += strokes;
                totalStrokesElement.textContent = totalStrokes;
                setTimeout(() => {
                    setupHole(currentHoleIndex + 1);
                }, 2000);
            } else {
                setTimeout(() => {
                    showLevelSelection();
                }, 2000);
            }
            return;
        }

        // Check for stop
        if (ballPos.z === 0 && Math.hypot(ballVel.x, ballVel.y) < MIN_VELOCITY) {
            isMoving = false;
            ballVel = { x: 0, y: 0, z: 0 };
            cancelAnimationFrame(animationFrameId);
            showMessage(`Ready for stroke ${strokes + 1}.`);
            return;
        }

        animationFrameId = requestAnimationFrame(update);
    }

    // --- Event Handlers ---
    const handleAimStart = (x, y) => {
        if (isMoving) return;
        isAiming = true;
        const rect = courseElement.getBoundingClientRect();
        aimStartPos = { x: x - rect.left, y: y - rect.top };
        aimLineElement.setAttribute('x1', ballPos.x);
        aimLineElement.setAttribute('y1', ballPos.y);
        aimLineElement.setAttribute('x2', ballPos.x);
        aimLineElement.setAttribute('y2', ballPos.y);
        aimLineElement.style.visibility = 'visible';
    };

    const handleAimMove = (x, y) => {
        if (!isAiming) return;
        const rect = courseElement.getBoundingClientRect();
        const currentMousePos = { x: x - rect.left, y: y - rect.top };

        let dx = ballPos.x - currentMousePos.x;
        let dy = ballPos.y - currentMousePos.y;
        const dist = Math.hypot(dx, dy);

        const visualPowerRatio = Math.min(1, dist / (MAX_POWER * POWER_SENSITIVITY * 0.5));
        const endX = ballPos.x + dx * visualPowerRatio;
        const endY = ballPos.y + dy * visualPowerRatio;

        aimLineElement.setAttribute('x2', endX);
        aimLineElement.setAttribute('y2', endY);
    };

    const handleAimEnd = (x, y) => {
        if (!isAiming) return;
        isAiming = false;
        aimLineElement.style.visibility = 'hidden';

        const rect = courseElement.getBoundingClientRect();
        const aimEndPos = { x: x - rect.left, y: y - rect.top };

        let dx = ballPos.x - aimEndPos.x;
        let dy = ballPos.y - aimEndPos.y;
        const power = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        const actualPower = Math.min(power / POWER_SENSITIVITY, MAX_POWER);

        if (actualPower > 0.5) {
            ballVel.x = Math.cos(angle) * actualPower;
            ballVel.y = Math.sin(angle) * actualPower;

            if (selectedClub === 'wedge') {
                ballVel.z = actualPower * 0.5;
            }

            strokes++;
            strokeCountElement.textContent = strokes;
            showMessage("In play!", 'info');
            isMoving = true;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(update);
        } else {
            showMessage(`Ready for stroke ${strokes + 1}.`);
        }
    };

    courseElement.addEventListener('mousemove', (e) => {
        const rect = courseElement.getBoundingClientRect();
        const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        const terrains = getTerrainAtPoint(mousePos);
        terrainDebugDisplay.textContent = `Mouse over terrain: ${terrains.join(', ')}`;
    });

    // Mouse Events
    courseElement.addEventListener('mousedown', (e) => { e.preventDefault(); handleAimStart(e.clientX, e.clientY); });
    document.addEventListener('mousemove', (e) => { handleAimMove(e.clientX, e.clientY); });
    document.addEventListener('mouseup', (e) => { handleAimEnd(e.clientX, e.clientY); });

    // Touch Events
    courseElement.addEventListener('touchstart', (e) => { e.preventDefault(); handleAimStart(e.touches[0].clientX, e.touches[0].clientY); });
    document.addEventListener('touchmove', (e) => { handleAimMove(e.touches[0].clientX, e.touches[0].clientY); });
    document.addEventListener('touchend', (e) => { handleAimEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY); });


    // Initialize
    window.addEventListener('resize', () => {
        if (gameMode === 'campaign' && typeof currentHoleIndex !== 'undefined' && holeData.length > 0) {
            setupHole(currentHoleIndex);
        }
    });

    async function initializeGame() {
        await loadAllCourses();
        showLevelSelection();
    }

    initializeGame();
});