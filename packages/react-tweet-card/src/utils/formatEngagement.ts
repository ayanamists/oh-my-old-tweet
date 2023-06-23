function formatEngagement(amount: number) {
  if (amount / 1000000 > 1) {
    const M = Math.floor(amount / 1000000);
    const remainder = Math.floor((amount % 1000000) / 100000);
    return remainder ? `${M}.${remainder}M` : `${M}M`;
  }

  if (amount / 1000 > 1) {
    const K = Math.floor(amount / 1000);
    const remainder = Math.floor((amount % 1000) / 100);
    return remainder ? `${K}.${remainder}K` : `${K}K`;
  }

  return amount;
}

export default formatEngagement;
