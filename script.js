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
    const aimLineElement = document.getElementById('aim-line').querySelector('line');
    const putterBtn = document.getElementById('putter-btn');
    const wedgeBtn = document.getElementById('wedge-btn');
    const ballShadowElement = document.getElementById('ball-shadow');
    const versionDisplayElement = document.getElementById('version-display');
    const holeCoordsDisplay = document.getElementById('hole-coords-display');
    const mouseCoordsDisplay = document.getElementById('mouse-coords-display');
    const liveHoleCoordsDisplay = document.getElementById('live-hole-coords-display');

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
    const MIN_VELOCITY = 0.08;
    const MAX_POWER = 18;
    const POWER_SENSITIVITY = 12;
    const WATER_PENALTY = 1;
    const GRAVITY = 0.2;
    let HOLE_RADIUS = 16;
    let BALL_RADIUS = 10;

    // Hole data using percentages for responsive design
    const holeData = [
        // Hole 1: Simple
        { start: { x: 8.57, y: 50 }, hole: { x: 91.43, y: 50 }, par: 3, obstacles: [] },
        // Hole 2: Center wall
        {
            start: { x: 8.57, y: 13.33 }, hole: { x: 91.43, y: 86.67 }, par: 4, obstacles: [
                { x: 47.14, y: 22.22, width: 5.71, height: 55.56, type: 'wall' }
            ]
        },
        // Hole 3: Water hazard
        {
            start: { x: 8.57, y: 50 }, hole: { x: 91.43, y: 50 }, par: 4, obstacles: [
                { x: 35.71, y: 33.33, width: 28.57, height: 33.33, type: 'water' }
            ]
        },
        // Hole 4: Sand bunker
        {
            start: { x: 14.29, y: 86.67 }, hole: { x: 85.71, y: 13.33 }, par: 5, obstacles: [
                { x: 64.29, y: 17.78, width: 28.57, height: 22.22, type: 'sand' },
                { x: 21.43, y: 33.33, width: 28.57, height: 11.11, type: 'wall' }
            ]
        },
        // Hole 5: Combination
        {
            start: { x: 8.57, y: 13.33 }, hole: { x: 91.43, y: 86.67 }, par: 5, obstacles: [
                { x: 21.43, y: 0, width: 14.29, height: 55.56, type: 'water' },
                { x: 64.29, y: 44.44, width: 14.29, height: 55.56, type: 'water' },
                { x: 42.86, y: 40, width: 14.29, height: 20, type: 'sand' }
            ]
        },
        // Hole 6: The Maze
        {
            start: { x: 5, y: 5 }, hole: { x: 95, y: 95 }, par: 6, obstacles: [
                { x: 0, y: 20, width: 70, height: 5, type: 'wall' },
                { x: 30, y: 40, width: 70, height: 5, type: 'wall' },
                { x: 0, y: 60, width: 70, height: 5, type: 'wall' },
                { x: 30, y: 80, width: 70, height: 5, type: 'wall' }
            ]
        },
        // Hole 7: The Island
        {
            start: { x: 50, y: 85 }, hole: { x: 50, y: 15 }, par: 3, obstacles: [
                { x: 0, y: 0, width: 100, height: 100, type: 'water' },
                { x: 40, y: 10, width: 20, height: 80, type: 'sand' }
            ]
        },
        // Hole 8: Ricochet
        {
            start: { x: 10, y: 10 }, hole: { x: 90, y: 90 }, par: 4, obstacles: [
                { x: 50, y: 0, width: 5, height: 50, type: 'wall' },
                { x: 50, y: 50, width: 5, height: 50, type: 'wall', angle: 45 }
            ]
        },
        // Hole 9: The Funnel
        {
            start: { x: 50, y: 10 }, hole: { x: 50, y: 90 }, par: 4, obstacles: [
                { x: 20, y: 30, width: 5, height: 40, type: 'wall' },
                { x: 75, y: 30, width: 5, height: 40, type: 'wall' }
            ]
        },
        // Hole 10: The S
        {
            start: { x: 10, y: 90 }, hole: { x: 90, y: 10 }, par: 5, obstacles: [
                { x: 20, y: 20, width: 60, height: 5, type: 'wall' },
                { x: 20, y: 75, width: 60, height: 5, type: 'wall' }
            ]
        },
        // Hole 11: Water Trap
        {
            start: { x: 10, y: 50 }, hole: { x: 90, y: 50 }, par: 4, obstacles: [
                { x: 30, y: 40, width: 40, height: 20, type: 'water' }
            ]
        },
        // Hole 12: Sand Pit
        {
            start: { x: 10, y: 10 }, hole: { x: 90, y: 90 }, par: 5, obstacles: [
                { x: 20, y: 20, width: 60, height: 60, type: 'sand' }
            ]
        },
        // Hole 13: The Gauntlet
        {
            start: { x: 5, y: 50 }, hole: { x: 95, y: 50 }, par: 5, obstacles: [
                { x: 20, y: 45, width: 5, height: 10, type: 'wall' },
                { x: 40, y: 45, width: 5, height: 10, type: 'wall' },
                { x: 60, y: 45, width: 5, height: 10, type: 'wall' },
                { x: 80, y: 45, width: 5, height: 10, type: 'wall' }
            ]
        },
        // Hole 14: The Bridge
        {
            start: { x: 10, y: 50 }, hole: { x: 90, y: 50 }, par: 4, obstacles: [
                { x: 30, y: 0, width: 40, height: 45, type: 'water' },
                { x: 30, y: 55, width: 40, height: 45, type: 'water' }
            ]
        },
        // Hole 15: The L
        {
            start: { x: 10, y: 10 }, hole: { x: 90, y: 90 }, par: 4, obstacles: [
                { x: 10, y: 50, width: 80, height: 5, type: 'wall' },
                { x: 85, y: 10, width: 5, height: 45, type: 'wall' }
            ]
        },
        // Hole 16: The U
        {
            start: { x: 10, y: 10 }, hole: { x: 90, y: 10 }, par: 5, obstacles: [
                { x: 10, y: 20, width: 5, height: 70, type: 'wall' },
                { x: 10, y: 90, width: 80, height: 5, type: 'wall' },
                { x: 85, y: 20, width: 5, height: 70, type: 'wall' }
            ]
        },
        // Hole 17: Triple Threat
        {
            start: { x: 10, y: 50 }, hole: { x: 90, y: 50 }, par: 5, obstacles: [
                { x: 30, y: 45, width: 10, height: 10, type: 'water' },
                { x: 50, y: 45, width: 10, height: 10, type: 'sand' },
                { x: 70, y: 45, width: 10, height: 10, type: 'wall' }
            ]
        },
        // Hole 18: The Long Putt
        { start: { x: 5, y: 50 }, hole: { x: 95, y: 50 }, par: 3, obstacles: [] },
        // Hole 19: The Spiral
        {
            start: { x: 50, y: 50 }, hole: { x: 50, y: 50 }, par: 6, obstacles: [
                { x: 30, y: 30, width: 40, height: 5, type: 'wall' },
                { x: 30, y: 30, width: 5, height: 40, type: 'wall' },
                { x: 30, y: 70, width: 45, height: 5, type: 'wall' },
                { x: 70, y: 30, width: 5, height: 45, type: 'wall' }
            ]
        },
        // Hole 20: The Final Challenge
        {
            start: { x: 10, y: 10 }, hole: { x: 90, y: 90 }, par: 7, obstacles: [
                { x: 0, y: 48, width: 30, height: 4, type: 'water' },
                { x: 70, y: 48, width: 30, height: 4, type: 'water' },
                { x: 48, y: 0, width: 4, height: 30, type: 'sand' },
                { x: 48, y: 70, width: 4, height: 30, type: 'sand' }
            ]
        }
    ];

    let strokes = 0;
    let totalStrokes = 0;
    let totalPar = 0;
    let isAiming = false;
    let isMoving = false;
    let aimStartPos = { x: 0, y: 0 };
    let animationFrameId = null;
    let currentObstacles = [];

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

        // Clean up old obstacles
        currentObstacles.forEach(obs => obs.remove());
        currentObstacles = [];

        // Add new obstacles
        if (data.obstacles) {
            data.obstacles.forEach(obsData => {
                const obsElement = document.createElement('div');
                obsElement.classList.add('obstacle');
                obsElement.classList.add(`obstacle-${obsData.type}`);

                const obsX = obsData.x / 100 * courseRect.width;
                const obsY = obsData.y / 100 * courseRect.height;
                const obsWidth = obsData.width / 100 * courseRect.width;
                const obsHeight = obsData.height / 100 * courseRect.height;

                obsElement.style.left = `${obsX}px`;
                obsElement.style.top = `${obsY}px`;
                obsElement.style.width = `${obsWidth}px`;
                obsElement.style.height = `${obsHeight}px`;

                // Store pixel values in dataset for collision detection
                obsElement.dataset.obsType = obsData.type;
                obsElement.dataset.x = obsX;
                obsElement.dataset.y = obsY;
                obsElement.dataset.width = obsWidth;
                obsElement.dataset.height = obsHeight;

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

    function isBallInSand(currentBallPos) {
        for (const obs of currentObstacles) {
            if (obs.dataset.obsType === 'sand') {
                const rect = {
                    left: parseFloat(obs.dataset.x),
                    top: parseFloat(obs.dataset.y),
                    right: parseFloat(obs.dataset.x) + parseFloat(obs.dataset.width),
                    bottom: parseFloat(obs.dataset.y) + parseFloat(obs.dataset.height)
                };
                if (currentBallPos.x > rect.left && currentBallPos.x < rect.right &&
                    currentBallPos.y > rect.top && currentBallPos.y < rect.bottom) {
                    return true;
                }
            }
        }
        return false;
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
            const currentFriction = isBallInSand(ballPos) ? SAND_FRICTION : NORMAL_FRICTION;
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
            const obsRect = {
                left: parseFloat(obs.dataset.x),
                top: parseFloat(obs.dataset.y),
                right: parseFloat(obs.dataset.x) + parseFloat(obs.dataset.width),
                bottom: parseFloat(obs.dataset.y) + parseFloat(obs.dataset.height)
            };

            const collidesRect = (
                nextX + BALL_RADIUS > obsRect.left &&
                nextX - BALL_RADIUS < obsRect.right &&
                nextY + BALL_RADIUS > obsRect.top &&
                nextY - BALL_RADIUS < obsRect.bottom
            );

            if (collidesRect) {
                if (obsType === 'water' && ballPos.z === 0) {
                    showMessage(`Splash! ${WATER_PENALTY} stroke penalty.`, 'penalty');
                    strokes += WATER_PENALTY;
                    totalStrokes += WATER_PENALTY;
                    strokeCountElement.textContent = strokes;
                    totalStrokesElement.textContent = totalStrokes;
                    // Reset ball position
                    const courseRect = courseElement.getBoundingClientRect();
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
                } else if (obsType === 'wall') {
                    let collideX = false;
                    let collideY = false;

                    if (ballPos.y + BALL_RADIUS > obsRect.top && ballPos.y - BALL_RADIUS < obsRect.bottom) {
                        if ((ballPos.x + BALL_RADIUS <= obsRect.left && nextX + BALL_RADIUS > obsRect.left) ||
                            (ballPos.x - BALL_RADIUS >= obsRect.right && nextX - BALL_RADIUS < obsRect.right)) {
                            ballVel.x *= -1;
                            ballPos.x = (ballVel.x > 0) ? obsRect.left - BALL_RADIUS - 0.1 : obsRect.right + BALL_RADIUS + 0.1;
                            collideX = true;
                        }
                    }
                    if (!collideX && ballPos.x + BALL_RADIUS > obsRect.left && ballPos.x - BALL_RADIUS < obsRect.right) {
                        if ((ballPos.y + BALL_RADIUS <= obsRect.top && nextY + BALL_RADIUS > obsRect.top) ||
                            (ballPos.y - BALL_RADIUS >= obsRect.bottom && nextY - BALL_RADIUS < obsRect.bottom)) {
                            ballVel.y *= -1;
                            ballPos.y = (ballVel.y > 0) ? obsRect.top - BALL_RADIUS - 0.1 : obsRect.bottom + BALL_RADIUS + 0.1;
                            collideY = true;
                        }
                    }
                    if (collideX || collideY) {
                        potentialCollision = true;
                        if (ballPos.z > 0) {
                            ballVel.z *= 0.8; // Lose some vertical velocity on wall hit
                        }
                    }
                }
            }
        }

        if (potentialCollision && isMoving) { // only stop if a collision actually happened
            // No need to cancel animation frame here if we want bounce to continue
        }

        ballPos.x += ballVel.x;
        ballPos.y += ballVel.y;

        // Boundary Collision
        const courseRect = courseElement.getBoundingClientRect();
        if (ballPos.x - BALL_RADIUS < 0 || ballPos.x + BALL_RADIUS > courseRect.width) {
            ballPos.x = Math.max(BALL_RADIUS, Math.min(courseRect.width - BALL_RADIUS, ballPos.x));
            ballVel.x *= -0.8;
        }
        if (ballPos.y - BALL_RADIUS < 0 || ballPos.y + BALL_RADIUS > courseRect.height) {
            ballPos.y = Math.max(BALL_RADIUS, Math.min(courseRect.height - BALL_RADIUS, ballPos.y));
            ballVel.y *= -0.8;
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
        aimLineElement.parentElement.style.visibility = 'visible';
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
        aimLineElement.parentElement.style.visibility = 'hidden';

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

    // Mouse Events
    courseElement.addEventListener('mousedown', (e) => { e.preventDefault(); handleAimStart(e.clientX, e.clientY); });
    document.addEventListener('mousemove', (e) => { handleAimMove(e.clientX, e.clientY); });
    document.addEventListener('mouseup', (e) => { handleAimEnd(e.clientX, e.clientY); });

    // Touch Events
    courseElement.addEventListener('touchstart', (e) => { e.preventDefault(); handleAimStart(e.touches[0].clientX, e.touches[0].clientY); });
    document.addEventListener('touchmove', (e) => { handleAimMove(e.touches[0].clientX, e.touches[0].clientY); });
    document.addEventListener('touchend', (e) => { handleAimEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY); });


    // Initialize
    // setupHole(0);
    window.addEventListener('resize', () => {
        if (gameMode === 'campaign') {
            setupHole(currentHoleIndex);
        }
    });

    showLevelSelection();
});