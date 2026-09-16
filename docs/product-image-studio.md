# Product image studio

In the product creation or editing form, add a photo and select **Studio complet** below its preview. The existing **Retoucher** tool remains available for background removal and other HDMarket-specific operations.

The complete studio provides crop/aspect ratios, rotation, mirroring, brightness/contrast/color adjustments, filters, text, freehand drawing, shapes, arrows, image overlays, watermarks, resizing, undo/redo and original-image comparison. **Appliquer à la photo** exports PNG, JPEG or WebP into the current form. The product must still be saved/published to upload that replacement. Existing photo order and variant associations are preserved by the shared form save handler.

The editor is `react-filerobot-image-editor` (MIT license): https://github.com/scaleflex/filerobot-image-editor. It requires no subscription, API key or paid processing endpoint. Translations are bundled locally; edits and export run in the browser. Existing remote product images still need to be downloaded with valid CORS headers. An image that cannot load must be uploaded again from the device.

The editor loads only when opened. Its error boundary preserves the form if loading fails. Closing with pending changes asks for confirmation. Exports above 10 MiB are rejected with a request to reduce dimensions or use WebP. Exported photos are flattened; reopening starts from the latest photo rather than editable layers from a previous session.

Validation: image export unit tests, existing image studio state and product-form utility tests, production build, and headless Chrome at desktop and mobile viewport sizes. Browser checks use a generated local image and a stub form-save callback, without publishing a real listing.

## Free background removal

**Retirer le fond · Gratuit** exports the current edits and runs the Apache-2.0 licensed `onnx-community/ormbg-ONNX` model locally in a worker using Transformers.js/WASM. The first use downloads model/runtime assets; photos are not sent to an inference API. Subsequent use can reuse the browser cache. Download progress, cancellation, retry after failures, and returning to the pre-removal image are supported. Canceling the only running request terminates the worker.

After removal, the studio selects PNG by default. PNG and WebP preserve transparency; JPEG does not. Background removal flattens existing edits into the new image, with a dedicated return-to-before-removal button. Fine edges and transparent products may need manual review. Model source/license: https://huggingface.co/onnx-community/ormbg-ONNX.
