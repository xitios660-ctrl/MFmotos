(function(){
  var section=document.querySelector('#login'),video=document.querySelector('#cinemaVideo'),pause=document.querySelector('#cinemaMotionToggle'),throttle=document.querySelector('#cinemaThrottle');
  var preference=window.matchMedia('(prefers-reduced-motion: reduce)'),active=true,userPaused=false,failed=false,frame=0,point=null;
  function resetRev(){section.classList.remove('login-revving');video.playbackRate=.8;throttle.setAttribute('aria-pressed','false')}
  function sync(){
    var stopped=!active||userPaused||preference.matches||document.hidden||failed;
    section.classList.toggle('login-motion-paused',stopped);
    pause.setAttribute('aria-label',stopped?'Reproduzir animação da moto':'Pausar animação da moto');pause.setAttribute('aria-pressed',String(userPaused));
    pause.innerHTML=stopped?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 3 11 7-11 7z"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h3v14H5zM12 3h3v14h-3z"/></svg>';
    pause.disabled=preference.matches||failed;throttle.disabled=preference.matches||failed||userPaused;
    if(stopped){video.pause();resetRev()}else{video.playbackRate=.8;var play=video.play();if(play)play.catch(function(){failed=true;sync()})}
  }
  window.setLoginMotionActive=function(value){active=!!value;sync()};
  pause.addEventListener('click',function(){userPaused=!userPaused;sync()});
  function rev(){if(throttle.disabled||preference.matches)return;section.classList.add('login-revving');video.playbackRate=1.8;throttle.setAttribute('aria-pressed','true')}
  throttle.addEventListener('pointerdown',rev);throttle.addEventListener('pointerleave',resetRev);
  throttle.addEventListener('keydown',function(e){if(e.key===' '||e.key==='Enter'){e.preventDefault();rev()}});
  throttle.addEventListener('keyup',resetRev);
  ['pointerup','pointercancel'].forEach(function(event){window.addEventListener(event,resetRev)});
  window.addEventListener('blur',resetRev);
  video.addEventListener('error',function(){failed=true;sync()});
  preference.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);
  section.addEventListener('pointermove',function(e){
    if(preference.matches||e.pointerType==='touch'||!active)return;point={x:e.clientX,y:e.clientY};if(frame)return;
    frame=requestAnimationFrame(function(){frame=0;var r=section.getBoundingClientRect();section.style.setProperty('--lx',((point.x-r.left)/r.width*100).toFixed(1)+'%');section.style.setProperty('--ly',((point.y-r.top)/r.height*100).toFixed(1)+'%')});
  });
  section.addEventListener('pointerleave',function(){if(frame)cancelAnimationFrame(frame);frame=0;section.style.setProperty('--lx','50%');section.style.setProperty('--ly','50%')});
  sync();
})();
