/**
 * Shadow Twin visual engine — score-driven light/dark morphing
 */

import { getLevel, getShadowVisuals } from './carbon-calculator.js';

export function renderShadowTwin(container, score = 0) {
  const visuals = getShadowVisuals(score);
  applyVisualVars(container, visuals);

  container.innerHTML = `
    <div class="shadow-stage-backdrop" style="--pollution:${visuals.pollution}"></div>
    <div class="shadow-twin ${visuals.level.class}" id="shadowTwinEl" style="${visualStyleVars(visuals)}">
      <div class="shadow-aura"></div>
      <div class="shadow-light-beam"></div>
      <div class="shadow-particles">${generateParticles(visuals)}</div>
      ${generateSmoke(visuals)}
      <div class="shadow-head">
        <div class="shadow-face">
          <div class="shadow-eye left"></div>
          <div class="shadow-eye right"></div>
        </div>
        <div class="shadow-mouth"></div>
      </div>
      <div class="shadow-body"></div>
      <div class="shadow-cast"></div>
      <div class="shadow-ground"></div>
    </div>
    <div class="pollution-meter">
      <span class="meter-label light-label">Light 🌿</span>
      <div class="meter-track">
        <div class="meter-fill" style="width:${visuals.pollution * 100}%"></div>
        <div class="meter-thumb" style="left:${visuals.pollution * 100}%"></div>
      </div>
      <span class="meter-label dark-label">Dark ☠️</span>
    </div>
  `;
}

function visualStyleVars(v) {
  return `
    --pollution:${v.pollution};
    --lightness:${v.lightness};
    --twin-scale:${v.scale};
    --body-brightness:${v.brightness};
    --glow-size:${v.glowSize}px;
    --cast-size:${v.castShadowSize}px;
    --cast-opacity:${v.castShadowOpacity};
    --aura-opacity:${v.auraOpacity};
  `.replace(/\s+/g, ' ').trim();
}

function applyVisualVars(container, visuals) {
  container.dataset.pollution = visuals.pollution.toFixed(2);
  container.classList.toggle('high-pollution', visuals.pollution > 0.55);
  container.classList.toggle('low-pollution', visuals.pollution < 0.25);
}

function generateParticles(visuals) {
  const count = visuals.particleCount;
  let html = '';
  for (let i = 0; i < count; i++) {
    const x = 20 + Math.random() * 120;
    const y = 40 + Math.random() * 120;
    const size = 2 + Math.random() * (visuals.lightness * 5 + 1);
    const delay = Math.random() * 3;
    html += `<div class="particle" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;animation-delay:${delay}s;opacity:${0.3 + visuals.lightness * 0.6}"></div>`;
  }
  return html;
}

function generateSmoke(visuals) {
  if (visuals.smokeAmount === 0) return '';
  let html = '<div class="smoke-layer">';
  for (let i = 0; i < visuals.smokeAmount; i++) {
    const x = 10 + i * 18;
    const delay = i * 0.4;
    const w = 24 + visuals.pollution * 20;
    html += `<div class="smoke-wisp" style="left:${x}px;top:20px;width:${w}px;animation-delay:${delay}s;opacity:${0.4 + visuals.pollution * 0.5}"></div>`;
  }
  html += '</div>';
  return html;
}

export function updateShadowTwin(container, score, animate = true) {
  const visuals = getShadowVisuals(score);
  const twin = container.querySelector('.shadow-twin') || container.querySelector('#shadowTwinEl');

  applyVisualVars(container, visuals);

  if (!twin) {
    renderShadowTwin(container, score);
    return visuals.level;
  }

  twin.className = `shadow-twin ${visuals.level.class}`;
  twin.setAttribute('style', visualStyleVars(visuals));

  const backdrop = container.querySelector('.shadow-stage-backdrop');
  if (backdrop) backdrop.style.setProperty('--pollution', visuals.pollution);

  const meterFill = container.querySelector('.meter-fill');
  const meterThumb = container.querySelector('.meter-thumb');
  if (meterFill) meterFill.style.width = `${visuals.pollution * 100}%`;
  if (meterThumb) meterThumb.style.left = `${visuals.pollution * 100}%`;

  if (animate) {
    twin.classList.add('evolve');
    setTimeout(() => twin.classList.remove('evolve'), 1000);
  }

  const particlesEl = twin.querySelector('.shadow-particles');
  if (particlesEl) particlesEl.innerHTML = generateParticles(visuals);

  twin.querySelectorAll('.smoke-layer').forEach(s => s.remove());
  const smokeHtml = generateSmoke(visuals);
  if (smokeHtml) twin.insertAdjacentHTML('afterbegin', smokeHtml);

  updateShadowExpression(twin, visuals);

  return visuals.level;
}

function updateShadowExpression(twin, visuals) {
  const mouth = twin.querySelector('.shadow-mouth');
  if (!mouth) return;

  mouth.className = 'shadow-mouth';
  if (visuals.pollution < 0.25) mouth.classList.add('mouth-happy');
  else if (visuals.pollution < 0.55) mouth.classList.add('mouth-neutral');
  else mouth.classList.add('mouth-sad');
}

export function updateLevelBadge(badgeEl, level) {
  badgeEl.className = `level-badge ${level.class}`;
  badgeEl.querySelector('.level-emoji').textContent = level.emoji;
  badgeEl.querySelector('.level-name').textContent = level.name;
}

export function updateHeaderLevel(headerEl, level) {
  headerEl.className = `stat-pill level-pill ${level.class}`;
  headerEl.querySelector('.stat-value').textContent = `${level.emoji} ${level.name}`;
}
