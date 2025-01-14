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

// Чтобы текст точно был над всеми элементами, разрешим сортировку по Z
app.stage.sortableChildren = true;

//-----------------------------------------------------
// 2. Параметры игры
//-----------------------------------------------------
const maxHP = 10;
let playerHP = maxHP;
let enemyHP = maxHP;

// Рассчитаем некие константы для позиционирования.
// При необходимости можно делать пропорционально размеру экрана.
const playerRadius = 30; // радиус круга для игрока
const enemyHeight = 60;  // высота треугольника (примерно)
const HP_BAR_WIDTH = 100; // сделаем чуть короче, чем было 150, чтобы лучше влезало на телефон

//-----------------------------------------------------
// 3. Фон (небо, земля, дорожка, солнце, деревья)
//-----------------------------------------------------
const background = new PIXI.Graphics();
background.beginFill(0x87ceeb); // небо
background.drawRect(0, 0, app.screen.width, app.screen.height / 2);
background.endFill();

// земля
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

// Солнце (простое жёлтое кругляшко)
const sun = new PIXI.Graphics();
sun.beginFill(0xffff00);
sun.drawCircle(0, 0, 40);
sun.endFill();
sun.x = app.screen.width - 80;
sun.y = 80;
app.stage.addChild(sun);

// Несколько деревьев
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
// Разместим игрока примерно в 30% по ширине
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
// Разместим врага в 70% по ширине
enemy.x = app.screen.width * 0.7;
enemy.y = app.screen.height * 0.55;
app.stage.addChild(enemy);

// Исходные позиции (для анимации подхода/возврата)
const playerStartX = player.x;
const enemyStartX = enemy.x;

// Точка "встречи"
const meetingXPlayer = app.screen.width * 0.5 - 60;
const meetingXEnemy  = app.screen.width * 0.5 + 60;

//-----------------------------------------------------
// 5. Полоски здоровья (теперь над головами)
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

const playerHPBar = createHPBar(HP_BAR_WIDTH, 16, maxHP);
app.stage.addChild(playerHPBar.container);

const enemyHPBar = createHPBar(HP_BAR_WIDTH, 16, maxHP);
app.stage.addChild(enemyHPBar.container);

// Функция для обновления HP бара
function updateHPBar(barObj, currentHP) {
  const ratio = currentHP / barObj.maxValue;
  barObj.bar.width = HP_BAR_WIDTH * ratio;
  barObj.text.text = `${currentHP}/${barObj.maxValue}`;
}

// Позиционирование HP-баров над головами
function positionHPBars() {
  // Игрок: бар над кругом (с учётом радиуса)
  playerHPBar.container.x = player.x - HP_BAR_WIDTH / 2; 
  playerHPBar.container.y = player.y - (playerRadius + 10 + 16); 
  // враг: бар над треугольником (с учётом половины высоты)
  enemyHPBar.container.x = enemy.x - HP_BAR_WIDTH / 2;
  enemyHPBar.container.y = enemy.y - (enemyHeight / 2 + 10 + 16);
}

// Вызываем при каждом кадре или после изменения размеров
positionHPBars();

//-----------------------------------------------------
// 6. Интерфейс: блок / атака (вверху), кнопка Fight (внизу)
//-----------------------------------------------------

// Список вариантов
const blockOptions = ["head", "body", "groin"];
const attackOptions = ["head", "body", "groin"];

let selectedBlock = null;
let selectedAttack = null;

// Создаём контейнер для UI (чтобы единообразно сдвигать)
const uiContainer = new PIXI.Container();
app.stage.addChild(uiContainer);

// Размещаем его у верхнего левого угла + небольшой отступ
uiContainer.x = 10;
uiContainer.y = 10;

// ---- БЛОК "Block" ----
const blockContainer = new PIXI.Container();
uiContainer.addChild(blockContainer);

const labelStyle = new PIXI.TextStyle({
  fill: '#000000',
  fontSize: 16,
  fontWeight: 'bold',
});
const blockLabel = new PIXI.Text("Block:", labelStyle);
blockContainer.addChild(blockLabel);

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

// Разместим кнопки блока вертикально под лейблом
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

// ---- БЛОК "Attack" ----
// Разместим его справа от Block (с небольшим отступом)
const attackContainer = new PIXI.Container();
attackContainer.x = 120; // +80 ширина кнопок + небольшой отступ
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

// ---- КНОПКА FIGHT (внизу слева) ----
const fightButton = createButton("FIGHT", 100, 40);
fightButton.x = 20;
fightButton.y = app.screen.height - 60; 
// Чтобы реагировать при изменении размеров экрана, можно обновлять в ресайзе
app.stage.addChild(fightButton);

fightButton.interactive = true;
fightButton.buttonMode = true;
fightButton.on("pointerdown", () => {
  startFightAnimation();
});

//-----------------------------------------------------
// 7. Анимация + логика боя (как прежде)
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

// Пример функции нанесения урона
function getDamage(attackPart) {
  switch (attackPart) {
    case "head":  return 3;
    case "groin": return 2;
    default:      return 1; 
  }
}

function doDamagePhase() {
  // Враг рандомно выбирает
  const blockOpts = ["head", "body", "groin"];
  const attackOpts = ["head", "body", "groin"];
  const enemyBlock = blockOpts[Math.floor(Math.random() * blockOpts.length)];
  const enemyAttack = attackOpts[Math.floor(Math.random() * attackOpts.length)];

  console.log(`Игрок блокирует: ${selectedBlock}, атакует: ${selectedAttack}`);
  console.log(`Враг блокирует: ${enemyBlock}, атакует: ${enemyAttack}`);

  // Наш удар
  if (enemyBlock !== selectedAttack) {
    enemyHP -= getDamage(selectedAttack);
    if (enemyHP < 0) enemyHP = 0;
    updateHPBar(enemyHPBar, enemyHP);
  }
  if (enemyHP <= 0) {
    console.log("Вы победили!");
    return;
  }

  // Вражеский ответ
  if (selectedBlock !== enemyAttack) {
    playerHP -= getDamage(enemyAttack);
    if (playerHP < 0) playerHP = 0;
    updateHPBar(playerHPBar, playerHP);
  }
  if (playerHP <= 0) {
    console.log("Вы проиграли...");
  }
}

//-----------------------------------------------------
// 8. Игровой цикл (ticker)
//-----------------------------------------------------
app.ticker.add(() => {
  // Обновим расположение HP-бара, если персонажей анимируют
  positionHPBars();

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
// 9. (Необязательно) Реакция на resize (адаптив)
//-----------------------------------------------------
window.addEventListener("resize", () => {
  // При желании можно перенастраивать расположение UI
  fightButton.y = app.screen.height - 60;
  // И, например, перестраивать meetingXPlayer/enemy, etc.
  // Или просто пересчитывать positionHPBars().
});
