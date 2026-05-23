export class DragResizeController {
  constructor(handleEl, wrapEl, { onStart, onEnd, onResize }) {
    let startY, startH;

    const onMouseMove = e => {
      const newH = Math.max(40, startH + (startY - e.clientY));
      onResize(newH);
    };

    const onMouseUp = () => {
      onEnd();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handleEl.addEventListener('mousedown', e => {
      startY = e.clientY;
      startH = wrapEl.offsetHeight;
      onStart();
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }
}
