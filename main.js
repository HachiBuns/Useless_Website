(() => {
  "use strict";

  const FRAME_WIDTH = 48;
  const FRAME_HEIGHT = 48;
  const creatures = {
    fish: {
      name: "Fish",
      src: "2D-Assets/fish.png",
      frames: 4,
      frameMs: 150,
      maxSpeed: 235,
      acceleration: 620,
      followDistance: 82,
      wanderSpeed: 104,
      escapeSpeed: 410,
      escapeAcceleration: 1050,
      facesRight: true
    },
    shark: {
      name: "Shark",
      src: "2D-Assets/shark.png",
      frames: 4,
      frameMs: 112,
      maxSpeed: 320,
      acceleration: 840,
      followDistance: 100,
      wanderSpeed: 142,
      escapeSpeed: 520,
      escapeAcceleration: 1400,
      facesRight: true
    },
    octopus: {
      name: "Octopus",
      src: "2D-Assets/octopus.png",
      frames: 6,
      frameMs: 185,
      maxSpeed: 195,
      acceleration: 470,
      followDistance: 72,
      wanderSpeed: 84,
      escapeSpeed: 345,
      escapeAcceleration: 900,
      facesRight: true
    }
  };

  const tank = document.querySelector("#tank");
  const canvas = document.querySelector("#creature");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const glow = document.querySelector("#creature-glow");
  const encounterCount = document.querySelector("#encounter-count");
  const loadingStatus = document.querySelector("#loading-status");
  const choices = Array.from(document.querySelectorAll(".creature-choice"));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: 0, y: 0, active: false, lastMoved: 0 };

  const state = {
    key: "fish",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    targetX: 0,
    targetY: 0,
    frame: 0,
    frameElapsed: 0,
    lastTime: 0,
    lastWander: 0,
    encounters: 0,
    dodgeUntil: 0,
    escaping: false,
    edgePointerLocked: false,
    ready: false
  };

  function bounds() {
    const size = canvas.getBoundingClientRect().width;
    const padding = size / 2 + 12;
    return {
      minX: Math.min(padding, tank.clientWidth / 2),
      maxX: Math.max(tank.clientWidth - padding, tank.clientWidth / 2),
      minY: Math.min(padding, tank.clientHeight / 2),
      maxY: Math.max(tank.clientHeight - padding, tank.clientHeight / 2)
    };
  }

  function isPointNearBorder(x, y, extraMargin = 0) {
    const size = canvas.getBoundingClientRect().width;
    const triggerMarginX = Math.min(size / 2 + 80, Math.max(0, tank.clientWidth / 2 - 48));
    const triggerMarginY = Math.min(size / 2 + 80, Math.max(0, tank.clientHeight / 2 - 48));
    const marginX = Math.min(Math.max(0, tank.clientWidth / 2 - 24), triggerMarginX + extraMargin);
    const marginY = Math.min(Math.max(0, tank.clientHeight / 2 - 24), triggerMarginY + extraMargin);
    return x < marginX
      || x > tank.clientWidth - marginX
      || y < marginY
      || y > tank.clientHeight - marginY;
  }

  function isNearBorder(extraMargin = 0) {
    return isPointNearBorder(state.x, state.y, extraMargin);
  }

  function clampPosition(x, y) {
    const area = bounds();
    return {
      x: Math.max(area.minX, Math.min(area.maxX, x)),
      y: Math.max(area.minY, Math.min(area.maxY, y))
    };
  }

  function resetCreature() {
    const center = clampPosition(tank.clientWidth / 2, tank.clientHeight * 0.55);
    state.x = center.x;
    state.y = center.y;
    state.vx = 0;
    state.vy = 0;
    state.targetX = center.x;
    state.targetY = center.y;
    state.frame = 0;
    state.frameElapsed = 0;
    state.dodgeUntil = 0;
    state.escaping = false;
    state.edgePointerLocked = false;
    state.facingRight = creatures[state.key].facesRight;
    state.encounters = 0;
    state.lastWander = performance.now() + 900;
    encounterCount.textContent = "0";
    pointer.active = false;
    canvas.setAttribute("aria-label", `${creatures[state.key].name} swimming in the aquarium`);
    drawFrame();
    renderPosition();
  }

  function selectCreature(key) {
    if (!creatures[key]) {
      return;
    }

    state.key = key;
    choices.forEach((button) => {
      const selected = button.dataset.creature === key;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    resetCreature();
  }

  function loadSprite(key, creature) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (image.naturalWidth !== creature.frames * FRAME_WIDTH || image.naturalHeight !== FRAME_HEIGHT) {
          reject(new Error(`${creature.src} has unexpected dimensions (${image.naturalWidth}x${image.naturalHeight}).`));
          return;
        }
        creature.image = image;
        resolve();
      };
      image.onerror = () => reject(new Error(`Could not load ${creature.src}. Check that the asset path is correct.`));
      image.src = creature.src;
    }).catch((error) => {
      console.error(`Unable to load the ${creature.name.toLowerCase()} sprite:`, error);
      loadingStatus.textContent = `${creature.name} sprite could not be loaded. Check the browser console.`;
      return key;
    });
  }

  function drawFrame() {
    const creature = creatures[state.key];
    context.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    if (!creature.image) {
      return;
    }

    context.imageSmoothingEnabled = false;
    context.save();
    if (state.facingRight !== creature.facesRight) {
      context.translate(FRAME_WIDTH, 0);
      context.scale(-1, 1);
    }
    context.drawImage(
      creature.image,
      state.frame * FRAME_WIDTH,
      0,
      FRAME_WIDTH,
      FRAME_HEIGHT,
      0,
      0,
      FRAME_WIDTH,
      FRAME_HEIGHT
    );
    context.restore();
  }

  function renderPosition() {
    const size = canvas.getBoundingClientRect().width;
    const x = state.x - size / 2;
    const y = state.y - size / 2;
    canvas.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    glow.style.width = `${size}px`;
    glow.style.left = `${x}px`;
    glow.style.top = `${y}px`;
  }

  function movePointer(event) {
    const rect = tank.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.lastMoved = performance.now();
    pointer.active = true;
  }

  function setWanderTarget(now) {
    const area = bounds();
    const inset = Math.max(24, canvas.getBoundingClientRect().width / 2 + 136 - area.minX);
    state.targetX = area.minX + inset + Math.random() * Math.max(1, area.maxX - area.minX - inset * 2);
    state.targetY = area.minY + inset + Math.random() * Math.max(1, area.maxY - area.minY - inset * 2);
    state.lastWander = now + 1800 + Math.random() * 2100;
  }

  function steer(delta, maxSpeed, acceleration) {
    const dx = state.targetX - state.x;
    const dy = state.targetY - state.y;
    const distance = Math.hypot(dx, dy);
    const desiredSpeed = Math.min(maxSpeed, distance * 1.8);
    const desiredVx = distance > 0 ? (dx / distance) * desiredSpeed : 0;
    const desiredVy = distance > 0 ? (dy / distance) * desiredSpeed : 0;
    let changeX = desiredVx - state.vx;
    let changeY = desiredVy - state.vy;
    const changeLength = Math.hypot(changeX, changeY);
    const maxChange = acceleration * delta;

    if (changeLength > maxChange) {
      changeX = (changeX / changeLength) * maxChange;
      changeY = (changeY / changeLength) * maxChange;
    }

    state.vx += changeX;
    state.vy += changeY;
    state.x += state.vx * delta;
    state.y += state.vy * delta;

    const bounded = clampPosition(state.x, state.y);
    if (bounded.x !== state.x) {
      state.vx = 0;
    }
    if (bounded.y !== state.y) {
      state.vy = 0;
    }
    state.x = bounded.x;
    state.y = bounded.y;
  }

  function updateCreature(now, delta) {
    const creature = creatures[state.key];
    const reducedScale = reducedMotion.matches ? 0.35 : 1;
    const pointerRecentlyActive = pointer.active && now - pointer.lastMoved < 4500;
    const center = clampPosition(tank.clientWidth / 2, tank.clientHeight / 2);
    const distanceToCenter = Math.hypot(center.x - state.x, center.y - state.y);

    if (state.escaping && !isNearBorder(24) && distanceToCenter <= canvas.getBoundingClientRect().width / 2) {
      state.escaping = false;
      state.edgePointerLocked = pointerRecentlyActive && isPointNearBorder(pointer.x, pointer.y, 24);
    }
    if (!state.escaping && isNearBorder()) {
      state.escaping = true;
    }
    if (state.edgePointerLocked && (!pointerRecentlyActive || !isPointNearBorder(pointer.x, pointer.y, 24))) {
      state.edgePointerLocked = false;
    }
    if (state.escaping) {
      state.targetX = center.x;
      state.targetY = center.y;
      steer(delta, creature.escapeSpeed * reducedScale, creature.escapeAcceleration * reducedScale);
      if (Math.abs(state.vx) > 5) {
        state.facingRight = state.vx > 0;
      }
      renderPosition();
      return;
    }

    const pointerIsActive = pointerRecentlyActive && !state.edgePointerLocked;
    if (pointerIsActive && now >= state.dodgeUntil) {
      let awayX = state.x - pointer.x;
      let awayY = state.y - pointer.y;
      let distance = Math.hypot(awayX, awayY);
      if (distance < 0.01) {
        awayX = state.vx === 0 ? (creature.facesRight ? -1 : 1) : -state.vx;
        awayY = state.vy === 0 ? 0 : -state.vy;
        distance = Math.hypot(awayX, awayY) || 1;
      }
      state.targetX = pointer.x + (awayX / distance) * creature.followDistance;
      state.targetY = pointer.y + (awayY / distance) * creature.followDistance;
    } else if (now >= state.dodgeUntil && (now >= state.lastWander || Math.hypot(state.targetX - state.x, state.targetY - state.y) < 14)) {
      setWanderTarget(now);
    }

    const maxSpeed = (pointerIsActive ? creature.maxSpeed : creature.wanderSpeed) * reducedScale;
    steer(delta, maxSpeed, creature.acceleration * reducedScale);

    if (Math.abs(state.vx) > 5) {
      state.facingRight = state.vx > 0;
    }
    renderPosition();
  }

  function animate(now) {
    if (!state.ready) {
      return;
    }

    const delta = state.lastTime ? Math.min((now - state.lastTime) / 1000, 0.05) : 0;
    state.lastTime = now;
    const creature = creatures[state.key];
    state.frameElapsed += delta * 1000;
    const frameDuration = reducedMotion.matches ? creature.frameMs * 1.6 : creature.frameMs;
    while (state.frameElapsed >= frameDuration) {
      state.frameElapsed -= frameDuration;
      state.frame = (state.frame + 1) % creature.frames;
      drawFrame();
    }
    updateCreature(now, delta);
    requestAnimationFrame(animate);
  }

  function dodge(event) {
    if (Number.isFinite(event.clientX)) {
      const canvasBounds = canvas.getBoundingClientRect();
      const pixelX = Math.max(0, Math.min(FRAME_WIDTH - 1, Math.floor((event.clientX - canvasBounds.left) * FRAME_WIDTH / canvasBounds.width)));
      const pixelY = Math.max(0, Math.min(FRAME_HEIGHT - 1, Math.floor((event.clientY - canvasBounds.top) * FRAME_HEIGHT / canvasBounds.height)));
      if (context.getImageData(pixelX, pixelY, 1, 1).data[3] === 0) {
        return;
      }
    }

    if (state.escaping || isNearBorder()) {
      state.escaping = true;
      state.encounters += 1;
      encounterCount.textContent = String(state.encounters);
      pointer.active = false;
      return;
    }

    const rect = tank.getBoundingClientRect();
    const hasPointerPosition = Number.isFinite(event.clientX);
    let dx = hasPointerPosition ? state.x - (event.clientX - rect.left) : -state.vx;
    let dy = hasPointerPosition ? state.y - (event.clientY - rect.top) : -state.vy;
    if (Math.hypot(dx, dy) < 0.01) {
      dx = state.facingRight ? -1 : 1;
      dy = 0;
    }
    const distance = Math.hypot(dx, dy) || 1;
    dx /= distance;
    dy /= distance;

    const area = bounds();
    const target = clampPosition(state.x + dx * 180, state.y + dy * 180);
    state.vx += dx * (reducedMotion.matches ? 150 : 430);
    state.vy += dy * (reducedMotion.matches ? 150 : 430);
    state.targetX = Math.max(area.minX, Math.min(area.maxX, target.x));
    state.targetY = Math.max(area.minY, Math.min(area.maxY, target.y));
    state.dodgeUntil = performance.now() + (reducedMotion.matches ? 280 : 620);
    state.encounters += 1;
    encounterCount.textContent = String(state.encounters);
    pointer.active = false;
  }

  choices.forEach((button) => {
    button.addEventListener("click", () => selectCreature(button.dataset.creature));
  });

  tank.addEventListener("pointermove", movePointer);
  tank.addEventListener("pointerleave", () => {
    pointer.active = false;
  });
  canvas.addEventListener("click", dodge);
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dodge({});
    }
  });

  window.addEventListener("resize", () => {
    const bounded = clampPosition(state.x, state.y);
    state.x = bounded.x;
    state.y = bounded.y;
    renderPosition();
  });

  const initialPosition = clampPosition(tank.clientWidth / 2, tank.clientHeight * 0.55);
  state.x = initialPosition.x;
  state.y = initialPosition.y;
  state.targetX = state.x;
  state.targetY = state.y;
  renderPosition();

  Promise.all(Object.entries(creatures).map(([key, creature]) => loadSprite(key, creature))).then(() => {
    state.ready = true;
    state.facingRight = creatures[state.key].facesRight;
    drawFrame();
    requestAnimationFrame(animate);
  });
})();