function formatTweetTime(date: Date, a11y: boolean = false) {
  const timeFormatted = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  const dateFormatted = date.toLocaleString('en-US', { month: 'short', year: 'numeric', day: 'numeric' });
  return a11y ? `${timeFormatted} ${dateFormatted}` : `${timeFormatted} · ${dateFormatted}`;
}

export default formatTweetTime;
