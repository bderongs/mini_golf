document.addEventListener('DOMContentLoaded', () => {
    // --- Canvas and 2D Context ---
    const canvas = document.getElementById('course-canvas');
    const ctx = canvas.getContext('2d');

    // --- DOM References (for UI outside the canvas) ---
    const levelSelectionScreen = document.getElementById('level-selection-screen');
    const gameUI = document.getElementById('game-ui');
    const playAllBtn = document.getElementById('play-all-btn');

    // --- Game State ---
    let animationFrameId = null;
    const holeData = [
        {
            "name": "Test Course 1",
            "par": 3,
            "start": { "x": 10, "y": 50 },
            "hole": { "x": 90, "y": 50 },
            "obstacles": [
                {
                    "type": "fairway",
                    "shape": { "type": "oval", "cx": 50, "cy": 50, "rx": 45, "ry": 25 }
                },
                {
                    "type": "green",
                    "shape": { "type": "circle", "cx": 90, "cy": 50, "radius": 10 }
                }
            ]
        }
    ];
    let currentHoleIndex = 0;
    let currentCourse = null;
    let strokes = 0;
    let ballPos = { x: 50, y: 50, z: 0 };
    let holePos = { x: 650, y: 225 };
    let renderableObstacles = [];


    // --- Game Logic ---
    function setupHole(holeIndex) {
        if (holeIndex >= holeData.length) {
            // gameOver(); // We'll add this later
            console.log("Game over or course not found");
            return;
        }
        currentHoleIndex = holeIndex;
        currentCourse = holeData[holeIndex];

        strokes = 0;

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
                }
                renderableObstacles.push(visualShape);
            });
        });

        holeNumberElement.textContent = holeIndex + 1;
        holeParElement.textContent = currentCourse.par;
        strokeCountElement.textContent = strokes;
    }

    // --- Screen Management ---
    function showLevelSelection() {
        levelSelectionScreen.style.display = 'block';
        gameUI.style.display = 'none';
        // We will add level list creation here later
    }

    function showGameUI() {
        levelSelectionScreen.style.display = 'none';
        gameUI.style.display = 'block';
    }

    playAllBtn.addEventListener('click', () => {
        showGameUI();
        setupHole(0);
    });


    // --- Game Loop ---
    function updatePhysics() {
        // To be implemented
    }

    const terrainColors = {
        fairway: '#4caf50',
        sand: '#F4A460',
        water: '#1E90FF',
        rough: '#000000',
        green: '#90EE90'
    };

    function drawRect(shape, ctx) { ctx.fillRect(shape.x, shape.y, shape.width, shape.height); }
    function drawCircle(shape, ctx) { ctx.beginPath(); ctx.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2); ctx.fill(); }
    function drawOval(shape, ctx) { ctx.beginPath(); ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2); ctx.fill(); }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = terrainColors.rough;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!currentCourse) return; // Don't render if no course is loaded

        renderableObstacles.forEach(shape => {
            ctx.fillStyle = terrainColors[shape.terrainType] || '#CCCCCC';
            if (shape.type === 'rect') drawRect(shape, ctx);
            else if (shape.type === 'circle') drawCircle(shape, ctx);
            else if (shape.type === 'oval') drawOval(shape, ctx);
        });

        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(holePos.x, holePos.y, 16, 0, Math.PI * 2); // HOLE_RADIUS
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ballPos.x, ballPos.y, 10, 0, Math.PI * 2); // BALL_RADIUS
        ctx.fill();
    }

    function gameLoop() {
        updatePhysics();
        render();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- Initialization ---
    function initializeGame() {
        showLevelSelection();
        gameLoop();
    }

    initializeGame();
});