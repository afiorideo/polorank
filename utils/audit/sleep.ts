/** PoloRank — a pause, in its own module so tests can replace it instead of waiting for real seconds. */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

export default sleep;
