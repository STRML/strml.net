// How long to wait after a keystroke. Humans pause to think; so does this.
const endOfSentence = /[\.\?\!]\s$/;
const comma = /\D[\,]\s$/;
const endOfBlock = /[^\/]\n\n$/;

// `slice` is the last couple of characters written plus the next one.
export default function pauseFor(slice, interval) {
  if (endOfSentence.test(slice)) return interval * 70;
  if (endOfBlock.test(slice)) return interval * 50;
  if (comma.test(slice)) return interval * 30;
  return interval;
}
