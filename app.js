//-----------------------------------------------------
// 1. Создаём приложение Pixi
//-----------------------------------------------------
const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x1099bb,
  resizeTo: window
});
document.body.appendChild(app.view);

// Разрешим сортировку по Z, чтобы текст/GUI рисовались поверх
app.stage.sortableChildren = true;

//-----------------------------------------------------
// 2. Параметры игры
//-----------------------------------------------------
const maxHP = 10;
let playerHP = maxHP;
let playerScore = 0; // Очки игрока

// Для врагов сделаем отдельно текущие показатели
let enemyHP = 10;              // HP у текущего врага
let enemyMaxHP = 10;           // Чтобы обновлять шкалу
let currentFloor = 1;          // Этаж "башни"

// Размеры/позиции
const playerRadius = 30; 
const enemyHeight = 60;
const HP_BAR_WIDTH = 100;

//-----------------------------------------------------
// 3. Фон (небо, земля, дорожка, солнце, деревья)
//-----------------------------------------------------
const background = new PIXI.Graphics();
background.beginFill(0x87ceeb); 
background.drawRect(0, 0, app.screen.width, app.screen.height / 2);
background.endFill();

background.beginFill(0x654321);
background.drawRect(
  0, 
  app.screen.height / 2, 
  app.screen.width, 
  app.screen.height / 2
);
background.endFill();
app.stage.addChild(background);

const path = new PIXI.Graphics();
path.beginFill(0x888888);
path.drawRect(
  app.screen.width * 0.2,
  app.screen.height / 2,
  app.screen.width * 0.6,
  app.screen.height / 2
);
path.endFill();
app.stage.addChild(path);

// Солнце
const sun = new PIXI.Graphics();
sun.beginFill(0xffff00);
sun.drawCircle(0, 0, 40);
sun.endFill();
sun.x = app.screen.width - 80;
sun.y = 80;
app.stage.addChild(sun);

// Деревья (пример)
for (let i = 0; i < 3; i++) {
  const tree = new PIXI.Graphics();
  // ствол
  tree.beginFill(0x8B4513);
  tree.drawRect(0, 0, 20, 60);
  tree.endFill();
  // крона
  tree.beginFill(0x228B22);
  tree.drawCircle(10, -10, 30);
  tree.endFill();

  tree.x = 100 + i * 250;
  tree.y = app.screen.height / 2 - 60;
  app.stage.addChild(tree);
}

//-----------------------------------------------------
// 4. Персонажи: наш (круг) и враг (треугольник)
//-----------------------------------------------------
const player = new PIXI.Graphics();
player.beginFill(0x0000ff);
player.drawCircle(0, 0, playerRadius);
player.endFill();
player.x = app.screen.width * 0.3;
player.y = app.screen.height * 0.55;
app.stage.addChild(player);

const enemy = new PIXI.Graphics();
enemy.beginFill(0xff0000);
enemy.drawPolygon([
  0, -enemyHeight/2,
  enemyHeight/2, enemyHeight/2,
  -enemyHeight/2, enemyHeight/2
]);
enemy.endFill();
enemy.x = app.screen.width * 0.7;
enemy.y = app.screen.height * 0.55;
app.stage.addChild(enemy);

// Исходные позиции (анимация)
const playerStartX = player.x;
let enemyStartX = enemy.x;

const meetingXPlayer = app.screen.width * 0.5 - 60;
let meetingXEnemy  = app.screen.width * 0.5 + 60; 

//-----------------------------------------------------
// 5. Полоски здоровья: над головами (игрока и врага)
//-----------------------------------------------------
function createHPBar(width, height, maxValue) {
  const container = new PIXI.Container();

  const border = new PIXI.Graphics();
  border.lineStyle(2, 0x000000);
  border.drawRect(0, 0, width, height);
  container.addChild(border);

  const bar = new PIXI.Graphics();
  bar.beginFill(0xff0000);
  bar.drawRect(0, 0, width, height);
  bar.endFill();
  container.addChild(bar);

  const style = new PIXI.TextStyle({
    fill: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    align: 'center',
  });
  const text = new PIXI.Text(`${maxValue}/${maxValue}`, style);
  text.anchor.set(0.5);
  text.x = width / 2;
  text.y = height / 2;
  container.addChild(text);

  return { container, bar, text, maxValue };
}

// Игрок
const playerHPBar = createHPBar(HP_BAR_WIDTH, 16, maxHP);
app.stage.addChild(playerHPBar.container);

// Враг
let enemyHPBar = createHPBar(HP_BAR_WIDTH, 16, enemyMaxHP);
app.stage.addChild(enemyHPBar.container);

function updateHPBar(barObj, currentHP) {
  const ratio = currentHP / barObj.maxValue;
  barObj.bar.width = HP_BAR_WIDTH * ratio;
  barObj.text.text = `${currentHP}/${barObj.maxValue}`;
}

// Позиционирование HP-бара
function positionHPBars() {
  // Игрок
  playerHPBar.container.x = player.x - HP_BAR_WIDTH/2;
  playerHPBar.container.y = player.y - (playerRadius + 10 + 16);

  // Враг
  enemyHPBar.container.x = enemy.x - HP_BAR_WIDTH/2;
  enemyHPBar.container.y = enemy.y - (enemyHeight/2 + 10 + 16);
}

// Изначально
updateHPBar(playerHPBar, playerHP);
updateHPBar(enemyHPBar, enemyHP);
positionHPBars();

//-----------------------------------------------------
// 6. Интерфейс: вверху (Block / Attack), внизу кнопка FIGHT
//-----------------------------------------------------
const blockOptions = ["head", "body", "groin"];
const attackOptions = ["head", "body", "groin"];

let selectedBlock = null;
let selectedAttack = null;

const uiContainer = new PIXI.Container();
uiContainer.x = 10;
uiContainer.y = 10;
app.stage.addChild(uiContainer);

// Блоки (Block)
const blockContainer = new PIXI.Container();
uiContainer.addChild(blockContainer);

const labelStyle = new PIXI.TextStyle({
  fill: '#000000',
  fontSize: 16,
  fontWeight: 'bold',
});
const blockLabel = new PIXI.Text("Block:", labelStyle);
blockContainer.addChild(blockLabel);

// Функция создания кнопки
function createButton(label, width = 80, height = 30) {
  const button = new PIXI.Container();

  const bg = new PIXI.Graphics();
  bg.beginFill(0x333333);
  bg.drawRect(0, 0, width, height);
  bg.endFill();
  button.addChild(bg);

  const txtStyle = new PIXI.TextStyle({
    fill: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  });
  const text = new PIXI.Text(label, txtStyle);
  text.anchor.set(0.5);
  text.x = width / 2;
  text.y = height / 2;
  button.addChild(text);

  button.bg = bg;
  button.txt = text;

  return button;
}

// Кнопки блока
blockOptions.forEach((option, i) => {
  const btn = createButton(option);
  btn.y = 30 + i * 40;
  blockContainer.addChild(btn);

  btn.interactive = true;
  btn.buttonMode = true;
  btn.on("pointerdown", () => {
    selectedBlock = option;
    updateBlockButtons();
  });
});

function updateBlockButtons() {
  blockContainer.children.forEach(child => {
    if (!child.txt) return;
    if (child.txt.text === selectedBlock) {
      child.bg.tint = 0x55AA55;
      child.bg.alpha = 1.0;
    } else {
      child.bg.tint = 0xffffff;
      child.bg.alpha = 0.5;
    }
  });
}
updateBlockButtons();

// Атаки (Attack)
const attackContainer = new PIXI.Container();
attackContainer.x = 120; 
uiContainer.addChild(attackContainer);

const attackLabel = new PIXI.Text("Attack:", labelStyle);
attackContainer.addChild(attackLabel);

attackOptions.forEach((option, i) => {
  const btn = createButton(option);
  btn.y = 30 + i * 40;
  attackContainer.addChild(btn);

  btn.interactive = true;
  btn.buttonMode = true;
  btn.on("pointerdown", () => {
    selectedAttack = option;
    updateAttackButtons();
  });
});

function updateAttackButtons() {
  attackContainer.children.forEach(child => {
    if (!child.txt) return;
    if (child.txt.text === selectedAttack) {
      child.bg.tint = 0xAA5555;
      child.bg.alpha = 1.0;
    } else {
      child.bg.tint = 0xffffff;
      child.bg.alpha = 0.5;
    }
  });
}
updateAttackButtons();

// Кнопка FIGHT (внизу слева)
const fightButton = createButton("FIGHT", 100, 40);
fightButton.x = 20;
fightButton.y = app.screen.height - 60;
app.stage.addChild(fightButton);

fightButton.interactive = true;
fightButton.buttonMode = true;
fightButton.on("pointerdown", () => {
  startFightAnimation();
});

//-----------------------------------------------------
// Кнопка инвентаря (внизу справа)
//-----------------------------------------------------
const inventoryButton = new PIXI.Container();
const inventoryIcon = PIXI.Sprite.from('./inventory_icon.png'); // Замените на путь к вашей иконке
inventoryIcon.width = 512;
inventoryIcon.height = 512;
inventoryButton.addChild(inventoryIcon);

inventoryButton.x = app.screen.width - 70;
inventoryButton.y = app.screen.height - 70;
app.stage.addChild(inventoryButton);

inventoryButton.interactive = true;
inventoryButton.buttonMode = true;

//-----------------------------------------------------
// 7. Анимация столкновений
//-----------------------------------------------------
let isFighting = false;
let fightPhase = 0;
let fightFrame = 0;

const approachFrames = 30;
const collisionFrames = 10;
const retreatFrames = 30;

function startFightAnimation() {
  if (isFighting) return;
  if (!selectedBlock || !selectedAttack) {
    console.log("Сначала выберите Block и Attack!");
    return;
  }
  isFighting = true;
  fightPhase = 0;
  fightFrame = 0;
}

//-----------------------------------------------------
// 8. Логика боя (с механикой появления нового врага)
//-----------------------------------------------------
function getDamage(attackPart) {
  switch (attackPart) {
    case "head":  return 3;
    case "groin": return 2;
    default:      return 1; 
  }
}

function doDamagePhase() {
  // Враг рандомно выбирает
  const enemyBlock = blockOptions[Math.floor(Math.random() * blockOptions.length)];
  const enemyAttack = attackOptions[Math.floor(Math.random() * attackOptions.length)];

  console.log(`Игрок блокирует: ${selectedBlock}, атакует: ${selectedAttack}`);
  console.log(`Враг блокирует: ${enemyBlock}, атакует: ${enemyAttack}`);

  // 1) Игрок бьёт
  if (enemyBlock !== selectedAttack) {
    const damage = getDamage(selectedAttack);
    enemyHP -= damage;
    playerScore += damage; // Добавляем очки за урон
    if (enemyHP < 0) enemyHP = 0;
    updateHPBar(enemyHPBar, enemyHP);
  }

  // 2) Если враг не умер - он бьёт
  if (enemyHP > 0) {
    if (selectedBlock !== enemyAttack) {
      playerHP -= getDamage(enemyAttack);
      if (playerHP < 0) playerHP = 0;
      updateHPBar(playerHPBar, playerHP);
    }
  }

  // Если игрок умер, выводим результат
  if (playerHP <= 0) {
    endGame();
  }

  // Если враг умер, появляем нового
  if (enemyHP <= 0 && fightPhase === 1) {
    setTimeout(() => {
      spawnNewEnemy();
    }, 500); // Ожидаем завершения анимации
  }
}

//-----------------------------------------------------
// 9. Появление нового врага (spawnNewEnemy)
//-----------------------------------------------------
function spawnNewEnemy() {
  currentFloor += 1;   // следующий этаж
  enemyMaxHP = 10 + (currentFloor - 1) * 2;
  enemyHP = enemyMaxHP;

  // Удаляем старый HP-бар врага и создаём новый
  app.stage.removeChild(enemyHPBar.container);
  enemyHPBar = createHPBar(HP_BAR_WIDTH, 16, enemyMaxHP);
  app.stage.addChild(enemyHPBar.container);
  updateHPBar(enemyHPBar, enemyHP);

  // Сбрасываем позицию врага
  enemy.x = app.screen.width * 0.7;
  enemy.y = app.screen.height * 0.55;
  enemyStartX = enemy.x;
  meetingXEnemy = app.screen.width * 0.5 + 60;

  console.log(`Появился новый враг (этаж ${currentFloor}), HP=${enemyHP}`);
}

//-----------------------------------------------------
// 10. Завершение игры
//-----------------------------------------------------
function endGame() {
  console.log("Игра окончена!");
  const resultText = new PIXI.Text(
    `Вы дошли до этажа ${currentFloor}\nОчки: ${playerScore}`,
    { fill: "#ffffff", fontSize: 24, fontWeight: "bold", align: "center" }
  );
  resultText.anchor.set(0.5);
  resultText.x = app.screen.width / 2;
  resultText.y = app.screen.height / 2 - 50;
  app.stage.addChild(resultText);

  const newGameButton = createButton("Новая игра", 150, 50);
  newGameButton.x = app.screen.width / 2 - 75;
  newGameButton.y = app.screen.height / 2 + 50;
  app.stage.addChild(newGameButton);

  newGameButton.interactive = true;
  newGameButton.buttonMode = true;
  newGameButton.on("pointerdown", () => {
    location.reload(); // Перезагрузка игры
  });
}

//-----------------------------------------------------
// 11. Игровой цикл (ticker)
//-----------------------------------------------------
app.ticker.add(() => {
  positionHPBars(); // Держим HP-бары над головой

  if (!isFighting) return;

  fightFrame++;

  if (fightPhase === 0) {
    // Фаза подхода
    const alpha = fightFrame / approachFrames;
    player.x = playerStartX + (meetingXPlayer - playerStartX) * alpha;
    enemy.x  = enemyStartX  + (meetingXEnemy  - enemyStartX)  * alpha;

    if (fightFrame >= approachFrames) {
      fightPhase = 1;
      fightFrame = 0;
    }

  } else if (fightPhase === 1) {
    // Коллизия
    if (fightFrame === 1) {
      doDamagePhase();
    }
    if (fightFrame >= collisionFrames) {
      fightPhase = 2;
      fightFrame = 0;
    }

  } else if (fightPhase === 2) {
    // Возврат
    const alpha = fightFrame / retreatFrames;
    player.x = meetingXPlayer + (playerStartX - meetingXPlayer) * alpha;
    enemy.x  = meetingXEnemy  + (enemyStartX  - meetingXEnemy)  * alpha;

    if (fightFrame >= retreatFrames) {
      fightPhase = 0;
      fightFrame = 0;
      isFighting = false;
    }
  }
});

//-----------------------------------------------------
// 12. Адаптив при resize (опционально)
//-----------------------------------------------------
window.addEventListener("resize", () => {
  fightButton.y = app.screen.height - 60;
});
