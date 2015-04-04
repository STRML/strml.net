'use strict';

require('classlist-polyfill');
var Promise = require('bluebird');
var md = require('markdown').markdown.toHTML;
var workText = require('raw!./work.txt');
var pgpText = require('raw!./pgp.txt');
var styleText = [0,1,2,3].map(function(i) { return require('raw!./styles' + i + '.css'); });
var replaceURLs = require('./lib/replaceURLs');

// Ghetto per-browser prefixing
var prefix = require('./lib/getPrefix')();
styleText = styleText.map(function(text) {
  return text.replace(/-webkit-/g, prefix);
});

// Wait for load to get started.
document.addEventListener("DOMContentLoaded", doWork);

// Vars that will help us get er done
var isDev = window.location.hostname === 'localhost';
var speed = isDev ? 0 : 16;
var style, styleEl, workEl, pgpEl;
function doWork(){
  style = document.getElementById('style-tag');
  styleEl = document.getElementById('style-text');
  workEl = document.getElementById('work-text');
  pgpEl = document.getElementById('pgp-text');

  // Mirror user edits back to the style element.
  styleEl.addEventListener('input', function() {
    style.textContent = styleEl.textContent;
  });

  if (!isDev || true) {
    writeTo(styleEl, styleText[0], 0, speed, true, 1)()
    .then(writeTo(workEl, workText, 0, speed, false, 1))
    .then(writeTo(styleEl, styleText[1], 0, speed, true, 1))
    .then(setWorkListener)
    .delay(500)
    .then(writeTo(styleEl, styleText[2], 0, speed, true, 1))
    .then(writeTo(pgpEl, pgpText, 0, speed, false, 16))
    .then(writeTo(styleEl, styleText[3], 0, speed, true, 1));
  } else {
    styleText.forEach(function(text) {
      styleEl.innerHTML += text;
      style.textContent += text;
    });
    setWorkListener();
    pgpEl.innerHTML = pgpText;
  }
}

/**
 * Helpers
 */

//
// Writing to boxes
//

var openComment = false;
var styleBuffer = '';
function writeChar(el, char){
  var fullText = el.innerHTML;
  if (char === '/' && openComment === false) {
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
  el.innerHTML = fullText;

  // Buffer writes to the <style> element so we don't have to paint quite so much.
  styleBuffer += char;
  if (char === ';') {
    style.textContent += styleBuffer;
    styleBuffer = '';
  }
}

function writeSimpleChar(el, char) {
  el.innerHTML += char;
}

var endOfSentence = /[\.\?\!]\s$/;
var endOfBlock = /[^\/]\n\n$/;
function writeTo(el, message, index, interval, mirrorToStyle, charsPerInterval){
  return function() {
    return Promise.try(function() {
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
    })
    .then(function() {
      if (index < message.length) {
        // Schedule another write.
        var thisInterval = interval;
        var thisSlice = message.slice(index - 2, index + 1);
        if (!isDev) {
          if (endOfSentence.test(thisSlice)) thisInterval *= 70;
          if (endOfBlock.test(thisSlice)) thisInterval *= 50;
        }

        return Promise.delay(thisInterval)
        .then(writeTo(el, message, index, interval, mirrorToStyle, charsPerInterval));
      }
    });
  };
}

//
// Fire a listener when scrolling the 'work' box.
//
function setWorkListener() {
  workEl.innerHTML = '<div class="text">' + replaceURLs(workText) + '</div>' +
                     '<div class="md">' + replaceURLs(md(workText)) + '<div>';

  workEl.classList.add('flipped');
  workEl.scrollTop = 9999;

  // flippy floppy
  var flipping = 0;
  require('mouse-wheel')(workEl, function(dx, dy) {
    if (flipping) return;
    var flipped = workEl.classList.contains('flipped');
    var half = (workEl.scrollHeight - workEl.clientHeight) / 2;
    var pastHalf = flipped ? workEl.scrollTop < half : workEl.scrollTop > half;

    // If we're past half, flip the el.
    if (pastHalf) {
      workEl.classList.toggle('flipped');
      flipping = true;
      setTimeout(function() {
        workEl.scrollTop = flipped ? 0 : 9999;
        flipping = false;
      }, 250);
    }

    // Scroll. If we've flipped, flip the scroll direction.
    workEl.scrollTop += (dy * (flipped ? -1 : 1));
  }, true);
}
