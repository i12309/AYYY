/* Fullscreen CRT interface, deliberately isolated from the rest of AYYY. */
(() => {
  'use strict';
  const a = window.AYYY;
  a.register('ai', {
    title:'Нейронный терминал',
    render() {
      const initial = a.param ? '?prompt=' + encodeURIComponent(a.param.slice(0,500)) : '';
      return '<iframe class="neural-terminal-frame" title="Нейронный терминал AYYY" src="terminal/index.html' + initial + '"></iframe>';
    }
  });
})();
