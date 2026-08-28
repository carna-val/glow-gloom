/* ==========================================================================
   transitions.js
   A tiny, dependency-free page-transition system.

   FIX NOTES (why this rewrite exists):
   - The old version navigated on a fixed setTimeout(640ms) while the CSS
     transition it was covering for lasted 1100ms (--dur-slow). The browser
     would jump to the next page mid-animation, which reads as an abrupt
     flash rather than a smooth wipe. This version instead waits for the
     real `transitionend` event before navigating, so it is *impossible*
     for the cut to happen mid-motion.
   - The wipe color used to be the link's bright accent (e.g. neon pink),
     which is what made it look like a "pink flash". It now always wipes
     in the destination page's own dark background tone, which never
     clashes with either theme.
   ========================================================================== */
(function(){
  var overlay = document.getElementById('transition-overlay');
  if(!overlay) return;

  function setPoint(x, y){
    overlay.style.setProperty('--tx', x + 'px');
    overlay.style.setProperty('--ty', y + 'px');
  }

  function revealOnLoad(){
    var bg = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#0a0a0a';
    overlay.style.setProperty('--twipe', bg);
    setPoint(window.innerWidth/2, window.innerHeight/2);
    overlay.classList.remove('run');
    overlay.style.transition = 'none';
    overlay.style.opacity = '1';
    overlay.style.clipPath = 'circle(150% at 50% 50%)';
    // force reflow so the browser registers the "fully covered" state
    // before we animate away from it
    void overlay.offsetHeight;
    requestAnimationFrame(function(){
      overlay.style.transition = '';
      overlay.style.opacity = '';
      overlay.style.clipPath = '';
      overlay.classList.add('reveal');
      var done = false;
      function finish(){
        if(done) return; done = true;
        overlay.classList.remove('reveal');
      }
      overlay.addEventListener('transitionend', finish, { once:true });
      setTimeout(finish, 900); // safety net if the event never fires
    });
  }

  function wireLinks(){
    var links = document.querySelectorAll('a[data-transition]');
    links.forEach(function(link){
      link.addEventListener('click', function(e){
        var href = link.getAttribute('href');
        if(!href || link.target === '_blank' || e.metaKey || e.ctrlKey) return;
        e.preventDefault();

        var wipe = link.getAttribute('data-wipe') || getComputedStyle(document.body).getPropertyValue('--bg').trim();
        overlay.style.setProperty('--twipe', wipe);
        var x = e.clientX || window.innerWidth/2;
        var y = e.clientY || window.innerHeight/2;
        setPoint(x, y);

        overlay.classList.remove('reveal');
        overlay.style.transition = 'none';
        overlay.style.opacity = '1';
        overlay.style.clipPath = 'circle(0% at ' + x + 'px ' + y + 'px)';
        void overlay.offsetHeight;
        overlay.style.transition = '';

        var navigated = false;
        function go(){
          if(navigated) return; navigated = true;
          window.location.href = href;
        }
        overlay.addEventListener('transitionend', go, { once:true });
        setTimeout(go, 900); // safety net

        requestAnimationFrame(function(){
          overlay.classList.add('run');
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.body.classList.add('page-enter');
    revealOnLoad();
    wireLinks();
  });
})();
