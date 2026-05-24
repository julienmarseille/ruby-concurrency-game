import { Application } from 'pixi.js';
import { GameScene } from './scenes/GameScene.js';

(async () => {
  const threadsInner = document.getElementById('threads-inner');
  const monitorWrap  = document.getElementById('monitor-canvas-wrap');

  const dpr = window.devicePixelRatio || 1;

  const threadsApp = new Application();
  await threadsApp.init({ background: 0x0d1117, antialias: true, resolution: dpr, autoDensity: true });
  threadsInner.appendChild(threadsApp.canvas);

  const monitorApp = new Application();
  await monitorApp.init({ background: 0x0d1117, resizeTo: monitorWrap, antialias: true, resolution: dpr, autoDensity: true });
  monitorWrap.appendChild(monitorApp.canvas);

  new GameScene(threadsApp, monitorApp);
})();
