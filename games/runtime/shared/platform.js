(() => {
  'use strict';
  const prefix = 'igroland.';
  let audioContext = null;
  const read = (name, fallback = null) => {
    try {
      const value = localStorage.getItem(prefix + name);
      return value === null ? fallback : JSON.parse(value);
    } catch (_) { return fallback; }
  };
  const write = (name, value) => {
    try { localStorage.setItem(prefix + name, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  };
  const duration = seconds => {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  };
  const soundEnabled = () => read('settings.sound', false) === true;
  const setSound = value => write('settings.sound', Boolean(value));
  const sound = (frequencies, length = 0.13) => {
    if (!soundEnabled()) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      audioContext ||= new Context();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const now = audioContext.currentTime;
      frequencies.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now + index * length * 0.78);
        gain.gain.setValueAtTime(0, now + index * length * 0.78);
        gain.gain.linearRampToValueAtTime(.045, now + index * length * .78 + .018);
        gain.gain.exponentialRampToValueAtTime(.001, now + index * length * .78 + length);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + index * length * .78);
        oscillator.stop(now + index * length * .78 + length + .01);
      });
    } catch (_) { /* Browser audio is optional. */ }
  };
  window.Igroland = Object.freeze({ read, write, duration, sound, soundEnabled, setSound });
})();
