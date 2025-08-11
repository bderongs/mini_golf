document.addEventListener('DOMContentLoaded', () => {
    // Références DOM (ajout holeParElement)
    const ballElement = document.getElementById('ball');
    const holeElement = document.getElementById('hole');
    const courseElement = document.getElementById('course');
    const strokeCountElement = document.getElementById('stroke-count');
    const holeNumberElement = document.getElementById('hole-number');
    const holeParElement = document.getElementById('hole-par'); // Ajout
    const messageAreaElement = document.getElementById('message-area');
    const totalParElement = document.getElementById('total-par');
    const totalStrokesElement = document.getElementById('total-strokes');
    const aimLineElement = document.getElementById('aim-line').querySelector('line');

    // Constantes du jeu (ajout SAND_FRICTION)
    const NORMAL_FRICTION = 0.985; // Légèrement moins de friction par défaut
    const SAND_FRICTION = 0.88;  // Friction élevée dans le sable
    const MIN_VELOCITY = 0.08; // Réduit pour le sable
    const MAX_POWER = 18;      // Légèrement plus de puissance max
    const POWER_SENSITIVITY = 12; // Diviseur pour la sensibilité de puissance
    const HOLE_RADIUS = 15;
    const BALL_RADIUS = 10;
    const WATER_PENALTY = 1; // Nombre de coups de pénalité pour l'eau

    // Données des trous (avec nouveaux types d'obstacles)
    const holeData = [
        // Trou 1: Simple
        { start: { x: 60, y: 225 }, hole: { x: 640, y: 225 }, par: 3, obstacles: [] },
        // Trou 2: Mur central
        {
            start: { x: 60, y: 60 }, hole: { x: 640, y: 390 }, par: 4, obstacles: [
                { x: 330, y: 100, width: 40, height: 250, type: 'wall' }
            ]
        },
        // Trou 3: Obstacle d'eau
        {
            start: { x: 60, y: 225 }, hole: { x: 640, y: 225 }, par: 4, obstacles: [
                { x: 250, y: 150, width: 200, height: 150, type: 'water' }
            ]
        },
        // Trou 4: Bunker de sable avant le trou
        {
            start: { x: 100, y: 390 }, hole: { x: 600, y: 60 }, par: 5, obstacles: [
                { x: 450, y: 80, width: 200, height: 100, type: 'sand' },
                { x: 150, y: 150, width: 200, height: 50, type: 'wall' }
            ]
        },
        // Trou 5: Combinaison Eau et Sable
        {
            start: { x: 60, y: 60 }, hole: { x: 640, y: 390 }, par: 5, obstacles: [
                { x: 150, y: 0, width: 100, height: 250, type: 'water' },
                { x: 450, y: 200, width: 100, height: 250, type: 'water' },
                { x: 300, y: 180, width: 100, height: 90, type: 'sand' }
            ]
        },
        // Trou 6: Obstacle Circulaire (exemple - collision à ajouter si besoin)
        // { start: { x: 50, y: 225 }, hole: { x: 650, y: 225 }, par: 4, obstacles: [
        //     { x: 350, y: 225, radius: 30, type: 'circle' } // Centre x,y et rayon
        // ]},
    ];

    // État du jeu
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

    // --- Fonctions Utilitaires --- (inchangées pour la plupart)
    function getElementCenter(element) { /* ... idem ... */
        const rect = element.getBoundingClientRect();
        return {
            x: element.offsetLeft + rect.width / 2,
            y: element.offsetTop + rect.height / 2
        };
    }
    function distance(p1, p2) { /* ... idem ... */
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
    function updateElementPosition(element, pos) { /* ... idem ... */
        element.style.left = `${pos.x}px`;
        element.style.top = `${pos.y}px`;
    }
    // Fonction message avec classes CSS pour style
    function showMessage(msg, type = 'info') { // 'info', 'success', 'penalty'
        messageAreaElement.textContent = msg;
        messageAreaElement.className = 'message-area'; // Reset classes
        if (type === 'success') {
            messageAreaElement.classList.add('success');
        } else if (type === 'penalty') {
            messageAreaElement.classList.add('penalty');
        }
    }

    // --- Logique du Jeu ---

    function setupHole(holeIndex) {
        if (holeIndex >= holeData.length) {
            gameOver();
            return;
        }

        const data = holeData[holeIndex];
        currentHoleIndex = holeIndex;
        strokes = 0;
        isMoving = false;
        ballVel = { x: 0, y: 0 };

        ballPos = { ...data.start };
        const holePos = { ...data.hole };

        updateElementPosition(ballElement, ballPos);
        updateElementPosition(holeElement, holePos);

        // Nettoyer les anciens obstacles
        currentObstacles.forEach(obs => obs.remove());
        currentObstacles = [];

        // Ajouter les nouveaux obstacles
        if (data.obstacles) {
            data.obstacles.forEach(obsData => {
                const obsElement = document.createElement('div');
                obsElement.classList.add('obstacle');
                // Ajouter la classe spécifique au type
                obsElement.classList.add(`obstacle-${obsData.type}`);

                obsElement.style.left = `${obsData.x}px`;
                obsElement.style.top = `${obsData.y}px`;
                // Stocker toutes les données nécessaires pour la collision
                obsElement.dataset.obsType = obsData.type;
                obsElement.dataset.x = obsData.x;
                obsElement.dataset.y = obsData.y;

                if (obsData.type === 'circle') {
                    // Pour les cercles, on stocke le rayon et on utilise width/height pour la taille visuelle
                    const diameter = obsData.radius * 2;
                    obsElement.style.width = `${diameter}px`;
                    obsElement.style.height = `${diameter}px`;
                    // On centre via left/top - rayon
                    obsElement.style.left = `${obsData.x - obsData.radius}px`;
                    obsElement.style.top = `${obsData.y - obsData.radius}px`;
                    obsElement.dataset.radius = obsData.radius;
                } else { // Rectangles (wall, water, sand)
                    obsElement.style.width = `${obsData.width}px`;
                    obsElement.style.height = `${obsData.height}px`;
                    obsElement.dataset.width = obsData.width;
                    obsElement.dataset.height = obsData.height;
                }

                courseElement.appendChild(obsElement);
                currentObstacles.push(obsElement);
            });
        }

        // Mettre à jour l'UI (ajout Par du trou)
        holeNumberElement.textContent = holeIndex + 1;
        holeParElement.textContent = data.par; // Afficher le Par du trou
        strokeCountElement.textContent = strokes;
        totalPar = holeData.slice(0, holeIndex + 1).reduce((sum, h) => sum + h.par, 0);
        totalParElement.textContent = totalPar;
        totalStrokesElement.textContent = totalStrokes;

        showMessage(`Trou ${holeIndex + 1} (Par ${data.par}). Visez !`);
        aimLineElement.parentElement.style.visibility = 'hidden';
    }

    function gameOver() {
        let message = `Partie terminée ! Score total: ${totalStrokes}`;
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

    // Fonction pour vérifier si la balle est dans une zone de sable
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
                    return true; // La balle est dans ce banc de sable
                }
            }
        }
        return false; // La balle n'est dans aucun banc de sable
    }


    function update() {
        if (!isMoving) return;

        // Déterminer la friction applicable
        const currentFriction = isBallInSand(ballPos) ? SAND_FRICTION : NORMAL_FRICTION;

        // Appliquer la friction
        ballVel.x *= currentFriction;
        ballVel.y *= currentFriction;

        // Mettre à jour la position
        const nextX = ballPos.x + ballVel.x;
        const nextY = ballPos.y + ballVel.y;
        let potentialCollision = false; // Pour éviter multiples rebonds/actions par frame

        // --- Détection Collisions Obstacles ---
        for (const obs of currentObstacles) {
            if (potentialCollision) break; // Si déjà géré (eau), passer au frame suivant

            const obsType = obs.dataset.obsType;
            const obsRect = { // Utilisé pour tous les types rectangulaires
                left: parseFloat(obs.dataset.x),
                top: parseFloat(obs.dataset.y),
                right: parseFloat(obs.dataset.x) + parseFloat(obs.dataset.width || 0), // width peut manquer pour circle
                bottom: parseFloat(obs.dataset.y) + parseFloat(obs.dataset.height || 0)
            };

            // AABB Check (pour tous les types rectangulaires)
            const collidesRect = (
                nextX + BALL_RADIUS > obsRect.left &&
                nextX - BALL_RADIUS < obsRect.right &&
                nextY + BALL_RADIUS > obsRect.top &&
                nextY - BALL_RADIUS < obsRect.bottom
            );

            if (collidesRect) {
                if (obsType === 'water') {
                    showMessage(`Splash ! Pénalité de ${WATER_PENALTY} coup(s).`, 'penalty');
                    strokes += WATER_PENALTY; // Ajouter pénalité
                    totalStrokes += WATER_PENALTY;
                    strokeCountElement.textContent = strokes;
                    totalStrokesElement.textContent = totalStrokes;
                    // Remettre la balle au début du trou
                    ballPos = { ...holeData[currentHoleIndex].start };
                    ballVel = { x: 0, y: 0 };
                    isMoving = false;
                    potentialCollision = true; // Arrêter le traitement pour ce frame
                    updateElementPosition(ballElement, ballPos); // Mettre à jour visuellement
                    setTimeout(() => showMessage(`Prêt pour le coup ${strokes + 1}.`), 1000); // Message après délai
                    break; // Sortir de la boucle des obstacles
                }
                else if (obsType === 'wall') {
                    // Collision Mur (rebond simple comme avant)
                    let collideX = false;
                    let collideY = false;

                    // Vérifier si collision sur X
                    if (ballPos.y + BALL_RADIUS > obsRect.top && ballPos.y - BALL_RADIUS < obsRect.bottom) {
                        if ((ballPos.x + BALL_RADIUS <= obsRect.left && nextX + BALL_RADIUS > obsRect.left) ||
                            (ballPos.x - BALL_RADIUS >= obsRect.right && nextX - BALL_RADIUS < obsRect.right)) {
                            ballVel.x *= -1;
                            // Ajustement pour éviter de rester coincé
                            ballPos.x = (ballVel.x > 0) ? obsRect.left - BALL_RADIUS - 0.1 : obsRect.right + BALL_RADIUS + 0.1;
                            collideX = true;
                        }
                    }
                    // Vérifier si collision sur Y (si pas déjà X)
                    if (!collideX && ballPos.x + BALL_RADIUS > obsRect.left && ballPos.x - BALL_RADIUS < obsRect.right) {
                        if ((ballPos.y + BALL_RADIUS <= obsRect.top && nextY + BALL_RADIUS > obsRect.top) ||
                            (ballPos.y - BALL_RADIUS >= obsRect.bottom && nextY - BALL_RADIUS < obsRect.bottom)) {
                            ballVel.y *= -1;
                            ballPos.y = (ballVel.y > 0) ? obsRect.top - BALL_RADIUS - 0.1 : obsRect.bottom + BALL_RADIUS + 0.1;
                            collideY = true;
                        }
                    }
                    potentialCollision = collideX || collideY; // Indiquer qu'une collision a eu lieu
                    // Pas besoin de 'break' ici, car le sable peut être sous un mur
                }
                else if (obsType === 'sand') {
                    // Pas de logique de collision spéciale pour le sable,
                    // la friction est gérée par isBallInSand() au début de l'update.
                    // On continue la boucle au cas où il y aurait un mur sous le sable.
                }
                // else if (obsType === 'circle') {
                //    // TODO: Ajouter logique de collision cercle-cercle si besoin
                // }
            }
        } // Fin boucle obstacles

        // Si collision Eau a eu lieu, on arrête ce frame
        if (potentialCollision && ballVel.x === 0 && ballVel.y === 0) {
            cancelAnimationFrame(animationFrameId);
            return;
        }

        // Mettre à jour la position si pas de reset dû à l'eau
        ballPos.x += ballVel.x;
        ballPos.y += ballVel.y;


        // --- Détection collisions Bords Terrain ---
        const courseRect = courseElement.getBoundingClientRect();
        if (ballPos.x - BALL_RADIUS < 0) {
            ballPos.x = BALL_RADIUS;
            ballVel.x *= -0.8; // Rebond avec perte d'énergie
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

        // Mettre à jour la position visuelle
        updateElementPosition(ballElement, ballPos);

        // --- Vérifier si dans le trou ---
        const holePos = getElementCenter(holeElement);
        const distToHole = distance(ballPos, holePos);

        if (distToHole < HOLE_RADIUS && Math.hypot(ballVel.x, ballVel.y) < 2) { // The center of the ball is over the hole and the speed is low
            isMoving = false;
            ballVel = { x: 0, y: 0 };
            cancelAnimationFrame(animationFrameId);
            const holePar = holeData[currentHoleIndex].par;
            let scoreMsg = "";
            if (strokes === 1) scoreMsg = " (Trou en un !)";
            else if (strokes < holePar) scoreMsg = ` (${strokes - holePar} sous le par, Birdie/Eagle!)`;
            else if (strokes === holePar) scoreMsg = " (Par)";
            else scoreMsg = ` (+${strokes - holePar} au dessus du par)`;

            showMessage(`Trou ${currentHoleIndex + 1} réussi en ${strokes} coups !${scoreMsg}`, 'success');
            totalStrokes += strokes;
            totalStrokesElement.textContent = totalStrokes;

            setTimeout(() => {
                setupHole(currentHoleIndex + 1);
            }, 2000); // Délai un peu plus long
            return;
        }

        // --- Arrêter si vitesse faible ---
        if (Math.hypot(ballVel.x, ballVel.y) < MIN_VELOCITY) {
            isMoving = false;
            ballVel = { x: 0, y: 0 };
            cancelAnimationFrame(animationFrameId);
            showMessage(`Prêt pour le coup ${strokes + 1}.`);
            return;
        }

        // Continuer l'animation
        animationFrameId = requestAnimationFrame(update);
    }

    // --- Gestion Souris --- (Ajustement sensibilité puissance)

    courseElement.addEventListener('mousedown', (event) => {
        if (isMoving) return;
        isAiming = true;
        const rect = courseElement.getBoundingClientRect();
        aimStartPos = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        // Ligne de visée
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
        const dist = Math.hypot(dx, dy); // Plus court que Math.sqrt(dx*dx + dy*dy)

        // Ajustement sensibilité visuelle ligne
        const visualPowerRatio = Math.min(1, dist / (MAX_POWER * POWER_SENSITIVITY * 0.5)); // Ajuster le 0.5 pour la longueur max visuelle
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

        // Ajuster la puissance réelle avec sensibilité
        const actualPower = Math.min(power / POWER_SENSITIVITY, MAX_POWER);

        if (actualPower > 0.5) { // Seuil minimum pour tirer
            ballVel.x = Math.cos(angle) * actualPower;
            ballVel.y = Math.sin(angle) * actualPower;

            strokes++;
            strokeCountElement.textContent = strokes;
            showMessage("En jeu !", 'info'); // Utiliser le type info
            isMoving = true;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(update);
        } else {
            showMessage(`Prêt pour le coup ${strokes + 1}. Visez !`);
        }
    });

    // Initialiser le jeu
    setupHole(0);
});