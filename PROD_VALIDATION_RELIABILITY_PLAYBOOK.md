# HDMarket Production Validation Reliability Playbook

## 0) Global Error Response Contract
```json
{
  "success": false,
  "message": "User-safe message",
  "code": "ERROR_CODE",
  "requestId": "trace-id"
}
```
- Backend sends `x-request-id` for every request.
- Never expose raw stack traces in production.

## 1) Backend Controller Pattern (safe async template)
```js
export const submitSomething = async (req, res, next) => {
  const startedAt = Date.now();
  try {
    // 1) Validate input early
    // 2) Use lean() for read-only fetches
    // 3) Keep writes minimal and atomic
    const result = await SomeModel.findOne({ _id: req.params.id }).lean();
    if (!result) {
      return res.status(404).json({ message: 'Ressource introuvable.' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  } finally {
    const ms = Date.now() - startedAt;
    if (ms > 2000) {
      console.warn(`[slow-controller] ${req.method} ${req.originalUrl} ${ms}ms`);
    }
  }
};
```

## 2) Timeout Middleware
- Added in codebase: `backend/middlewares/requestReliability.js`
- Behavior:
  - hard timeout per request (default 10s) -> `504 REQUEST_TIMEOUT`
  - multipart upload timeout (default 60s)
  - slow endpoint logging (default > 2s)
  - response guards to avoid double-send after timeout

## 3) Frontend Mutation Reliability Pattern (React Query)
```js
const mutation = useMutation({
  mutationFn: submitApiCall,
  onMutate: async (payload) => {
    await queryClient.cancelQueries({ queryKey: ['resource', payload.id] });
    const previous = queryClient.getQueryData(['resource', payload.id]);
    queryClient.setQueryData(['resource', payload.id], (old) => ({ ...old, ...payload, _optimistic: true }));
    return { previous };
  },
  onError: (err, payload, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(['resource', payload.id], ctx.previous);
  },
  onSuccess: () => {
    // navigate/feedback immediately, do not wait full refetch chain
  },
  onSettled: (_data, _error, payload) => {
    queryClient.invalidateQueries({ queryKey: ['resource', payload.id] });
  }
});
```

## 4) Button Guard Pattern
```js
if (isSubmitting) return;
setIsSubmitting(true);
try {
  await mutation.mutateAsync(payload);
} catch (e) {
  // show explicit error
} finally {
  setIsSubmitting(false);
}
```

## 5) Timeout-Safe Error Messaging
- Added in `frontend/src/services/api.js`:
  - request timeout default `VITE_API_TIMEOUT_MS` (fallback `12000`)
  - timeout/network errors mapped to user-safe messages
  - helper exports:
    - `isApiTimeoutError(error)`
    - `getApiErrorMessage(error, fallback)`

## 6) Duplicate Submission Protection
- Axios retry now limited to idempotent methods (`GET/HEAD/OPTIONS`) only.
- No retry for `POST/PUT/PATCH/DELETE` to avoid duplicate writes.
- Auto `Idempotency-Key` header attached for mutation requests.

## 7) Render Production Checklist
- Set env:
  - `REQUEST_TIMEOUT_MS=10000`
  - `UPLOAD_REQUEST_TIMEOUT_MS=60000`
  - `SLOW_REQUEST_THRESHOLD_MS=2000`
  - `HTTP_KEEP_ALIVE_TIMEOUT_MS=65000`
  - `HTTP_HEADERS_TIMEOUT_MS=66000`
  - `VITE_API_TIMEOUT_MS=12000`
- Optional keep-alive probe:
  - `RENDER_KEEP_ALIVE_ENABLED=true`
  - `RENDER_EXTERNAL_URL=https://<your-service>.onrender.com`
  - `RENDER_KEEP_ALIVE_INTERVAL_MS=600000`

## 7.1) Request Tracing & Security
- Middleware: `requestContextMiddleware`
  - attaches `req.requestId`
  - returns `x-request-id` header
- Centralized handler: `globalErrorHandler`
  - classifies errors
  - redacts sensitive fields in logs
  - can persist critical 5xx errors in `ErrorLog`

## 8) MongoDB Index Checklist (validation/order hotspots)
- `orders: { status, createdAt }`
- `orders: { customer, createdAt }`
- `orders: { items.snapshot.shopId, createdAt, status }`
- `orders: { expectedDeliveryDate, status }`
- `users: { role }`, `users: { isActive }`, `users: { isLocked }`
- Ensure `lean()` for read-only list queries.

## 9) Debugging Checklist (infinite loading)
- Confirm request reaches server logs.
- Confirm endpoint returns exactly one response.
- Check `requestTimedOut` warnings in backend logs.
- Check browser network tab for pending calls > timeout.
- Verify frontend `finally` runs (loading resets).
- Verify mutation not blocked by repeated retries.

## 10) UX Reliability Pattern
- Always disable submit button while pending.
- Show clear states:
  - `Traitement...`
  - `Réessayer`
  - timeout-specific message
- Navigate on mutation success directly.
- Invalidate/refetch in background (not blocking navigation).
