const urlRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w\-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w!\/]*))?)/g;

export default function createAnchors(message) {
  return regexReplace(message, urlRegex, function(match) {
    // Don't break <img src="http:..." /> or mailtos or other anchors
    if (/(src=|href=|mailto:)/.test(message.slice(message.indexOf(match) - 7).slice(0, 7))) return match;
    let href = match;
    if (match.slice(0, 4) !== 'http') href = 'http://' + href;
    return '<a href="' + href + '" target="_blank">' + match.replace('www.', '') + '</a>';
  });
};

// Simple regex replace function.
export function regexReplace(message, regex, replace) {
  const match = message.match(regex);
  if (match && match.length) {
    for (let i = 0; i < match.length; i++) {
      message = message.replace(match[i], (typeof replace === 'function' ? replace(match[i]) : replace));
    }
  }
  return message;
}
