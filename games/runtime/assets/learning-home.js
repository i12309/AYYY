/* Compose the catalogs before catalog.js reads the registry. No changes to old games. */
(() => {
  'use strict';
  const play=window.IGROLAND_GAME_REGISTRY||[],learn=window.IGROLAND_LEARNING_REGISTRY||[];
  const all=Object.freeze([...play,...learn]);
  const requested=new URLSearchParams(location.search).get('section');
  const section=requested==='learn'||requested==='play'?requested:'all';
  window.IGROLAND_ALL_GAMES=all;
  window.IGROLAND_GAME_REGISTRY=section==='learn'?learn:section==='play'?play:all;
  document.body.dataset.section=section;document.body.classList.add('has-learning');
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('[data-catalog-section]').forEach(link=>{if(link.dataset.catalogSection===section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    const count=document.getElementById('gameCount');if(count)count.textContent=section==='learn'?`${learn.length} учебных игр`:section==='play'?`${play.length} игр`:`${all.length} игр и занятий`;
    const head=document.querySelector('.site-header-note');if(head)head.textContent=`${play.length} игр + ${learn.length} учебных мастерских`;
    if(section==='learn'){
      document.getElementById('games-heading').textContent='Учимся играя';
      document.getElementById('levels-heading').textContent='Выбери маленькое занятие';
      document.querySelector('.level-section .section-subtitle').textContent='Числа, чтение, покупки, письма, фигуры и маршруты. Выбирай занятие и двигайся в своём темпе.';
    }
    document.querySelectorAll('#gameCards>a').forEach(card=>{
      const game=learn.find(g=>card.getAttribute('href')===g.link);if(!game)return;
      card.dataset.educational='true';const tag=card.querySelector('.mini-pill');if(tag)tag.textContent='ИГРАЕМ И УЧИМСЯ';
      const call=card.querySelector('.feature-cta');if(call)call.textContent='Открыть мастерскую →';
    });
  });
})();
