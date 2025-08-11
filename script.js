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

    // Game constants
    const NORMAL_FRICTION = 0.985; // Slightly less friction by default
    const SAND_FRICTION = 0.88;  // High friction in sand
    const MIN_VELOCITY = 0.08; // Reduced for sand
    const MAX_POWER = 18;      // Slightly more max power
    const POWER_SENSITIVITY = 12; // Divisor for power sensitivity
    let HOLE_RADIUS = 15;
    let BALL_RADIUS = 10;
    const WATER_PENALTY = 1; // Number of penalty strokes for water

    // Hole data (with new obstacle types) - using percentages
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
        // Hole 4: Sand bunker before the hole
        {
            start: { x: 14.29, y: 86.67 }, hole: { x: 85.71, y: 13.33 }, par: 5, obstacles: [
                { x: 64.29, y: 8.89, width: 28.57, height: 22.22, type: 'sand' },
                { x: 21.43, y: 33.33, width: 28.57, height: 11.11, type: 'wall' }
            ]
        },
        // Hole 5: Combination of Water and Sand
        {
            start: { x: 8.57, y: 13.33 }, hole: { x: 91.43, y: 86.67 }, par: 5, obstacles: [
                { x: 21.43, y: 0, width: 14.29, height: 55.56, type: 'water' },
                { x: 64.29, y: 44.44, width: 14.29, height: 55.56, type: 'water' },
                { x: 42.86, y: 40, width: 14.29, height: 20, type: 'sand' }
            ]
        },
    ];

    // Game state
    let ballPos = { x: 0, y: 0 };
    let ballVel = { x: 0, y: 0 };
    let currentHoleIndex = 0;
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
        const rect = element.getBoundingClientRect();
        return {
            x: element.offsetLeft + rect.width / 2,
            y: element.offsetTop + rect.height / 2
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
    function showMessage(msg, type = 'info') { // 'info', 'success', 'penalty'
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
        ballVel = { x: 0, y: 0 };

        ballPos = {
            x: data.start.x / 100 * courseRect.width,
            y: data.start.y / 100 * courseRect.height
        };
        const holePos = {
            x: data.hole.x / 100 * courseRect.width,
            y: data.hole.y / 100 * courseRect.height
        };

        // Reset ball animation
        ballElement.classList.remove('fall-in-hole');
        updateElementPosition(ballElement, ballPos);
        updateElementPosition(holeElement, holePos);

        // Clean up old obstacles
        currentObstacles.forEach(obs => obs.remove());
        currentObstacles = [];

        // Add new obstacles
        if (data.obstacles) {
            data.obstacles.forEach(obsData => {
                const obsElement = document.createElement('div');
                obsElement.classList.add('obstacle');
                // Add the type-specific class
                obsElement.classList.add(`obstacle-${obsData.type}`);

                const obsX = obsData.x / 100 * courseRect.width;
                const obsY = obsData.y / 100 * courseRect.height;
                const obsWidth = obsData.width / 100 * courseRect.width;
                const obsHeight = obsData.height / 100 * courseRect.height;

                obsElement.style.left = `${obsX}px`;
                obsElement.style.top = `${obsY}px`;
                obsElement.style.width = `${obsWidth}px`;
                obsElement.style.height = `${obsHeight}px`;

                // Store all necessary data for collision
                obsElement.dataset.obsType = obsData.type;
                obsElement.dataset.x = obsX;
                obsElement.dataset.y = obsY;
                obsElement.dataset.width = obsWidth;
                obsElement.dataset.height = obsHeight;

                courseElement.appendChild(obsElement);
                currentObstacles.push(obsElement);
            });
        }

        // Update the UI (with hole's Par)
        holeNumberElement.textContent = holeIndex + 1;
        holeParElement.textContent = data.par; // Display the hole's Par
        strokeCountElement.textContent = strokes;
        totalPar = holeData.slice(0, holeIndex + 1).reduce((sum, h) => sum + h.par, 0);
        totalParElement.textContent = totalPar;
        totalStrokesElement.textContent = totalStrokes;

        showMessage(`Hole ${holeIndex + 1} (Par ${data.par}). Aim your shot!`);
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

    // Function to check if the ball is in a sand area
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
                    return true; // The ball is in this sand trap
                }
            }
        }
        return false; // The ball is not in any sand trap
    }


    function update() {
        if (!isMoving) return;

        // Determine the applicable friction
        const currentFriction = isBallInSand(ballPos) ? SAND_FRICTION : NORMAL_FRICTION;

        // Apply friction
        ballVel.x *= currentFriction;
        ballVel.y *= currentFriction;

        // Update position
        const nextX = ballPos.x + ballVel.x;
        const nextY = ballPos.y + ballVel.y;
        let potentialCollision = false; // To avoid multiple bounces/actions per frame

        // --- Obstacle Collision Detection ---
        for (const obs of currentObstacles) {
            if (potentialCollision) break; // If already handled (water), move to the next frame

            const obsType = obs.dataset.obsType;
            const obsRect = { // Used for all rectangular types
                left: parseFloat(obs.dataset.x),
                top: parseFloat(obs.dataset.y),
                right: parseFloat(obs.dataset.x) + parseFloat(obs.dataset.width || 0), // width might be missing for circle
                bottom: parseFloat(obs.dataset.y) + parseFloat(obs.dataset.height || 0)
            };

            // AABB Check (for all rectangular types)
            const collidesRect = (
                nextX + BALL_RADIUS > obsRect.left &&
                nextX - BALL_RADIUS < obsRect.right &&
                nextY + BALL_RADIUS > obsRect.top &&
                nextY - BALL_RADIUS < obsRect.bottom
            );

            if (collidesRect) {
                if (obsType === 'water') {
                    showMessage(`Splash! ${WATER_PENALTY} stroke penalty.`, 'penalty');
                    strokes += WATER_PENALTY; // Add penalty
                    totalStrokes += WATER_PENALTY;
                    strokeCountElement.textContent = strokes;
                    totalStrokesElement.textContent = totalStrokes;

                    // Reset the ball to the start of the hole
                    const courseRect = courseElement.getBoundingClientRect();
                    ballPos = {
                        x: holeData[currentHoleIndex].start.x / 100 * courseRect.width,
                        y: holeData[currentHoleIndex].start.y / 100 * courseRect.height
                    };
                    ballVel = { x: 0, y: 0 };
                    isMoving = false;
                    potentialCollision = true; // Stop processing for this frame
                    updateElementPosition(ballElement, ballPos); // Update visually
                    setTimeout(() => showMessage(`Ready for stroke ${strokes + 1}.`), 1000); // Message after delay
                    break; // Exit the obstacles loop
                }
                else if (obsType === 'wall') {
                    // Wall collision (simple bounce as before)
                    let collideX = false;
                    let collideY = false;

                    // Check for collision on X
                    if (ballPos.y + BALL_RADIUS > obsRect.top && ballPos.y - BALL_RADIUS < obsRect.bottom) {
                        if ((ballPos.x + BALL_RADIUS <= obsRect.left && nextX + BALL_RADIUS > obsRect.left) ||
                            (ballPos.x - BALL_RADIUS >= obsRect.right && nextX - BALL_RADIUS < obsRect.right)) {
                            ballVel.x *= -1;
                            // Adjustment to avoid getting stuck
                            ballPos.x = (ballVel.x > 0) ? obsRect.left - BALL_RADIUS - 0.1 : obsRect.right + BALL_RADIUS + 0.1;
                            collideX = true;
                        }
                    }
                    // Check for collision on Y (if not already on X)
                    if (!collideX && ballPos.x + BALL_RADIUS > obsRect.left && ballPos.x - BALL_RADIUS < obsRect.right) {
                        if ((ballPos.y + BALL_RADIUS <= obsRect.top && nextY + BALL_RADIUS > obsRect.top) ||
                            (ballPos.y - BALL_RADIUS >= obsRect.bottom && nextY - BALL_RADIUS < obsRect.bottom)) {
                            ballVel.y *= -1;
                            ballPos.y = (ballVel.y > 0) ? obsRect.top - BALL_RADIUS - 0.1 : obsRect.bottom + BALL_RADIUS + 0.1;
                            collideY = true;
                        }
                    }
                    if (collideX || collideY) {
                        obs.classList.add('wall-hit');
                        setTimeout(() => obs.classList.remove('wall-hit'), 200);
                    }
                    potentialCollision = collideX || collideY; // Indicate that a collision occurred
                    // No need for 'break' here, as sand can be under a wall
                }
                else if (obsType === 'sand') {
                    // No special collision logic for sand,
                    // friction is handled by isBallInSand() at the beginning of the update.
                    // We continue the loop in case there is a wall under the sand.
                }
                // else if (obsType === 'circle') {
                //    // TODO: Add circle-circle collision logic if needed
                // }
            }
        } // End of obstacles loop

        // If a water collision occurred, we stop this frame
        if (potentialCollision && ballVel.x === 0 && ballVel.y === 0) {
            cancelAnimationFrame(animationFrameId);
            return;
        }

        // Update position if no reset due to water
        ballPos.x += ballVel.x;
        ballPos.y += ballVel.y;


        // --- Course Boundary Collision Detection ---
        const courseRect = courseElement.getBoundingClientRect();
        if (ballPos.x - BALL_RADIUS < 0) {
            ballPos.x = BALL_RADIUS;
            ballVel.x *= -0.8; // Bounce with energy loss
        } else if (ballPos.x + BALL_RADIUS > courseRect.width) {
            ballPos.x = courseRect.width - BALL_RADIUS;
            ballVel.x *= -0.8;
        }
        if (ballPos.y - BALL_RADIUS < 0) {
            ballPos.y = BALL_RADIUS;
            ballVel.y *= -0.8;
        } else if (ballPos.y + BALL_RADIUS > courseRect.height) {
            ballPos.y = courseRect.height - BALL_RADIUS;
            ballVel.y *= -0.8;
        }

        // Update visual position
        updateElementPosition(ballElement, ballPos);

        // --- Check if in the hole ---
        const holePos = getElementCenter(holeElement);
        const distToHole = distance(ballPos, holePos);

        if (distToHole < HOLE_RADIUS - BALL_RADIUS / 2 && Math.hypot(ballVel.x, ballVel.y) < 5) { // Speed condition to avoid "passing over"
            isMoving = false;
            cancelAnimationFrame(animationFrameId);
            ballElement.classList.add('fall-in-hole');

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
            }, 2000); // A bit longer delay
            return;
        }

        // --- Stop if velocity is low ---
        if (Math.hypot(ballVel.x, ballVel.y) < MIN_VELOCITY) {
            isMoving = false;
            ballVel = { x: 0, y: 0 };
            cancelAnimationFrame(animationFrameId);
            showMessage(`Ready for stroke ${strokes + 1}.`);
            return;
        }

        // Continue the animation
        animationFrameId = requestAnimationFrame(update);
    }

    // --- Mouse Handling --- (Power sensitivity adjustment)

    courseElement.addEventListener('mousedown', (event) => {
        if (isMoving) return;
        isAiming = true;
        const rect = courseElement.getBoundingClientRect();
        aimStartPos = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        // Aiming line
        aimLineElement.setAttribute('x1', ballPos.x);
        aimLineElement.setAttribute('y1', ballPos.y);
        aimLineElement.setAttribute('x2', ballPos.x);
        aimLineElement.setAttribute('y2', ballPos.y);
        aimLineElement.parentElement.style.visibility = 'visible';
        event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
        if (!isAiming) return;
        const rect = courseElement.getBoundingClientRect();
        const currentMousePos = { x: event.clientX - rect.left, y: event.clientY - rect.top };

        let dx = ballPos.x - currentMousePos.x;
        let dy = ballPos.y - currentMousePos.y;
        const dist = Math.hypot(dx, dy); // Shorter than Math.sqrt(dx*dx + dy*dy)

        // Visual line sensitivity adjustment
        const visualPowerRatio = Math.min(1, dist / (MAX_POWER * POWER_SENSITIVITY * 0.5)); // Adjust 0.5 for max visual length
        const endX = ballPos.x + dx * visualPowerRatio;
        const endY = ballPos.y + dy * visualPowerRatio;

        aimLineElement.setAttribute('x2', endX);
        aimLineElement.setAttribute('y2', endY);
    });

    document.addEventListener('mouseup', (event) => {
        if (!isAiming) return;
        isAiming = false;
        aimLineElement.parentElement.style.visibility = 'hidden';

        const rect = courseElement.getBoundingClientRect();
        const aimEndPos = { x: event.clientX - rect.left, y: event.clientY - rect.top };

        let dx = ballPos.x - aimEndPos.x;
        let dy = ballPos.y - aimEndPos.y;
        const power = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        // Adjust the actual power with sensitivity
        const actualPower = Math.min(power / POWER_SENSITIVITY, MAX_POWER);

        if (actualPower > 0.5) { // Minimum threshold to shoot
            ballVel.x = Math.cos(angle) * actualPower;
            ballVel.y = Math.sin(angle) * actualPower;

            strokes++;
            strokeCountElement.textContent = strokes;
            showMessage("In play!", 'info'); // Use the info type
            isMoving = true;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(update);
        } else {
            showMessage(`Ready for stroke ${strokes + 1}. Aim your shot!`);
        }
    });

    // Initialize the game
    setupHole(0);
    window.addEventListener('resize', () => setupHole(currentHoleIndex));
});