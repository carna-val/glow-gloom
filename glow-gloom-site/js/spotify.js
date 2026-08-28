/* ==========================================================================
   spotify.js
   Powers the floating music pill: expands into a real Spotify playlist
   embed, and needs one click inside that embed to actually start sound.

   WHY NOT TRUE AUTOPLAY: every browser (Chrome, Firefox, Safari — not just
   one) blocks audio-with-sound from starting without a direct user
   gesture on that same page. This is enforced by the browser itself, not
   by Spotify, so no other streaming embed (YouTube, SoundCloud, Bandcamp,
   Deezer…) can legally bypass it either — swapping services wouldn't
   change anything. The one real workaround (turning the whole site into
   a single-page app so the click that leaves the landing page is the
   very same gesture that starts a native <audio> element, with no full
   navigation in between to lose that gesture) is a much bigger rebuild
   than this fix, so for now: the panel auto-opens on arrival (below) so
   the player is sitting right there, one click from playing, instead of
   hidden behind a menu.

   TO CHANGE THE PLAYLIST: edit data-spotify-playlist on the .music-player
   element in neon.html / horror.html — any public Spotify playlist ID works.
   ========================================================================== */
(function(){
  var players = [];
  
  document.querySelectorAll('.music-player').forEach(function(box){
    var btn = box.querySelector('.music-toggle');
    var panel = box.querySelector('.music-panel');
    var id = box.getAttribute('data-spotify-playlist');
    if(!btn || !panel || !id) return;
    var loaded = false;

    function open(){
      if(!loaded){
        var iframe = document.createElement('iframe');
        iframe.src = 'https://open.spotify.com/embed/playlist/' + id + '?utm_source=generator&theme=0';
        iframe.width = '100%';
        iframe.height = '152';
        iframe.style.borderRadius = '14px 14px 0 0';
        iframe.setAttribute('frameborder','0');
        iframe.setAttribute('allow','autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
        iframe.setAttribute('loading','lazy');
        panel.insertBefore(iframe, panel.firstChild);
        loaded = true;
      }
      panel.hidden = false;
      btn.setAttribute('aria-expanded','true');
      box.classList.add('open');
    }
    function close(){
      panel.hidden = true;
      btn.setAttribute('aria-expanded','false');
      box.classList.remove('open');
    }
    btn.addEventListener('click', function(){
      if(btn.getAttribute('aria-expanded') === 'true') close(); else open();
    });
    
    players.push({open: open, box: box});
  });
  
  // Pre-load and open the panel on arrival, so the embed (and its own
  // play button) is already sitting there rather than behind a click.
  function autoOpen(){
    players.forEach(function(player){ player.open(); });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', autoOpen);
  } else {
    autoOpen();
  }
})();
