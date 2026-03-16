function getElementBounds(el) {
  const r = el.getBoundingClientRect();
  return {
    ...r,
    centerX: r.left + r.width / 2,
    centerY: r.top + r.height / 2,
  };
}

class Eye {
  constructor(element) {
    this.element = element;
    this.config = { maxX: 25, maxY: 10, damping: 200, amplify: 1.5 };
    this.lastPosition = { x: 0, y: 0 };
    this._sleepAnim = null;
  }

  get bounds() {
    // Always fresh — avoids stale coords after resize
    return getElementBounds(this.element);
  }

  // Cancel any running close/bop animation
  _cancelSleep() {
    if (this._sleepAnim) {
      this._sleepAnim.cancel();
      this._sleepAnim = null;
    }
  }

  // Commit + cancel every animation on this eye — used on wake to clear
  // fill:forwards fills (bop, moveBy, squint) that sit above inline styles
  // in the cascade and would otherwise block track() writes to style.translate
  clearAnims() {
    this.element.getAnimations().forEach((a) => {
      try {
        a.commitStyles();
      } catch (_) {}
      a.cancel();
    });
    this._sleepAnim = null;
  }

  async blink(duration = 120) {
    return this.element.animate([{ scale: "1.5 0", offset: 0.5 }], {
      duration,
      easing: "ease-in-out",
    }).finished;
  }

  close(duration = 600) {
    this._cancelSleep();
    const anim = this.element.animate(
      { scale: "1 0.08", translate: "0 10px" },
      { duration, fill: "forwards", easing: "ease-in-out" },
    );
    this._sleepAnim = anim;
    return anim.finished;
  }

  bop(duration = 2000) {
    const anim = this.element.animate(
      { translate: "0 15px" },
      {
        duration,
        fill: "forwards",
        easing: "ease-in-out",
        iterations: Infinity,
        direction: "alternate",
      },
    );
    this._sleepAnim = anim;
    return anim.finished;
  }

  wake(duration = 400) {
    // Clear all stale animations — bop/moveBy fills block track() via cascade priority
    this.clearAnims();

    const anim = this.element.animate(
      { scale: "1 1", translate: "0 0" },
      {
        duration,
        fill: "forwards",
        easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    );

    // After opening, commit "1 1 / 0 0" to inline style then cancel the fill —
    // this drops the animation out of the cascade so track() can write
    // element.style.translate freely (animations beat inline styles while active)
    anim.finished
      .then(() => {
        try {
          anim.commitStyles();
        } catch (_) {}
        anim.cancel();
      })
      .catch(() => {});

    return anim.finished;
  }

  squint(factor, duration = 300) {
    return this.element.animate(
      { scale: `${factor} ${factor}` },
      {
        duration,
        fill: "forwards",
        easing: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
    ).finished;
  }

  moveBy(x, y, duration = 1200) {
    return this.element.animate(
      { translate: `${x}px ${y}px` },
      {
        duration,
        fill: "forwards",
        easing:
          "linear(0, 0.03 1.1%, 0.125 2.4%, 0.906 9.8%, 1.046 12.3%, 1.11 15%, 1.116 16.3%, 1.11 17.8%, 1.014 25.8%, 0.987 31.2%, 1.001 47.2%, 1)",
      },
    ).finished;
  }

  lookAt(x, y, duration = 100) {
    const { tx, ty } = this._calculatePosition(x, y);
    this.lastPosition = { x: tx, y: ty };
    this.moveBy(tx, ty, duration);
  }

  // Direct style write for continuous per-frame tracking — no animation object overhead
  track(x, y) {
    const { tx, ty } = this._calculatePosition(x, y);
    this.element.style.translate = `${tx}px ${ty}px`;
  }

  shook(duration = 500) {
    return this.element.animate(
      [{ scale: "1 1" }, { scale: "0.7 0.7", offset: 0.1 }, { scale: "1 1" }],
      { duration, easing: "ease-out" },
    ).finished;
  }

  _calculatePosition(x, y) {
    const { maxX, maxY, damping, amplify } = this.config;
    const { centerX, centerY } = this.bounds;

    const dX = x - centerX;
    const dY = y - centerY;

    const fX = dX / (Math.abs(dX) + damping);
    const fY = dY / (Math.abs(dY) + damping);

    return {
      tx: Math.max(-maxX, Math.min(maxX, fX * maxX * amplify)),
      ty: Math.max(-maxY, Math.min(maxY, fY * maxY * amplify)),
    };
  }
}

class Bruto {
  constructor(svgId) {
    this.svg = document.getElementById(svgId);
    this.eyes = Array.from(this.svg.querySelectorAll(".eye")).map(
      (e) => new Eye(e),
    );
    this.state = "active"; // 'active', 'staring', 'idle', 'sleeping'
    this.lastActive = performance.now();
    this.lastBlink = performance.now();
    this.lastIdleMove = 0;
    this.nextBlinkInterval = 2000;
    this.nextIdleMoveInterval = 2000;
    this.idleTargets = [
      { x: 0, y: 0 }, // Look straight
      { x: -20, y: 16 }, // B
      { x: -10, y: 15 }, // R
      { x: 0, y: 15 }, // U
      { x: 10, y: 15 }, // T
      { x: 20, y: 16 }, // O
      { x: 0, y: -15 }, // Look up
      { x: 0, y: 0 }, // Look straight, twice the chance
      { x: 25, y: -15 }, // Look at clock (top right)
    ];
    this.init();
  }

  init() {
    this.svg.addEventListener("pointerdown", () => this.handleClick());
    window.addEventListener("pointerdown", (e) => this.focus(e));
    window.addEventListener("pointermove", (e) => this.focus(e));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.state = "sleeping";
        this.sleep();
      } else {
        // Optional: Stay asleep until the mouse moves,
        // or wake up automatically when they return:
        this.wakeUp();
      }
    });
    requestAnimationFrame((t) => this.heartbeat(t));
  }

  handleClick() {
    const now = performance.now();

    // If clicks are more than 500ms apart, reset the count
    if (now - this.lastClick > 500) {
      this.clickCount = 0;
    }

    this.clickCount++;
    this.lastClick = now;

    if (this.clickCount === 3) {
      this.wiggle();
      this.clickCount = 0; // Reset
    } else {
      this.blink();
    }
  }

  // Wake from any state, restore squint, and snap eyes to event position
  focus(e) {
    this.wakeUp();
    this.lookAt(e.clientX, e.clientY);
  }

  wakeUp() {
    if (this.isSleeping) {
      this.svg.classList.remove("is-sleeping");
      this.eyes.forEach((eye) => eye.wake()); // handles clearAnims + opens eyes
      //this.squint(1);
    } else if (!this.isActive) {
      // Clear moveBy/squint fills that would block track() writes to style.translate
      this.eyes.forEach((eye) => eye.clearAnims());
      this.squint(1);
    }
    this.state = "active";
    this.lastActive = performance.now();
  }

  blink(duration = undefined) {
    if (this.isSleeping) return;
    this.eyes.forEach((eye) => eye.blink(duration));
  }

  async sleep() {
    this.svg.classList.add("is-sleeping");
    try {
      await Promise.all(this.eyes.map((eye) => eye.close()));
    } catch (_) {
      return; // Wake() cancelled the close mid-animation — exit cleanly
    }
    if (this.isSleeping) this.eyes.forEach((eye) => eye.bop());
  }

  squint(factor = 0.5, duration = 300) {
    this.eyes.map((eye) => eye.squint(factor, duration));
  }

  lookAt(x, y, duration = 100) {
    this.eyes.forEach((eye) => eye.lookAt(x, y, duration));
  }

  lookAtElement(el, duration = 100) {
    const bounds = getElementBounds(el);
    this.lookAt(bounds.centerX, bounds.centerY, duration);
  }

  get isSleeping() {
    return this.state === "sleeping";
  }

  get isAwake() {
    return this.state !== "sleeping";
  }

  get isActive() {
    return this.state === "active";
  }

  get isStaring() {
    return this.state === "staring";
  }

  get isIdle() {
    return this.state === "idle";
  }

  heartbeat(now) {
    const idleTime = now - this.lastActive;

    // State transitions — each condition only fires once because it changes state
    if (this.isActive && idleTime > 3000) {
      this.state = "staring";
      this.squint(1.4);
    }

    if (this.isStaring && idleTime > 6000) {
      this.squint(1);
    }

    if (this.isStaring && idleTime > 8000) {
      this.state = "idle";
      this.triggerIdleMove(now);
    }

    if (!this.isSleeping && idleTime > 60000) {
      this.state = "sleeping";
      this.sleep();
    }

    // Idle cycle — re-trigger on its own interval
    if (this.isIdle && now - this.lastIdleMove > this.nextIdleMoveInterval) {
      this.triggerIdleMove(now);
    }

    // Auto-blink
    if (!this.isSleeping && now - this.lastBlink > this.nextBlinkInterval) {
      this.blink();
      this.lastBlink = now;
      this.nextBlinkInterval = Math.random() * 4000 + 2000;
    }

    requestAnimationFrame((t) => this.heartbeat(t));
  }

  triggerIdleMove(now) {
    if (!this.isIdle) return;
    const target = this.randomTarget;
    this.squint(Math.random() * 0.6 + 0.6);
    this.eyes.forEach((eye) => eye.moveBy(target.x, target.y, 1200));
    this.lastIdleMove = now;
    this.nextIdleMoveInterval = Math.random() * 1500 + 1500;
  }

  get randomTarget() {
    const pool = [...this.idleTargets, this.eyes[0].lastPosition];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  wiggle() {
    // 1. Shake the whole SVG using WAAPI
    // We use small translations and a tiny rotation for a "rattle" effect
    this.svg.animate(
      [
        { translate: "0px 0px", rotate: "0deg" },
        { translate: "-3px 2px", rotate: "-1deg" },
        { translate: "3px -1px", rotate: "1deg" },
        { translate: "-3px -2px", rotate: "-0.5deg" },
        { translate: "2px 2px", rotate: "0.5deg" },
        { translate: "0px 0px", rotate: "0deg" },
      ],
      {
        duration: 100,
        iterations: 5, // Repeat the shake 5 times (500ms total)
        easing: "linear",
      },
    );

    // 2. Make the eyes react
    this.eyes.forEach((e) => e.shook(500));

    // 3. Briefly lock the gaze so they don't track the mouse mid-wiggle
    // this.isLocked = true;
    // setTimeout(() => (this.isLocked = false), 500);
  }
}
