/* ==========================================================================
   landing.js  (index.html only)

   FIX NOTES: the seam between Glow and Gloom used to be a CSS pseudo-element
   pinned at a hardcoded left:50%. The moment you hovered a portal, its flex
   grew and the real visual boundary moved — but the seam stayed put, so it
   ended up floating in the middle of one of the images instead of sitting
   between them. This tracks the *actual* rendered edge every frame while a
   portal is hovered (or focused with the keyboard), via the real
   .portal element's bounding box, and settles back to 50% once nothing is
   hovered — so it always matches what's on screen, mid-transition or not.
   ========================================================================== */
(function(){
  var landing = document.querySelector('.landing');
  if(!landing) return;
  var seam = landing.querySelector('.seam');
  var portals = Array.prototype.slice.call(landing.querySelectorAll('.portal'));
  if(!seam || portals.length < 2) return;

  var raf = null;
  var settleTimer = null;

  function track(){
    var landingRect = landing.getBoundingClientRect();
    var firstRect = portals[0].getBoundingClientRect();
    var x = firstRect.right - landingRect.left;
    seam.style.left = x + 'px';
    raf = requestAnimationFrame(track);
  }

  function start(){
    clearTimeout(settleTimer);
    if(!raf) raf = requestAnimationFrame(track);
  }

  function stop(){
    // keep tracking a little past mouseleave so the seam follows the
    // portals all the way back to their resting width, then let CSS
    // take over the static 50% position again
    settleTimer = setTimeout(function(){
      if(raf){ cancelAnimationFrame(raf); raf = null; }
      seam.style.left = '';
    }, 650);
  }

  portals.forEach(function(p){
    p.addEventListener('mouseenter', start);
    p.addEventListener('focusin', start);
  });
  landing.addEventListener('mouseleave', stop);
  landing.addEventListener('focusout', stop);

  window.addEventListener('resize', function(){
    if(!raf) seam.style.left = '';
  });
})();
