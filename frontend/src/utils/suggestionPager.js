// Keep unconsumed products per category; advance only after buffering a full response.
export const createSuggestionPager = ({ categories, visitedIds = new Set(), userId, fetchPage, pageSize = 12 }) => {
  let buckets = (categories.length ? categories : [null]).map(category => ({ category, page: 1, done: false, items: [] }));
  let seen = new Set(visitedIds);
  let turn = 0;
  return async (signal) => {
    const draft = buckets.map(bucket => ({ ...bucket, items: [...bucket.items] }));
    const nextSeen = new Set(seen);
    let nextTurn = turn;
    const collected = [];
    // Bound work if an entire category consists of already-viewed products.
    let requests = 0;
    while (collected.length < pageSize && requests < draft.length * 2) {
      let progressed = false;
      for (let n = 0; n < draft.length && collected.length < pageSize; n += 1) {
        const bucket = draft[nextTurn % draft.length];
        nextTurn = (nextTurn + 1) % draft.length;
        if (!bucket.items.length && !bucket.done) {
          const data = await fetchPage({ category: bucket.category, page: bucket.page, limit: pageSize, sort: bucket.category ? 'new' : 'popular', signal });
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          requests += 1;
          bucket.items = Array.isArray(data) ? data : data?.items || [];
          bucket.done = Array.isArray(data) || bucket.page >= (data?.pagination?.pages || 1);
          bucket.page += 1;
          progressed = true;
        }
        while (bucket.items.length) {
          progressed = true;
          const item = bucket.items.shift();
          const id = item?._id && String(item._id);
          const owner = item?.user?._id || item?.user?.id || item?.user;
          if (!id || nextSeen.has(id) || (userId && String(owner) === String(userId))) continue;
          collected.push(item);
          nextSeen.add(id);
          break;
        }
      }
      if (!progressed) break;
    }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // Commit atomically: failures leave both cursor and buffered products intact for retry.
    buckets = draft;
    seen = nextSeen;
    turn = nextTurn;
    return { items: collected, hasMore: buckets.some(bucket => bucket.items.length || !bucket.done) };
  };
};
