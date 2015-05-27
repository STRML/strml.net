module.exports = function() {
  // Thanks David Walsh
  var styles = window.getComputedStyle(document.documentElement, ''),
  pre = (Array.prototype.slice
        .call(styles)
        .join('')
        .match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
      )[1];
  return '-' + pre + '-';
};
