require('classlist-polyfill');
var Promise = require('bluebird');
var md = require('markdown').markdown.toHTML;
var workText = require('raw!./work.txt');
var pgpText = require('raw!./pgp.txt');
var headerHTML = require('raw!./header.html');
var styleText = [0, 1, 2, 3].map(function(i) { return require('raw!./styles' + i + '.css'); });
var preStyles = require('raw!./prestyles.css');
var replaceURLs = require('./lib/replaceURLs');

// Ghetto per-browser prefixing
var browserPrefix = require('./lib/getPrefix')();
if (browserPrefix) {
  styleText = styleText.map(function(text) {
    return text.replace(/-webkit-/g, browserPrefix);
  });
}


// Wait for load to get started.
document.addEventListener("DOMContentLoaded", doWork);

// Vars that will help us get er done
var isDev = window.location.hostname === 'localhost';
var speed = isDev ? 0 : 16;
var style, styleEl, workEl, pgpEl, skipAnimationEl, pauseEl;
var animationSkipped = false, done = false;
var paused = false;
async function doWork(){
  // We're cheating a bit on styles.
  var preStyleEl = document.createElement('style');
  preStyleEl.textContent = preStyles;
  document.head.insertBefore(preStyleEl, document.getElementsByTagName('style')[0]);

  // Populate header.
  var header = document.getElementById('header');
  header.innerHTML = headerHTML;

  // El refs
  style = document.getElementById('style-tag');
  styleEl = document.getElementById('style-text');
  workEl = document.getElementById('work-text');
  pgpEl = document.getElementById('pgp-text');
  skipAnimationEl = document.getElementById('skip-animation');
  pauseEl = document.getElementById('pause-resume');

  createEventHandlers();

  if (!isDev || true) {
    run();
  } else {
    getSomeoneElseToDoTheWork();
  }
}

function createEventHandlers() {
  // Mirror user edits back to the style element.
  styleEl.addEventListener('input', function() {
    style.textContent = styleEl.textContent;
  });

  // Skip anim on click to skipAnimation
  skipAnimationEl.addEventListener('click', function(e) {
    e.preventDefault();
    animationSkipped = true;
  });

  pauseEl.addEventListener('click', function(e) {
    e.preventDefault();
    if (paused) {
      pauseEl.textContent = "Pause ||";
      paused = false;
    } else {
      pauseEl.textContent = "Resume >>";
      paused = true;
    }
  });
}

async function run() {
  try {
    await writeTo(styleEl, styleText[0], 0, speed, true, 1);
    await writeTo(workEl, workText, 0, speed, false, 1);
    await writeTo(styleEl, styleText[1], 0, speed, true, 1);
    setWorkListener();
    await Promise.delay(1000);
    await writeTo(styleEl, styleText[2], 0, speed, true, 1);
    await writeTo(pgpEl, pgpText, 0, speed, false, 32);
    await writeTo(styleEl, styleText[3], 0, speed, true, 1);
  }
  // Flow control straight from the ghettos of Milwaukee
  catch(e) {
    if (e.message === "SKIP IT") {
      getSomeoneElseToDoTheWork();
    }
  }
}

// Skips all the animations.
function getSomeoneElseToDoTheWork() {
  if (done) return;
  done = true;
  pgpEl.innerHTML = pgpText;
  var txt = styleText.join('\n');

  // The work-text animations are rough
  style.textContent = "#work-text * { " + browserPrefix + "transition: none; }";
  style.textContent += txt;
  var styleHTML = "";
  for(var i = 0; i < txt.length; i++) {
     styleHTML = handleChar(styleHTML, txt[i]);
  }
  styleEl.innerHTML = styleHTML;
  setWorkListener();

  // There's a bit of a scroll problem with this thing
  var start = Date.now();
  var interval = setInterval(function() {
    workEl.scrollTop = Infinity;
    styleEl.scrollTop = pgpEl.scrollTop = Infinity;
    if (Date.now() - 1000 > start) clearInterval(interval);
  }, 0);
}


/**
 * Helpers
 */

//
// Writing to boxes
//

var openComment = false;
var styleBuffer = '';
var fullTextStorage = {};
function writeChar(el, char){
  // Grab text. We buffer it in storage so we don't have to read from the DOM every iteration.
  var fullText = fullTextStorage[el.id];
  if (!fullText) fullText = fullTextStorage[el.id] = el.innerHTML;

  fullText = handleChar(fullText, char);
  // But we still write to the DOM every iteration, which can be pretty slow.
  el.innerHTML = fullTextStorage[el.id] = fullText;

  // Buffer writes to the <style> element so we don't have to paint quite so much.
  styleBuffer += char;
  if (char === ';') {
    style.textContent += styleBuffer;
    styleBuffer = '';
  }
}

function handleChar(fullText, char) {
  if (openComment && char !== '/') {
    // Short-circuit during a comment so we don't highlight inside it.
    fullText += char;
  } else if (char === '/' && openComment === false) {
    openComment = true;
    fullText += char;
  } else if (char === '/' && fullText.slice(-1) === '*' && openComment === true) {
    openComment = false;
    // Unfortunately we can't just open a span and close it, because the browser will helpfully
    // 'fix' it for us, and we'll end up with a single-character span and an empty closing tag.
    fullText = fullText.replace(/(\/\*(?:[^](?!\/\*))*\*)$/, '<span class="comment">$1/</span>');
  } else if (char === ':') {
    fullText = fullText.replace(/([a-zA-Z- ^\n]*)$/, '<span class="key">$1</span>:');
  } else if (char === ';') {
    fullText = fullText.replace(/([^:]*)$/, '<span class="value">$1</span>;');
  } else if (char === '{') {
    fullText = fullText.replace(/(.*)$/, '<span class="selector">$1</span>{');
  } else if (char === 'x' && /\dp/.test(fullText.slice(-2))) {
    fullText = fullText.replace(/p$/, '<span class="value px">px</span>');
  } else {
    fullText += char;
  }
  return fullText;
}

function writeSimpleChar(el, char) {
  el.innerHTML += char;
}

var endOfSentence = /[\.\?\!]\s$/;
var endOfBlock = /[^\/]\n\n$/;

async function writeTo(el, message, index, interval, mirrorToStyle, charsPerInterval){
  if (animationSkipped) {
    // Lol who needs proper flow control
    throw new Error('SKIP IT');
  }
  // Write a character or multiple characters to the buffer.
  var chars = message.slice(index, index + charsPerInterval);
  index += charsPerInterval;

  // Ensure we stay scrolled to the bottom.
  el.scrollTop = el.scrollHeight;

  // If this is going to <style> it's more complex; otherwise, just write.
  if (mirrorToStyle) {
    writeChar(el, chars);
  } else {
    writeSimpleChar(el, chars);
  }

  // Schedule another write.
  if (index < message.length) {
    var thisInterval = interval;
    var thisSlice = message.slice(index - 2, index + 1);
    if (!isDev) {
      if (endOfSentence.test(thisSlice)) thisInterval *= 70;
      if (endOfBlock.test(thisSlice)) thisInterval *= 50;
    }

    do {
      await Promise.delay(thisInterval);
    } while(paused);

    return writeTo(el, message, index, interval, mirrorToStyle, charsPerInterval);
  }
}

//
// Fire a listener when scrolling the 'work' box.
//
function setWorkListener() {
  if (workEl.classList.contains('flipped')) return;
  workEl.innerHTML = '<div class="text">' + replaceURLs(workText) + '</div>' +
                     '<div class="md">' + replaceURLs(md(workText)) + '<div>';

  workEl.classList.add('flipped');
  workEl.scrollTop = 9999;

  // flippy floppy
  var flipping = 0;
  require('mouse-wheel')(workEl, async function(dx, dy) {
    if (flipping) return;
    var flipped = workEl.classList.contains('flipped');
    var half = (workEl.scrollHeight - workEl.clientHeight) / 2;
    var pastHalf = flipped ? workEl.scrollTop < half : workEl.scrollTop > half;

    // If we're past half, flip the el.
    if (pastHalf) {
      workEl.classList.toggle('flipped');
      flipping = true;
      await Promise.delay(500);
      workEl.scrollTop = flipped ? 0 : 9999;
      flipping = false;
    }

    // Scroll. If we've flipped, flip the scroll direction.
    workEl.scrollTop += (dy * (flipped ? -1 : 1));
  }, true);
}
