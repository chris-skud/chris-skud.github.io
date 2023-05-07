const container = document.querySelector('.container');
container.addEventListener('pointerdown', userPressed, { passive: true });

var element, bbox, startX, startY, deltaX, deltaY, raf;

function userPressed(event) {
  element = event.target;
  if (element.classList.contains('box')) {
    startX = event.clientX;
    startY = event.clientY;
    bbox = element.getBoundingClientRect();
    container.addEventListener('pointermove', userMoved, { passive: true });
    container.addEventListener('pointerup', userReleased, { passive: true });
    container.addEventListener('pointercancel', userReleased, { passive: true });
  };
};

function userMoved(event) {
  // if no previous request for animation frame - we allow js to proccess 'move' event:
  if (!raf) {
    deltaX = event.clientX - startX;
    deltaY = event.clientY - startY;
    raf = requestAnimationFrame(userMovedRaf);
  }
};

function userMovedRaf() {
  element.style.transform = "translate3d("+deltaX+"px,"+deltaY+"px, 0px)";
  // once the paint job is done we 'release' animation frame variable to allow next paint job:
  raf = null;
};

function userReleased(event) {
  container.removeEventListener('pointermove', userMoved);
  container.removeEventListener('pointerup', userReleased);
  container.removeEventListener('pointercancel', userReleased);
  // if animation frame was scheduled but the user already stopped interaction - we cancel the scheduled frame:
  if (raf) {
    cancelAnimationFrame(raf);
    raf = null;
  };
  element.style.left = bbox.left + deltaX + "px";
  element.style.top = bbox.top + deltaY + "px";
  element.style.transform = "translate3d(0px,0px,0px)";
  deltaX = deltaY = null;
};