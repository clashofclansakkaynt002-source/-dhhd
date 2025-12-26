const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// === Game State ===
let gameState = 'loading'; // loading, start, aiming, powering, shooting, reset, gameover
let score = 0;
let attempts = 0;
let shake = 0; // Для ефекту тремтіння екрану
let level = 1; // Рівень складності воротаря та візуальні зміни
let currentArenaColor = { r: 0, g: 255, b: 255 }; // Поточний колір арени

// === Game Objects ===
let ball = { x: 400, y: 500, radius: 15, z: 1, vx: 0, vy: 0 }; // Додав vx, vy до м'яча
let aimAngle = -Math.PI / 2; // Приціл
let aimDir = 1; // Напрямок руху прицілу
let power = 0; // Сила удару
let powerDir = 1; // Напрямок зміни сили

const goal = { top: 180, left: 250, right: 550, bottom: 280 };
let keeper = { x: 400, y: 230, w: 60, h: 90, targetX: 400, reaction: 0.1 }; // Додав reaction для складності
let particles = []; // Для вибухів іскор
let trail = []; // Слід від м'яча

// === UI Elements ===
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const messageDisplay = document.getElementById('message');
const scoreDisplay = document.getElementById('score');
const attemptsDisplay = document.getElementById('attempts');
const finalScoreDisplay = document.getElementById('final-score');
const restartButton = document.getElementById('restart-button');

// === Core Game Loop ===
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    // Ефект тремтіння
    if (shake > 0) shake *= 0.9;
    if (shake < 0.5) shake = 0;

    switch (gameState) {
        case 'aiming':
            aimAngle += 0.03 * aimDir;
            if (Math.abs(aimAngle + Math.PI / 2) > 0.6) aimDir *= -1;
            // Воротар нервово рухається
            keeper.x += Math.sin(Date.now() / 300) * 1.5 * (1 + level * 0.1); 
            break;

        case 'powering':
            power += 2 * powerDir;
            if (power > 100 || power < 0) powerDir *= -1;
            break;

        case 'shooting':
            // Оновлення м'яча
            ball.x += ball.vx;
            ball.y += ball.vy;
            ball.z -= 0.015;
            ball.vy += 0.2; // Гравітація

            // Додаємо точку до сліду
            trail.push({ x: ball.x, y: ball.y, z: ball.z });
            if (trail.length > 15) trail.shift(); // Обмежуємо довжину сліду

            // Логіка воротаря: прогнозування
            let predictedX = ball.x + ball.vx * 10; // Проста симуляція
            keeper.targetX = Math.max(goal.left + keeper.w/2, Math.min(goal.right - keeper.w/2, predictedX));
            keeper.x += (keeper.targetX - keeper.x) * keeper.reaction * (1 + level * 0.05); // Реакція залежить від рівня

            // Перевірка зіткнення
            if (ball.z <= 0.5) checkCollision();
            break;
    }
    
    // Оновлення частинок
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function draw() {
    // Застосування тремтіння
    let shakeX = (Math.random() - 0.5) * shake;
    let shakeY = (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawDynamicBackground();
    drawGoal();
    drawKeeper();
    if (gameState === 'shooting') drawBallTrail();
    drawBall();
    if (gameState === 'aiming' || gameState === 'powering') drawUIElements();
    drawParticles();

    ctx.restore();
}

// === Drawing Functions ===
function drawDynamicBackground() {
    // Базовий градієнт фону
    let gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width);
    gradient.addColorStop(0, `rgb(${currentArenaColor.r * 0.1}, ${currentArenaColor.g * 0.1}, ${currentArenaColor.b * 0.1})`);
    gradient.addColorStop(1, '#050510');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Анімована сітка поля
    ctx.strokeStyle = `rgba(${currentArenaColor.r}, ${currentArenaColor.g}, ${currentArenaColor.b}, 0.15)`;
    ctx.lineWidth = 1;
    const gridOffset = (Date.now() / 100 % 40); // Анімація зміщення
    
    // Вертикальні лінії перспективи
    for (let x = -200; x <= canvas.width + 200; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x + gridOffset * 0.5, canvas.height);
        ctx.lineTo(canvas.width / 2 + (x - canvas.width / 2) * 0.2, goal.bottom);
        ctx.stroke();
    }
    // Горизонтальні лінії
    for (let y = goal.bottom; y <= canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(-100, y + gridOffset * 0.2); // Легке зміщення
        ctx.lineTo(canvas.width + 100, y + gridOffset * 0.2);
        ctx.stroke();
    }
}

function drawGoal() {
    ctx.shadowBlur = 25;
    ctx.shadowColor = `rgb(${currentArenaColor.r}, ${currentArenaColor.g}, ${currentArenaColor.b})`;
    ctx.strokeStyle = `rgb(${currentArenaColor.r}, ${currentArenaColor.g}, ${currentArenaColor.b})`;
    ctx.lineWidth = 5;
    
    ctx.beginPath();
    ctx.moveTo(goal.left - 20, goal.bottom); // Нижня ліва
    ctx.lineTo(goal.left, goal.top);         // Верхня ліва
    ctx.lineTo(goal.right, goal.top);        // Верхня права
    ctx.lineTo(goal.right + 20, goal.bottom); // Нижня права
    ctx.stroke();

    // Сітка воріт (тонша)
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    for(let i=goal.left; i<=goal.right; i+=20) {
        ctx.moveTo(i, goal.top);
        ctx.lineTo(i + (i-canvas.width/2)*0.05, goal.bottom); // Легка перспектива для сітки
    }
    for(let i=goal.top; i<=goal.bottom; i+=20) {
        ctx.moveTo(goal.left, i);
        ctx.lineTo(goal.right, i);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0; // Скидання тіні
}

function drawBall() {
    let r = ball.radius * ball.z;
    if (r < 0) r = 0; // Запобігаємо негативному радіусу

    // Ефект світіння м'яча
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#fff';
    
    // Градієнт для об'єму м'яча
    let grad = ctx.createRadialGradient(ball.x - r / 3, ball.y - r / 3, r / 4, ball.x, ball.y, r);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, '#ddd');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Скидання тіні
}

function drawBallTrail() {
    trail.forEach((t, i) => {
        ctx.globalAlpha = i / trail.length * 0.7; // Плавне зникнення
        ctx.fillStyle = `rgb(${currentArenaColor.r}, ${currentArenaColor.g}, ${currentArenaColor.b})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, ball.radius * t.z * 0.8, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function drawKeeper() {
    ctx.shadowBlur = 25;
    ctx.shadowColor = `rgb(${currentArenaColor.r}, ${currentArenaColor.g*0.5}, ${currentArenaColor.b*1.5})`; // Наприклад, фіолетовий відтінок
    ctx.fillStyle = `rgb(${currentArenaColor.r*0.8}, ${currentArenaColor.g*0.4}, ${currentArenaColor.b*1.2})`;
    
    // Анімація "дихання" / легкого руху
    let breathingOffset = Math.sin(Date.now() / 200) * 3;
    
    // Тіло
    ctx.fillRect(keeper.x - keeper.w / 2, keeper.y - keeper.h / 2 + breathingOffset, keeper.w, keeper.h);
    
    // Руки (більш виражені)
    ctx.fillRect(keeper.x - keeper.w / 2 - 15, keeper.y - 10 + breathingOffset, 15, 50);
    ctx.fillRect(keeper.x + keeper.w / 2, keeper.y - 10 + breathingOffset, 15, 50);

    // "Очі" або сенсори воротаря
    ctx.fillStyle = '#000';
    ctx.fillRect(keeper.x - 15, keeper.y - 30 + breathingOffset, 10, 5);
    ctx.fillRect(keeper.x + 5, keeper.y - 30 + breathingOffset, 10, 5);
    
    ctx.shadowBlur = 0;
}

function drawUIElements() {
    // Бар сили
    ctx.fillStyle = '#333';
    ctx.fillRect(canvas.width - 60, canvas.height - 200, 20, 150);
    
    let powerColor = `hsl(${120 - power}, 100%, 50%)`; // Зелений -> Жовтий -> Червоний
    ctx.fillStyle = powerColor;
    ctx.shadowColor = powerColor;
    ctx.shadowBlur = 15;
    let h = (power / 100) * 150;
    ctx.fillRect(canvas.width - 60, canvas.height - 50 - h, 20, h);
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '12px Orbitron';
    ctx.fillText('СИЛА', canvas.width - 70, canvas.height - 210);

    // Лінія прицілу
    if (gameState === 'aiming') {
        ctx.strokeStyle = '#ff0';
        ctx.setLineDash([8, 8]); // Пунктирна лінія
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ball.x + Math.cos(aimAngle) * 120, ball.y + Math.sin(aimAngle) * 120);
        ctx.stroke();
        ctx.setLineDash([]); // Скидання пунктиру
        ctx.lineWidth = 1;
    }
}

function drawParticles() {
    particles.forEach((p, i) => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// === Game Logic ===
function checkCollision() {
    gameState = 'reset';
    attempts++;

    let hitKeeper = (
        ball.x > keeper.x - keeper.w / 2 - 15 && ball.x < keeper.x + keeper.w / 2 + 15 && // З урахуванням рук
        ball.y > keeper.y - keeper.h / 2 - 10 && ball.y < keeper.y + keeper.h / 2 + 10
    );

    let inGoal = ball.x > goal.left && ball.x < goal.right && ball.y > goal.top && ball.y < goal.bottom;

    if (hitKeeper) {
        showMessage("ВІДБИТО!", "#f33", true);
        createExplosion(ball.x, ball.y, "#f33", 40);
        shake = 15;
    } else if (inGoal) {
        score++;
        level = Math.floor(score / 3) + 1; // Кожні 3 голи - новий рівень
        
        // Бонус за "Perfect Shot" (в дев'ятку з високою силою)
        const perfectShotZone = (ball.y < goal.top + 30 && (ball.x < goal.left + 50 || ball.x > goal.right - 50));
        if (perfectShotZone && power > 80) {
            score++; // Додатковий гол за ідеальний удар
            showMessage("ІДЕАЛЬНО! ГОЛ!", "#fff", true, `0 0 30px #0ff`);
            createExplosion(ball.x, ball.y, "#fff", 60);
        } else {
            showMessage("ГОЛ!", "#3f3", true);
            createExplosion(ball.x, ball.y, "#3f3", 50);
        }
        
        shake = 25;
        changeArenaColor(); // Зміна кольору арени
    } else {
        showMessage("ПОВЗ...", "#777", true);
        createExplosion(ball.x, ball.y, "#777", 20);
    }

    updateScoreDisplay();

    // Завершення гри, якщо не забив 3 рази поспіль (приклад, можна змінити)
    // if (score === attempts - 3) { // Якщо 3 промахи підряд
    //     setTimeout(showGameOver, 2000);
    // } else {
        setTimeout(resetGame, 2000);
    // }
}

function resetGame() {
    ball = { x: 400, y: 500, radius: 15, z: 1, vx: 0, vy: 0 };
    power = 0;
    keeper.x = 400;
    messageDisplay.classList.remove('active');
    gameState = 'aiming';
    trail = [];
}

function startGame() {
    gameState = 'aiming';
    score = 0;
    attempts = 0;
    level = 1;
    updateScoreDisplay();
    resetGame();
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
}

function showGameOver() {
    gameState = 'gameover';
    finalScoreDisplay.innerText = score;
    gameOverScreen.classList.add('active');
}

function updateScoreDisplay() {
    scoreDisplay.innerText = score;
    attemptsDisplay.innerText = attempts;
}

function showMessage(text, color, temporary = true, shadow = `0 0 20px ${color}`) {
    messageDisplay.innerText = text;
    messageDisplay.style.color = color;
    messageDisplay.style.textShadow = shadow;
    messageDisplay.classList.add('active');
    if (temporary) {
        // Додаємо невеликий імпульс для анімації
        setTimeout(() => {
            messageDisplay.classList.remove('active');
        }, 1500); // Зникає через 1.5 секунди
    }
}

function createExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1.0,
            color: color
        });
    }
}

function changeArenaColor() {
    // Зміна кольору кожні 5 голів
    const colorSchemes = [
        { r: 0, g: 255, b: 255 }, // Cyan
        { r: 255, g: 0, b: 255 }, // Magenta
        { r: 255, g: 255, b: 0 }, // Yellow
        { r: 0, g: 255, b: 0 },   // Green
        { r: 0, g: 100, b: 255 }  // Blue
    ];
    currentArenaColor = colorSchemes[(Math.floor(score / 5)) % colorSchemes.length];
}

// === Event Listeners ===
window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(); }, { passive: false });
restartButton.addEventListener('click', startGame);
startScreen.addEventListener('click', startGame);

function handleInput() {
    if (gameState === 'start') {
        startGame();
    } else if (gameState === 'aiming') {
        gameState = 'powering';
    } else if (gameState === 'powering') {
        gameState = 'shooting';
        let speed = 15 + (power / 100) * 15;
        ball.vx = Math.cos(aimAngle) * speed * 0.5; // X-компонента
        ball.vy = Math.sin(aimAngle) * speed;       // Y-компонента (вгору)
    }
}

// Initial setup
startScreen.classList.add('active');
gameLoop(); // Починаємо ігровий цикл, але гра чекає на старт
