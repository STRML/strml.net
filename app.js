'use strict';

var dataText = require('raw!./data.txt');
var pgpText = require('raw!./pgp.txt');
var styleText = require('raw!./styles.css');
var prefix = require('./lib/getPrefix')();
styleText = styleText.replace(/-webkit-/g, prefix);

document.addEventListener("DOMContentLoaded", doWork);

var openComment = false;
var isDev = window.location.hostname === 'localhost' && false;
var speed = isDev ? 4 : 16;
var style, styleEl, dataEl, pgpEl;

function doWork(){
  style = document.getElementById('style-tag');
  styleEl = document.getElementById('style-text');
  dataEl = document.getElementById('data-text');
  pgpEl = document.getElementById('pgp-text');

  styleEl.addEventListener('input', onStyleElChange);

  // starting it off
  writeTo(styleEl, styleText, 0, speed, true, 1, function() {
    writeTo(dataEl, dataText, 0, speed, false, 1, function() {
      writeTo(pgpEl, pgpText, 0, speed, false, 16);
    });
  });
}

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
function writeTo(el, message, index, interval, mirrorToStyle, charsPerInterval, callback){
  if (index < message.length) {

    // Write a character or multiple characters to the buffer.
    var chars = message.slice(index, index + charsPerInterval);
    index += charsPerInterval;
    el.scrollTop = el.scrollHeight;
    if (mirrorToStyle) {
      writeChar(el, chars);
    } else {
      writeSimpleChar(el, chars);
    }

    // Schedule another write.
    var thisInterval = interval;
    var thisSlice = message.slice(index - 2, index + 1);
    if (!isDev) {
      if (endOfSentence.test(thisSlice)) thisInterval *= 70;
      if (endOfBlock.test(thisSlice)) thisInterval *= 50;
    }

    setTimeout(function() {
      writeTo(el, message, index, interval, mirrorToStyle, charsPerInterval, callback);
    }, thisInterval);
  } else {
    callback && callback();
  }
}

function onStyleElChange(e) {
  style.textContent = styleEl.textContent;
}
