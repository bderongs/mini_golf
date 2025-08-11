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
            totalStrokes += strokes;
            totalStrokesElement.textContent = totalStrokes;

            setTimeout(() => {
                setupHole(currentHoleIndex + 1);
            }, 2000);
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
    setupHole(0);
    window.addEventListener('resize', () => setupHole(currentHoleIndex));
});