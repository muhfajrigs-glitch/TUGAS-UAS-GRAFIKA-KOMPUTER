// Levels: each level is an object {w,h,tiles,start,goal}
// tiles: array of rows with 1 = tile, 0 = empty, 3 = fragile (breaks if block lies), 2 = goal
const LEVELS = [
  // LEVEL 1 — basic easy
  {
    w: 6,
    h: 6,
    tiles: [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 2, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
    ],
    start: { r: 1, c: 2, orientation: "lyingH" },
  },

  // LEVEL 2 — bend path (sudah diperbaiki)
  {
    w: 10,
    h: 10,
    tiles: [
      [0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 0, 1, 0],
      [1, 1, 1, 1, 0, 1, 0], // FIX tile
      [1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 1, 1, 2, 1],
      [0, 0, 0, 1, 1, 1, 1],
      [0, 0, 0, 1, 1, 1, 1],
    ],
    start: { r: 1, c: 1, orientation: "standing" },
  },

  // LEVEL 3 — harder narrow path (sudah diperbaiki)
  {
    w: 12,
    h: 12,
    tiles: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 0, 0], // FIX tile
      [0, 1, 1, 0, 1, 1, 0, 0],
      [0, 1, 1, 0, 1, 1, 1, 1],
      [0, 0, 0, 0, 1, 2, 1, 1],
      [0, 0, 0, 0, 1, 1, 1, 0],
    ],
    start: { r: 1, c: 1, orientation: "lyingH" },
  },
];

// Game state
let currentLevel = 0;
let level;
let tileSize = 80;
let camX = 0,
  camY = 0;

// Block state
// We'll store block as either 'standing' at (r,c), or 'lyingH' covering (r,c) and (r,c+1), or 'lyingV' covering (r,c) and (r+1,c)
let block = { r: 0, c: 0, orientation: "standing" };
let lost = false,
  won = false;
let anim = 0; // simple animation easing

function loadLevel(i) {
  currentLevel = constrain(i, 0, LEVELS.length - 1);
  level = JSON.parse(JSON.stringify(LEVELS[currentLevel])); // deep copy
  block = Object.assign({}, level.start);
  lost = false;
  won = false;
  anim = 0;
  // center camera
  const W = level.w * tileSize;
  const H = level.h * tileSize;
  camX = max(0, (windowWidth - W) / 2);
  camY = max(0, 40);
}

function setup() {
  const cnv = createCanvas(
    min(1500, windowWidth - 40),
    min(1140, windowHeight - 10)
  );
  cnv.parent("canvasHolder");
  textFont("monospace");
  loadLevel(0);

  // hook UI
  document.getElementById("btnRestart").onclick = () => loadLevel(currentLevel);
  document.getElementById("btnPrev").onclick = () =>
    loadLevel(currentLevel - 1);
  document.getElementById("btnNext").onclick = () =>
    loadLevel(currentLevel + 1);
  document.getElementById("up").onclick = () => doMove("up");
  document.getElementById("down").onclick = () => doMove("down");
  document.getElementById("left").onclick = () => doMove("left");
  document.getElementById("right").onclick = () => doMove("right");

  // mobile friendly: prevent scroll on arrow buttons
  ["up", "down", "left", "right"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      el.classList.add("active");
      doMove(el.textContent.trim() === "↑" ? "up" : el.id);
    });
    el.addEventListener("touchend", () => {});
  });
}

function windowResized() {
  resizeCanvas(min(900, windowWidth - 40), min(700, windowHeight - 160));
  // recalc camera
  const W = level.w * tileSize;
  camX = max(0, (windowWidth - W) / 2);
}

function draw() {
  background(16);
  push();
  translate(camX, camY);

  // draw grid background
  for (let r = 0; r < level.h; r++) {
    for (let c = 0; c < level.w; c++) {
      const t = level.tiles[r] && level.tiles[r][c] ? level.tiles[r][c] : 0;
      const x = c * tileSize,
        y = r * tileSize;
      if (t) {
        // tile base
        fill(40);
        stroke(70);
        strokeWeight(2);
        rect(x + 6, y + 6, tileSize - 12, tileSize - 12, 6);
        if (t === 2) {
          // goal
          noFill();
          stroke(255, 200, 0);
          strokeWeight(3);
          ellipse(x + tileSize / 2, y + tileSize / 2, tileSize / 2);
        } else if (t === 3) {
          fill(90, 40, 30, 140);
          noStroke();
          rect(x + 14, y + 14, tileSize - 28, tileSize - 28, 4);
        }
      } else {
        // empty slot (shadow)
        noFill();
        stroke(20);
        strokeWeight(1);
        rect(x + 6, y + 6, tileSize - 12, tileSize - 12, 6);
      }
    }
  }

  // draw block with simple animation
  drawBlock();

  pop();

  // HUD
  noStroke();
  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);
  text(`Level ${currentLevel + 1} / ${LEVELS.length}`, 12, 12);
  if (won) {
    fill(100, 255, 120);
    textAlign(CENTER, TOP);
    textSize(20);
    text("✅ Level Complete — Press Next or Restart", width / 2, 12);
  }
  if (lost) {
    fill(255, 80, 80);
    textAlign(CENTER, TOP);
    textSize(20);
    text("❌ You fell — Press Restart", width / 2, 12);
  }
}

function drawBlock() {
  // compute visuals based on orientation
  // for slight animation, we lerp a tiny bob using anim
  anim = lerp(anim, 0, 0.2);
  const s = tileSize;
  stroke(200);
  strokeWeight(2);

  if (block.orientation === "standing") {
    const x = block.c * s,
      y = block.r * s;
    push();
    translate(x + s / 2, y + s / 2 + sin(anim * PI * 2) * 3);
    fill(100, 180, 255);
    rectMode(CENTER);
    rect(0, 0, s * 0.6, s * 0.9, 6);
    pop();
  } else if (block.orientation === "lyingH") {
    const x = block.c * s,
      y = block.r * s;
    push();
    translate(x + s, y + s / 2 + sin(anim * PI * 2) * 2);
    fill(120, 200, 160);
    rectMode(CENTER);
    rect(0, 0, s * 1.4, s * 0.6, 6);
    pop();
  } else if (block.orientation === "lyingV") {
    const x = block.c * s,
      y = block.r * s;
    push();
    translate(x + s / 2, y + s);
    fill(200, 160, 220);
    rectMode(CENTER);
    rect(0, 0, s * 0.6, s * 1.4, 6);
    pop();
  }
}

function keyPressed() {
  if (keyCode === LEFT_ARROW) doMove("left");
  if (keyCode === RIGHT_ARROW) doMove("right");
  if (keyCode === UP_ARROW) doMove("up");
  if (keyCode === DOWN_ARROW) doMove("down");
  if (key === "r" || key === "R") loadLevel(currentLevel);
}

function doMove(dir) {
  if (lost || won) return;
  // apply move depending on orientation
  let nR = block.r,
    nC = block.c,
    nO = block.orientation;
  if (block.orientation === "standing") {
    if (dir === "up") {
      nR = block.r - 2;
      nC = block.c;
      nO = "lyingV";
    }
    if (dir === "down") {
      nR = block.r + 1;
      nC = block.c;
      nO = "lyingV";
    }
    if (dir === "left") {
      nR = block.r;
      nC = block.c - 2;
      nO = "lyingH";
    }
    if (dir === "right") {
      nR = block.r;
      nC = block.c + 1;
      nO = "lyingH";
    }
  } else if (block.orientation === "lyingH") {
    if (dir === "up") {
      nR = block.r - 1;
      nC = block.c;
      nO = "lyingH";
    }
    if (dir === "down") {
      nR = block.r + 1;
      nC = block.c;
      nO = "lyingH";
    }
    if (dir === "left") {
      nR = block.r;
      nC = block.c - 1;
      nO = "standing";
    }
    if (dir === "right") {
      nR = block.r;
      nC = block.c + 2;
      nO = "standing";
    }
  } else if (block.orientation === "lyingV") {
    if (dir === "left") {
      nR = block.r;
      nC = block.c - 1;
      nO = "lyingV";
    }
    if (dir === "right") {
      nR = block.r;
      nC = block.c + 1;
      nO = "lyingV";
    }
    if (dir === "up") {
      nR = block.r - 1;
      nC = block.c;
      nO = "standing";
    }
    if (dir === "down") {
      nR = block.r + 2;
      nC = block.c;
      nO = "standing";
    }
  }

  // compute the new occupied tiles after the move
  const occ = occupiedCells(nR, nC, nO);

  // check all occupied tiles are inside and on tile
  let onAny = false;
  for (const p of occ) {
    if (p.r < 0 || p.r >= level.h || p.c < 0 || p.c >= level.w) {
      onAny = false;
      break;
    }
    const t =
      level.tiles[p.r] && level.tiles[p.r][p.c] ? level.tiles[p.r][p.c] : 0;
    if (t) onAny = true;
    else {
      onAny = false;
      break;
    }
  }

  // update block if valid
  if (onAny) {
    block.r = nR;
    block.c = nC;
    block.orientation = nO;
    anim = 1;
    // check fragile tiles: if any occupied cell is fragile (3) and block is lying (not standing), break and lose
    for (const p of occ) {
      const t = level.tiles[p.r][p.c];
      if (t === 3 && block.orientation !== "standing") {
        // remove the tile and cause block to fall
        level.tiles[p.r][p.c] = 0;
        lost = true;
        return;
      }
    }

    // check goal: if standing on goal, win
    if (block.orientation === "standing") {
      const t =
        level.tiles[block.r] && level.tiles[block.r][block.c]
          ? level.tiles[block.r][block.c]
          : 0;
      if (t === 2) {
        won = true;
      }
    }
  } else {
    // invalid move -> falling
    lost = true;
  }
}

function occupiedCells(r, c, o) {
  if (o === "standing") return [{ r: r, c: c }];
  if (o === "lyingH")
    return [
      { r: r, c: c },
      { r: r, c: c + 1 },
    ];
  if (o === "lyingV")
    return [
      { r: r, c: c },
      { r: r + 1, c: c },
    ];
  return [];
}

// small helpers
function constrain(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
