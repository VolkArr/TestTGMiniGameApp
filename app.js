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

const player = new PIXI.Graphics();
const enemy = new PIXI.Graphics();
const uiContainer = new PIXI.Container();
const blockContainer = new PIXI.Container();
uiContainer.addChild(blockContainer);
const attackContainer = new PIXI.Container();
uiContainer.addChild(attackContainer);
const inventoryUI = new PIXI.Container();


//-----------------------------------------------------
// 2. Параметры игры
//-----------------------------------------------------
let maxHP = 10;
let playerHP = maxHP;
let playerScore = 0; // Очки игрока
// Исходная позиция
let playerStartX = app.screen.width * 0.3;
let meetingXPlayer = app.screen.width * 0.5 - 60;





let isInterfaceLocked = false; // Флаг блокировки интерфейса
let isGameRunning = false;

// Для врагов сделаем отдельно текущие показатели
let enemyHP = 10;              // HP у текущего врага
let enemyMaxHP = 10;           // Чтобы обновлять шкалу
let currentFloor = 1;          // Этаж "башни"
// Исходная позиция
let enemyStartX = app.screen.width * 0.7;
let meetingXEnemy  = app.screen.width * 0.5 + 60; 

// Размеры/позиции
const playerRadius = 30; 
const enemyHeight = 60;
const HP_BAR_WIDTH = 100;

// Инвентарь игрока
const inventory = []; // Массив объектов { effect: "increaseHP", level: 1 }
const maxInventorySlots = 16; // 16 ячеек

// Модификаторы предметов
let attackMod = 0; // Увеличивает урон
let armorMod = 0;  // Уменьшает получаемый урон
let healthBonus = 0; // Дополнительное максимальное здоровье



const blockOptions = ["head", "body", "groin"];
const attackOptions = ["head", "body", "groin"];

let selectedBlock = null;
let selectedAttack = null;


//-----------------------------------------------------
// 3. Фон (небо, земля, дорожка, солнце, деревья)
//-----------------------------------------------------




function createGameBackground(){
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
}


function createPlayerAndEnemies(){
  
  player.beginFill(0x0000ff);
  player.drawCircle(0, 0, playerRadius);
  player.endFill();
  player.x = app.screen.width * 0.3;
  player.y = app.screen.height * 0.55;
  app.stage.addChild(player);


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

  app.stage.addChild(playerHPBar.container);
  app.stage.addChild(enemyHPBar.container);

  positionHPBars();

}
//-----------------------------------------------------
// 4. Логика катсцен
//-----------------------------------------------------
let currentSceneIndex = 0;
const scenes = [
    { image: "scene1.png", text: "Синий шарик идет по дороге." },
    { image: "scene2.png", text: "Синий шарик видит деревню в огне." },
    { image: "scene3.png", text: "Синий шарик бежит на помощь." },
    { image: "scene4.png", text: "Синий шарик сталкивается с врагом." }
];

const cutsceneContainer = new PIXI.Container();
cutsceneContainer.name = "cutsceneContainer";
app.stage.addChild(cutsceneContainer);
cutsceneContainer.visible = false; // Скрыто по умолчанию

// Фон для сцены
const sceneBackground = new PIXI.Graphics();
sceneBackground.beginFill(0x000000);
sceneBackground.drawRect(0, 0, app.screen.width, app.screen.height * 0.6);
sceneBackground.endFill();
cutsceneContainer.addChild(sceneBackground);

// Место для текста
const textBackground = new PIXI.Graphics();
textBackground.beginFill(0x4B2A13); // Тёмно-коричневый цвет
textBackground.drawRect(0, app.screen.height * 0.6, app.screen.width, app.screen.height * 0.4);
textBackground.endFill();
cutsceneContainer.addChild(textBackground);

// Текстовое поле
const textStyle = new PIXI.TextStyle({
  fill: "#FFFFFF",
  fontSize: 36, // Уменьшите или увеличьте, если текст слишком большой или маленький
  wordWrap: true,
  wordWrapWidth: app.screen.width - 40
});

const textField = new PIXI.Text("", textStyle);
textField.style = textStyle;
textField.x = 20;
textField.y = app.screen.height * 0.6 + 20;
textField.visible = true;
cutsceneContainer.addChild(textField);

// Кнопка "Дальше"
const nextButton = createButton("Дальше", 100, 40);
nextButton.interactive = true;
nextButton.visible = true;
nextButton.x = app.screen.width - 120;
nextButton.y = app.screen.height - 50;
nextButton.on("pointerdown", () => {
  console.log("Кнопка 'Дальше' нажата");
  showNextScene();
});
cutsceneContainer.addChild(nextButton);

// Функция показа следующей сцены
function showNextScene() {
  console.log(`Текущая сцена: ${currentSceneIndex}`);
  if (currentSceneIndex >= scenes.length) {
      console.log("Катсцена завершена, начинаем игру");
      cutsceneContainer.visible = false;
      startGame(); // Переход к игре
      return;
  }

  const scene = scenes[currentSceneIndex];
  
  console.log(`cutsceneContainer.visible: ${cutsceneContainer.visible}`);
  console.log(`textField.visible: ${textField.visible}`);
  console.log(`textBackground.visible: ${textBackground.visible}`);
  loadScene(scene.image, scene.text);
  currentSceneIndex++;
}



function loadScene(imagePath, text) {
  console.log(`Отображаемый текст: ${text}`);
  
  // Удаляем только изображение сцены, оставляя textField и textBackground
  while (cutsceneContainer.children.length > 3) {
      cutsceneContainer.removeChildAt(1); // Удаляем старое изображение
  }

  const sceneImage = PIXI.Sprite.from(imagePath);
  sceneImage.width = app.screen.width;
  sceneImage.height = app.screen.height * 0.6;
  cutsceneContainer.addChildAt(sceneImage, 1);

  // Обновляем фон текста (перерисовка)
  textBackground.clear();
  textBackground.beginFill(0x8B4513); // Коричневый цвет
  textBackground.drawRect(0, app.screen.height * 0.6, app.screen.width, app.screen.height * 0.4);
  textBackground.endFill();

  // Устанавливаем текст и сбрасываем предыдущее содержимое
  textField.text = "";
  let charIndex = 0;

  const typingInterval = setInterval(() => {
      if (charIndex < text.length) {
          textField.text += text[charIndex];
          charIndex++;
      } else {
          clearInterval(typingInterval); // Останавливаем "печать" текста
      }
  }, 50);
}


// Запуск катсцены
function startCutscene() {
    currentSceneIndex = 0;
    cutsceneContainer.visible = true;
    showNextScene();
}



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
  let playerHPBar = createHPBar(HP_BAR_WIDTH, 16, maxHP);
  
  // Враг
  let enemyHPBar = createHPBar(HP_BAR_WIDTH, 16, enemyMaxHP);



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


//-----------------------------------------------------
// 6. Интерфейс: вверху (Block / Attack), внизу кнопка FIGHT
//-----------------------------------------------------





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


function createBtnUI(){
  
  uiContainer.x = 10;
  uiContainer.y = 10;
  app.stage.addChild(uiContainer);

  // Блоки (Block)


  const labelStyle = new PIXI.TextStyle({
    fill: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  });
  const blockLabel = new PIXI.Text("Block:", labelStyle);
  blockContainer.addChild(blockLabel);
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

  // Кнопка FIGHT (внизу слева)
  const fightButton = createButton("FIGHT", 100, 40);
  updateBlockButtons();

  // Атаки (Attack)

attackContainer.x = 120;


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

  updateAttackButtons();



  fightButton.x = 20;
  fightButton.y = app.screen.height - 60;
  app.stage.addChild(fightButton);

  fightButton.interactive = true;
  fightButton.buttonMode = true;
  fightButton.on("pointerdown", () => {
    if (isInterfaceLocked) return;
    startFightAnimation();
  });

  //-----------------------------------------------------
  // Кнопка инвентаря (внизу справа)
  //-----------------------------------------------------
  const inventoryButton = new PIXI.Container();
  const inventoryIcon = PIXI.Sprite.from('./inventory_icon.png'); 
  inventoryIcon.width = 50;
  inventoryIcon.height = 50;
  inventoryButton.addChild(inventoryIcon);

  inventoryButton.x = app.screen.width - 70;
  inventoryButton.y = app.screen.height - 70;
  app.stage.addChild(inventoryButton);

  inventoryButton.interactive = true;
  inventoryButton.buttonMode = true;

  // Интерфейс инвентаря
 
  inventoryUI.visible = false; // По умолчанию скрыт
  inventoryUI.x = app.screen.width / 2 - 100;
  inventoryUI.y = app.screen.height / 2 - 100;
  app.stage.addChild(inventoryUI);

  // Создаём ячейки инвентаря
for (let i = 0; i < maxInventorySlots; i++) {
  const slot = new PIXI.Container();

  // Фон слота
  const bg = new PIXI.Graphics();
  bg.lineStyle(2, 0xFFFFFF);
  bg.beginFill(0x333333);
  bg.drawRect(0, 0, 50, 50);
  bg.endFill();
  slot.addChild(bg);
  slot.bg = bg;

  // Слой для иконки
  const iconLayer = new PIXI.Container();
  iconLayer.name = "iconLayer"; // Удобное имя для поиска в updateInventoryUI
  slot.addChild(iconLayer);

  slot.x = (i % 4) * 55; // 4 слота в ряд
  slot.y = Math.floor(i / 4) * 55;
  inventoryUI.addChild(slot);
}

  // Кнопка для открытия/закрытия инвентаря
  inventoryButton.on("pointerdown", () => {
      inventoryUI.visible = !inventoryUI.visible; // Переключение видимости
  });


}



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
    const damage = getDamage(selectedAttack) + attackMod;
    enemyHP -= damage;
    playerScore += damage; // Добавляем очки за урон
    if (enemyHP < 0) enemyHP = 0;
    updateHPBar(enemyHPBar, enemyHP);
  }

  // 2) Если враг не умер - он бьёт
  if (enemyHP > 0) {
    if (selectedBlock !== enemyAttack) {
      const receivedDamage = Math.max(0, getDamage(enemyAttack) - armorMod); // Урон с учётом брони
      playerHP -= receivedDamage;
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

    setTimeout(() => {
      showItemSelection();
  }, 500);
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

  if (!isGameRunning) return; // Если игра не активна, ничего не делаем

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


function showItemSelection() {
  
  if (isInterfaceLocked) return; // Если интерфейс заблокирован, ничего не делаем
    isInterfaceLocked = true; // Блокируем интерфейс

  const itemSelectionUI = new PIXI.Container();
  itemSelectionUI.name = "itemSelectionUI";
  itemSelectionUI.x = app.screen.width / 2 - 150;
  itemSelectionUI.y = app.screen.height / 2 - 100;
  app.stage.addChild(itemSelectionUI);

  const items = [
      { name: "Броня", effect: "reduceDamage", icon: "armor_icon.png" },
      { name: "Оружие", effect: "increaseDamage", icon: "weapon_icon.png" },
      { name: "Крепкое тело", effect: "increaseHP", icon: "body_icon.png" }
  ];

  items.forEach((item, index) => {
      const itemButton = new PIXI.Container();
      const bg = new PIXI.Graphics();
      bg.beginFill(0x444444);
      bg.drawRect(0, 0, 80, 80);
      bg.endFill();
      itemButton.addChild(bg);

      const icon = PIXI.Sprite.from(item.icon);
      icon.width = 60;
      icon.height = 60;
      icon.x = 10;
      icon.y = 10;
      itemButton.addChild(icon);

      const label = new PIXI.Text(item.name, { fill: "#ffffff", fontSize: 14 });
      label.anchor.set(0.5);
      label.x = 40;
      label.y = 70;
      itemButton.addChild(label);

      itemButton.x = index * 100;
      itemButton.interactive = true;
      itemButton.buttonMode = true;
      itemButton.on("pointerdown", () => {
          addItemToInventory(item.effect);
          isInterfaceLocked = false; // Разблокируем интерфейс
      });

      itemSelectionUI.addChild(itemButton);
  });
}

function addItemToInventory(effect) {
  if (!effect) {
      console.error("Попытка добавить предмет с неопределённым эффектом!");
      return;
  }

  // Проверяем, есть ли уже такой предмет в инвентаре
  const existingItem = inventory.find(item => item.effect === effect);
  if (existingItem) {
      existingItem.level += 1; // Увеличиваем уровень
      console.log(`${getItemName(effect)} улучшено до уровня ${existingItem.level}`);
  } else if (inventory.length < maxInventorySlots) {
      inventory.push({ effect, level: 1 }); // Добавляем новый предмет
      console.log(`Добавлен новый предмет: ${getItemName(effect)}`);
  } else {
      console.log("Инвентарь заполнен!");
  }

  // Применяем эффект предмета
  applyItemEffect(effect);

  // Закрываем интерфейс выбора предметов
  const itemSelectionUI = app.stage.getChildByName("itemSelectionUI");
  if (itemSelectionUI) {
      app.stage.removeChild(itemSelectionUI);
  }

  // Обновляем инвентарь
  updateInventoryUI();
}

function updateInventoryUI() {
  inventoryUI.children.forEach((slot, index) => {
      if (!slot.bg) return; // Пропускаем слоты без фона

      const iconLayer = slot.getChildByName("iconLayer"); // Получаем слой для иконки
      iconLayer.removeChildren(); // Очищаем слой

      const item = inventory[index];

      if (item) {
          const iconPath = {
              "reduceDamage": "armor_icon.png",
              "increaseDamage": "weapon_icon.png",
              "increaseHP": "body_icon.png"
          }[item.effect];

          if (iconPath) {
              // Иконка предмета
              const icon = PIXI.Sprite.from(iconPath);
              icon.width = 40;
              icon.height = 40;
              icon.x = 5;
              icon.y = 5;
              iconLayer.addChild(icon);
          }

          // Уровень предмета (например, "+2")
          const levelText = new PIXI.Text(`+${item.level}`, {
              fill: "#ffffff",
              fontSize: 14,
              fontWeight: "bold"
          });
          levelText.anchor.set(0.5);
          levelText.x = 45;
          levelText.y = 45;
          iconLayer.addChild(levelText);

          // Добавляем обработчик нажатия
          slot.interactive = true;
          slot.buttonMode = true;
          slot.on("pointerdown", () => {
              showItemDescription(item.effect, iconPath, item.level);
          });
      } else {
          // Если слот пуст, создаём стандартный стиль для пустого фона
          const placeholder = new PIXI.Graphics();
          placeholder.lineStyle(2, 0xFFFFFF); // Используем те же параметры
          placeholder.beginFill(0x333333);   // Тот же фон, что и у заполненных слотов
          placeholder.drawRect(0, 0, 50, 50);
          placeholder.endFill();
          iconLayer.addChild(placeholder);
      }
  });
}



function applyItemEffect(effect) {
    switch (effect) {
        case "reduceDamage":
            armorMod += 1;
            console.log("Уменьшение получаемого урона на 1");
            break;
        case "increaseDamage":
            attackMod += 1;
            console.log("Увеличение наносимого урона на 1");
            break;
          case "increaseHP":
            healthBonus += 2; // Увеличиваем максимальное здоровье
            maxHP += 2; // Обновляем максимальное здоровье
            playerHP += 2; // Лечим игрока на 2 HP
          
            // Убедимся, что текущее здоровье не превышает новый максимум
            if (playerHP > maxHP) {
                playerHP = maxHP;
            }
          
              // Обновляем maxValue у HP бара и вызываем обновление
            playerHPBar.maxValue = maxHP;
            updateHPBar(playerHPBar, playerHP);
          
            console.log("Максимальное здоровье увеличено на 2, текущее здоровье восстановлено");
            break;
          
    }
}

function showItemDescription(effect, iconPath, level) {
  if (isInterfaceLocked) return; // Если интерфейс заблокирован, ничего не делаем
    isInterfaceLocked = true; // Блокируем интерфейс

  // Создаём контейнер для карточки
  const descriptionCard = new PIXI.Container();
  descriptionCard.x = app.screen.width / 2 - 100;
  descriptionCard.y = app.screen.height / 2 - 100;
  descriptionCard.name = "descriptionCard"; // Для удобного удаления
  app.stage.addChild(descriptionCard);

  // Фон карточки
  const bg = new PIXI.Graphics();
  bg.beginFill(0x777777);
  bg.drawRect(0, 0, 200, 150);
  bg.endFill();
  descriptionCard.addChild(bg);

  // Иконка предмета
  const icon = PIXI.Sprite.from(iconPath);
  icon.width = 50;
  icon.height = 50;
  icon.x = 10;
  icon.y = 10;
  descriptionCard.addChild(icon);

  // Название предмета
  const nameText = new PIXI.Text(`${getItemName(effect)} +${level}`, {
      fill: "#ffffff",
      fontSize: 16,
      fontWeight: "bold"
  });
  nameText.x = 70;
  nameText.y = 15;
  descriptionCard.addChild(nameText);

  // Описание предмета
  const descriptionText = new PIXI.Text(getItemDescription(effect), {
      fill: "#ffffff",
      fontSize: 14,
      wordWrap: true,
      wordWrapWidth: 180
  });
  descriptionText.x = 10;
  descriptionText.y = 70;
  descriptionCard.addChild(descriptionText);

  // Кнопка закрытия
  const closeButton = new PIXI.Graphics();
  closeButton.beginFill(0xff4444); // Красный цвет кнопки
  closeButton.drawRect(0, 0, 20, 20);
  closeButton.endFill();
  closeButton.interactive = true;
  closeButton.buttonMode = true;
  closeButton.x = 180; // Позиция в правом верхнем углу карточки
  closeButton.y = 0;
  closeButton.on("pointerdown", () => {
      app.stage.removeChild(descriptionCard); // Удаляем карточку
      isInterfaceLocked = false; // Разблокируем интерфейс
  });
  descriptionCard.addChild(closeButton);

  // Текст "X" на кнопке закрытия
  const closeText = new PIXI.Text("X", {
      fill: "#ffffff",
      fontSize: 14,
      fontWeight: "bold",
      align: "center"
  });
  closeText.anchor.set(0.5);
  closeText.x = closeButton.x + 10;
  closeText.y = closeButton.y + 10;
  descriptionCard.addChild(closeText);
}




// Функция для получения названия предмета
function getItemName(effect) {
  switch (effect) {
      case "reduceDamage":
          return "Броня";
      case "increaseDamage":
          return "Оружие";
      case "increaseHP":
          return "Крепкое тело";
      default:
          return "Неизвестный предмет";
  }
}

// Функция для получения описания предмета
function getItemDescription(effect) {
  switch (effect) {
      case "reduceDamage":
          return "Уменьшает получаемый урон на 1 за каждый уровень.";
      case "increaseDamage":
          return "Увеличивает наносимый урон на 1 за каждый уровень.";
      case "increaseHP":
          return "Увеличивает максимальное здоровье на 2 за каждый уровень.";
      default:
          return "Описание отсутствует.";
  }
}



//-----------------------------------------------------
// 12. Адаптив при resize (опционально)
//-----------------------------------------------------
window.addEventListener("resize", () => {
  fightButton.y = app.screen.height - 60;
});


function startGame() {
  console.log("Начало основной игры...");

  createGameBackground();
  createPlayerAndEnemies();
  createBtnUI();


  isGameRunning = true; // Активируем игровой процесс

  
}

startCutscene();
