'use strict';
module.exports = function() {
  var is_chrome = navigator.userAgent.indexOf('Chrome') > -1;
  var is_explorer = navigator.userAgent.indexOf('MSIE') > -1;
  var is_firefox = navigator.userAgent.indexOf('Firefox') > -1;
  var is_safari = navigator.userAgent.indexOf("Safari") > -1;
  var is_opera = navigator.userAgent.toLowerCase().indexOf("op") > -1;

  if (is_chrome || is_safari || is_opera) return '-webkit-';
  if (is_firefox) return '-moz-';
  if (is_explorer) return '-ms-';
};
