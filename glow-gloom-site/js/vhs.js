/* ==========================================================================
   vhs.js  (horror.html only)

   FIX NOTES: the old "VHS bug" feeling came from a hover-triggered
   steps(6) opacity flicker fired independently by every single photo you
   rolled over — moving quickly across the wall stacked several of these
   at once and it read as broken rather than eerie. This replaces it with
   one shared ambient scanline layer (`.vhs-layer`, styled in gallery.css,
   GPU-cheap: transform-only) plus rare, short, centrally-timed glitch
   bursts — so it stays a controlled effect no matter how the visitor
   interacts with the page, instead of compounding.
   ========================================================================== */
(function(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var layer = document.querySelector('.vhs-layer');
  if(!layer) return;

  function burst(){
    layer.classList.add('glitch');
    setTimeout(function(){ layer.classList.remove('glitch'); }, 240);
    schedule();
  }
  function schedule(){
    var next = 6000 + Math.random() * 9000; // one brief glitch every 6–15s, never overlapping
    setTimeout(burst, next);
  }
  schedule();
})();
