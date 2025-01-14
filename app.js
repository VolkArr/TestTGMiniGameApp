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

// Разрешим сортировку по Z, чтобы текст рисовался поверх
app.stage.sortableChildren = true;

//-----------------------------------------------------
// 2. Параметры игры
//-----------------------------------------------------
const maxHP = 10;
let playerHP = maxHP;
let enemyHP = maxHP;

const centerX = app.screen.width / 2;
const centerY = app.screen.height / 2;

//-----------------------------------------------------
// 3. Фон (солнце, деревья и т.п.)
//-----------------------------------------------------
const background = new PIXI.Graphics();
// Небо
background.beginFill(0x87ceeb);
background.drawRect(0, 0, app.screen.width, app.screen.height / 2);
background.endFill();

// Земля
background.beginFill(0x654321);
background.drawRect(0, app.screen.height / 2, app.screen.width, app.screen.height / 2);
background.endFill();
app.stage.addChild(background);

// Дорожка
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
sun.x = app.screen.width - 100;
sun.y = 100;
app.stage.addChild(sun);

// Деревья
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
player.drawCircle(0, 0, 30);
player.endFill();
player.x = app.screen.width * 0.2;
player.y = app.screen.height * 0.5;
app.stage.addChild(player);

const enemy = new PIXI.Graphics();
enemy.beginFill(0xff0000);
enemy.drawPolygon([0, -30, 30, 30, -30, 30]);
enemy.endFill();
enemy.x = app.screen.width * 0.8;
enemy.y = app.screen.height * 0.5;
app.stage.addChild(enemy);

// Исходные позиции
const playerStartX = player.x;
const enemyStartX = enemy.x;

// Точка встречи в центре
const meetingXPlayer = centerX - 60;
const meetingXEnemy  = centerX + 60;

//-----------------------------------------------------
// 5. Полоски здоровья
//-----------------------------------------------------
function createHPBar(x, y, width, height, maxValue) {
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

  container.x = x;
  container.y = y;

  return { container, bar, text, maxValue };
}

const playerHPBar = createHPBar(50, 50, 150, 20, maxHP);
app.stage.addChild(playerHPBar.container);

const enemyHPBar = createHPBar(app.screen.width - 200, 50, 150, 20, maxHP);
app.stage.addChild(enemyHPBar.container);

function updateHPBar(barObj, currentHP) {
  const ratio = currentHP / barObj.maxValue;
  barObj.bar.width = 150 * ratio;
  barObj.text.text = `${currentHP}/${barObj.maxValue}`;
}

//-----------------------------------------------------
// 6. Текст "Победа" / "Поражение"
//-----------------------------------------------------
const resultText = new PIXI.Text("", {
  fill: '#ffffff',
  fontSize: 48,
  fontWeight: 'bold',
  align: 'center'
});
resultText.anchor.set(0.5);
resultText.x = centerX;
resultText.y = centerY - 100;
resultText.zIndex = 999;
app.stage.addChild(resultText);

function showResult(msg) {
  resultText.text = msg;
  // Покажем кнопку "NEW GAME"
  newGameButton.visible = true;
}

function hideResultAndButton() {
  resultText.text = "";
  newGameButton.visible = false;
}

//-----------------------------------------------------
// 7. Кнопка "NEW GAME" (изначально скрыта)
//-----------------------------------------------------
const newGameButton = createButton("NEW GAME", 0, 120, 40);
newGameButton.zIndex = 999;
newGameButton.visible = false;
app.stage.addChild(newGameButton);

// Ставим под результатом
newGameButton.x = centerX - 60;
newGameButton.y = resultText.y + 60;

newGameButton.interactive = true;
newGameButton.buttonMode = true;
newGameButton.on("pointerdown", () => {
  restartGame();
});

//-----------------------------------------------------
// 8. UI: выбор блока и атаки + кнопка FIGHT
//-----------------------------------------------------
const blockOptions = ["head", "body", "groin"];
const attackOptions = ["head", "body", "groin"];

let selectedBlock = null;
let selectedAttack = null;

const uiContainer = new PIXI.Container();
uiContainer.x = 50;
uiContainer.y = 150;
app.stage.addChild(uiContainer);

const blockContainer = new PIXI.Container();
blockContainer.y = 0;
uiContainer.addChild(blockContainer);

const attackContainer = new PIXI.Container();
attackContainer.y = 150;
uiContainer.addChild(attackContainer);

const labelStyle = new PIXI.TextStyle({
  fill: '#000000',
  fontSize: 16,
  fontWeight: 'bold',
});
const blockLabel = new PIXI.Text("Block:", labelStyle);
blockLabel.y = -25;
blockContainer.addChild(blockLabel);

const attackLabel = new PIXI.Text("Attack:", labelStyle);
attackLabel.y = -25;
attackContainer.addChild(attackLabel);

// Функция-шаблон для кнопок
function createButton(label, index, width = 80, height = 30) {
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
  button.y = index * (height + 10);

  return button;
}

// --- Кнопки BLOCK ---
blockOptions.forEach((option, i) => {
  const btn = createButton(option, i);
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

// --- Кнопки ATTACK ---
attackOptions.forEach((option, i) => {
  const btn = createButton(option, i);
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

updateBlockButtons();
updateAttackButtons();

// --- Кнопка FIGHT ---
const fightButton = createButton("FIGHT", 0, 100, 40);
fightButton.x = 0;
fightButton.y = 320;
uiContainer.addChild(fightButton);

fightButton.interactive = true;
fightButton.buttonMode = true;
fightButton.on("pointerdown", () => {
  startFightAnimation();
});

//-----------------------------------------------------
// 9. Логика перезапуска
//-----------------------------------------------------
function restartGame() {
  hideResultAndButton();

  // Сбрасываем HP
  playerHP = maxHP;
  enemyHP = maxHP;
  updateHPBar(playerHPBar, playerHP);
  updateHPBar(enemyHPBar, enemyHP);

  // Возвращаем спрайты на исходные позиции
  player.x = playerStartX;
  enemy.x  = enemyStartX;

  // Сбрасываем выбранные блок/атаку
  selectedBlock = null;
  selectedAttack = null;
  updateBlockButtons();
  updateAttackButtons();

  // Сбрасываем флаги анимации
  isFighting = false;
  fightPhase = 0;
  fightFrame = 0;
}

//-----------------------------------------------------
// 10. Анимация столкновения + нанесение урона
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

  // Скрываем результат (если вдруг был)
  hideResultAndButton();
}

app.ticker.add(() => {
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
    // Фаза коллизии: на 1-м кадре наносим урон
    if (fightFrame === 1) {
      doDamagePhase();
    }
    if (fightFrame >= collisionFrames) {
      fightPhase = 2; 
      fightFrame = 0;
    }

  } else if (fightPhase === 2) {
    // Фаза возврата
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
// Логика нанесения урона: фиксированная (не рандом!)
//-----------------------------------------------------
function doDamagePhase() {
  // Враг продолжает случайно выбирать, куда бить и куда блокировать
  // (можете тоже убрать, если хотите)
  const enemyBlock = blockOptions[Math.floor(Math.random() * blockOptions.length)];
  const enemyAttack = attackOptions[Math.floor(Math.random() * attackOptions.length)];

  console.log(`Игрок блокирует: ${selectedBlock}, атакует: ${selectedAttack}`);
  console.log(`Враг блокирует: ${enemyBlock}, атакует: ${enemyAttack}`);

  // 1) Игрок бьёт первым
  if (enemyBlock !== selectedAttack) {
    // Здесь не рандом, а жёсткая логика: head=3, groin=2, body=1
    enemyHP -= getDamage(selectedAttack);
    if (enemyHP < 0) enemyHP = 0;
    updateHPBar(enemyHPBar, enemyHP);
  }
  if (enemyHP <= 0) {
    showResult("Вы победили!");
    return;
  }

  // 2) Враг бьёт
  if (selectedBlock !== enemyAttack) {
    playerHP -= getDamage(enemyAttack);
    if (playerHP < 0) playerHP = 0;
    updateHPBar(playerHPBar, playerHP);
  }
  if (playerHP <= 0) {
    showResult("Вы проиграли...");
  }
}

// Собственно, нерандомная функция урона.
// Все значения фиксированные, никаких Math.random.
function getDamage(attackPart) {
  switch (attackPart) {
    case "head":  return 3;
    case "groin": return 2;
    // По умолчанию => "body"
    default:      return 1;
  }
}
