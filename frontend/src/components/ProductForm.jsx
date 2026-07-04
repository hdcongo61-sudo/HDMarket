import React, { useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import api, { isApiPossiblyCommittedError } from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { Upload, Camera, DollarSign, Tag, FileText, Package, Send, AlertCircle, CheckCircle2, Video, Trash2, Crop, Eye, X, Maximize2, Minimize2, ChevronDown, ChevronUp, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, ZoomIn, ZoomOut, Plus, ShieldCheck, CreditCard, Boxes, Megaphone, Lock, SlidersHorizontal, Sun, Contrast, Droplet, Calendar, Clock, Percent, Users, Wallet, ArrowRight } from 'lucide-react';
import useCategories from '../hooks/useCategories';
import ProductCard from './ProductCard';
import useIsMobile from '../hooks/useIsMobile';
import useCommissionRate from '../hooks/useCommissionRate';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import BaseModal from './modals/BaseModal';
import { appAlert } from '../utils/appDialog';
import { normalizeProductAttributes } from '../utils/productAttributes';
import { isValidSocialVideoUrl } from '../utils/socialVideo';
import { formatFileSize, optimizeImageFiles } from '../utils/mediaOptimizer';
import { createIdempotencyKey } from '../utils/idempotency';

const isCloudinaryUrl = (url = '') =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/');

const thumbImageUrl = (url = '', size = 300) => {
  if (!isCloudinaryUrl(url)) return url;
  return url.replace('/upload/', `/upload/c_fill,g_auto,w_${size},h_${size},q_auto,f_auto/`);
};

const DEFAULT_MAX_IMAGES = 3;
const MAX_VIDEO_SIZE_MB = 20;
const BYTES_PER_MB = 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * BYTES_PER_MB;
const VIDEO_COMPRESS_TARGET_BYTES = Math.floor(MAX_VIDEO_SIZE_BYTES * 0.86);
const VIDEO_COMPRESS_MAX_WIDTH = 1280;
const VIDEO_COMPRESS_MAX_HEIGHT = 720;
const VIDEO_COMPRESS_FPS = 24;
const VIDEO_MIN_BITRATE = 550_000;
const VIDEO_MAX_BITRATE = 2_200_000;
const VIDEO_AUDIO_BITRATE = 64_000;
const MAX_PDF_SIZE_MB = 10;
const ATTRIBUTE_TYPE_OPTIONS = [
  'Color',
  'Size',
  'Weight',
  'Material',
  'Custom'
];
const ATTRIBUTE_INPUT_TYPES = [
  { value: 'select', label: 'Choix' },
  { value: 'text', label: 'Texte' },
  { value: 'number', label: 'Nombre' }
];
const ATTRIBUTE_TEMPLATE = {
  name: 'Color',
  type: 'select',
  options: [''],
  required: false,
  defaultValue: ''
};
const pickVideoRecorderMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
};

const calculateVideoOutputSize = (width, height) => {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const scale = Math.min(1, VIDEO_COMPRESS_MAX_WIDTH / safeWidth, VIDEO_COMPRESS_MAX_HEIGHT / safeHeight);
  const outputWidth = Math.max(2, Math.round((safeWidth * scale) / 2) * 2);
  const outputHeight = Math.max(2, Math.round((safeHeight * scale) / 2) * 2);
  return { width: outputWidth, height: outputHeight, scale };
};
const DeleteIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 7h12l-1 14H7L6 7z"
    />
  </svg>
);

export default function ProductForm(props) {
  const {
    onCreated,
    onUpdated,
    initialValues,
    productId,
    submitLabel,
    embeddedInModal = false,
    hideHeader = false,
    onCancel
  } = props;
  const { runtime, app } = useAppSettings();
  const { commissionRatePercent, commissionRateLabel } = useCommissionRate();
  const { categoryGroups } = useCategories();
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used',
    operator: 'MTN',
    discount: '',
    installmentEnabled: false,
    installmentMinAmount: '',
    installmentDuration: '',
    installmentStartDate: '',
    installmentEndDate: '',
    installmentLatePenaltyRate: '',
    installmentMaxMissedPayments: 3,
    installmentRequireGuarantor: false,
    wholesaleEnabled: false,
    wholesaleTiers: [],
    warrantyEnabled: false,
    warrantyPeriodValue: '',
    warrantyPeriodUnit: 'months',
    attributes: [],
    physical: {
      weight: { value: '', unit: 'kg' },
      dimensions: { length: '', width: '', height: '', unit: 'cm' }
    },
    deliveryAvailable: true,
    pickupAvailable: true,
    deliveryFeeEnabled: true,
    deliveryFee: '',
    socialVideoUrl: ''
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const imagePreviewsRef = useRef([]);
  const [existingImages, setExistingImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [imageError, setImageError] = useState('');
  // Image-first variants (Taobao style): each photo can carry an option label
  // and its price, edited right below the image. Keyed by the combined image
  // index ([existing…, new…]); serialized into one select attribute at submit.
  const [imageVariantName, setImageVariantName] = useState('Couleur');
  const [imageVariants, setImageVariants] = useState({});
  const { user } = useContext(AuthContext);
  const isBoutiqueOwner = user?.accountType === 'shop';
  const canUploadVideo = Boolean(user?.shopVerified && user?.accountType === 'shop');
  const canUploadPdf = user?.accountType === 'shop';
  const [videoFile, setVideoFile] = useState(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState(null);
  const [removeExistingVideo, setRemoveExistingVideo] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfError, setPdfError] = useState('');
  const [installmentError, setInstallmentError] = useState('');
  const [wholesaleError, setWholesaleError] = useState('');
  const [warrantyError, setWarrantyError] = useState('');
  const [existingPdf, setExistingPdf] = useState(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaOptimization, setMediaOptimization] = useState({
    active: false,
    optimizedCount: 0,
    savedBytes: 0
  });
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isCompressingVideo, setIsCompressingVideo] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [originalVideoSize, setOriginalVideoSize] = useState(0);
  
  // Image cropping states
  const [croppingImage, setCroppingImage] = useState(null);
  const [cropData, setCropData] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [cropAspect, setCropAspect] = useState('1:1'); // default = card display (square); also: null = free, '4:3', '16:9'
  const [cropTab, setCropTab] = useState('crop'); // 'crop' | 'filters'
  const [imageFilters, setImageFilters] = useState({ brightness: 100, contrast: 100, saturate: 100 });
  const [isResizingCrop, setIsResizingCrop] = useState(null); // null | 'se' | 'sw' | 'ne' | 'nw'
  const cropCanvasRef = useRef(null);
  const cropContainerRef = useRef(null);
  const imageRef = useRef(null);
  const cropMoveRef = useRef(() => {});
  const cropUpRef = useRef(() => {});
  const submitIdempotencyKeyRef = useRef('');
  // New: pinch-to-zoom tracking refs
  const pinchDistRef = useRef(null);
  const pinchScaleRef = useRef(null);
  // New: natural image dimensions (reliable source of truth for crop math)
  const imgNaturalSizeRef = useRef({ w: 0, h: 0 });

  // Relative to the scale that fills the frame: 1 = fitted, 0.1 = 10%.
  const CROP_MIN_ZOOM = 0.1;
  const CROP_MAX_ZOOM = 5;
  const ASPECT_PRESETS = { '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '4:3': 4 / 3, '16:9': 16 / 9 };
  // Product cards display the image as a square (ui-media-frame-square), so the
  // crop/edit editor defaults to this ratio to match how the image will appear.
  const CARD_DISPLAY_ASPECT = '1:1';
  const DEFAULT_IMAGE_FILTERS = { brightness: 100, contrast: 100, saturate: 100 };
  const filtersAreDefault =
    imageFilters.brightness === 100 && imageFilters.contrast === 100 && imageFilters.saturate === 100;
  // CSS filter string used for both the live preview and the exported canvas.
  const filterCss = filtersAreDefault
    ? 'none'
    : `brightness(${imageFilters.brightness}%) contrast(${imageFilters.contrast}%) saturate(${imageFilters.saturate}%)`;
  const [showPreview, setShowPreview] = useState(false);
  const [payWithWallet, setPayWithWallet] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoPreview, setPromoPreview] = useState(null); // { valid, discount, waived, message }
  const isMobile = useIsMobile(768);
  const maxImagesLimit = useMemo(() => {
    const candidates = [runtime?.max_image_upload, runtime?.maxUploadImages, app?.maxUploadImages, DEFAULT_MAX_IMAGES];
    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (Number.isInteger(parsed) && parsed >= 1) {
        return Math.min(parsed, 20);
      }
    }
    return DEFAULT_MAX_IMAGES;
  }, [app?.maxUploadImages, runtime?.maxUploadImages, runtime?.max_image_upload]);
  const [expandedSections, setExpandedSections] = useState({
    info: true,
    commercialisation: true,
    options: true,
    images: true,
    media: true,
    validation: true,
    preview: false
  });
  const formShellRef = useRef(null);
  const toggleSection = (key) => setExpandedSections((s) => ({ ...s, [key]: !s[key] }));
  const isEmbeddedMobile = Boolean(isMobile && embeddedInModal);

  useEffect(() => {
    if (!isEmbeddedMobile || !formShellRef.current) return undefined;

    const container = formShellRef.current;
    let frameId = null;
    const shouldAutoScrollFocusedField = (target) => {
      if (!(target instanceof HTMLElement)) return false;
      if (!target.matches('input, textarea, select')) return false;
      if (target.classList.contains('sr-only')) return false;

      const inputType = String(target.getAttribute('type') || '').toLowerCase();
      if (['checkbox', 'radio', 'file', 'hidden', 'button', 'submit'].includes(inputType)) {
        return false;
      }

      const rect = target.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    };

    const handleFocusIn = (event) => {
      const target = event.target;
      if (!shouldAutoScrollFocusedField(target)) return;

      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        target.scrollIntoView({
          block: 'center',
          behavior: 'smooth'
        });
      });
    };

    container.addEventListener('focusin', handleFocusIn);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      container.removeEventListener('focusin', handleFocusIn);
    };
  }, [isEmbeddedMobile]);

  const handleImageChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    const maxSelectable = Math.max(0, maxImagesLimit - existingImages.length - files.length);
    if (maxSelectable === 0) {
      setImageError(`Maximum ${maxImagesLimit} photos au total. Supprimez une image pour en ajouter.`);
      e.target.value = '';
      return;
    }
    const limitedFiles = selectedFiles.slice(0, maxSelectable);
    if (selectedFiles.length > maxSelectable) {
      setImageError(`Maximum ${maxImagesLimit} photos au total. Seules les premières ont été conservées.`);
    } else {
      setImageError('');
    }

    setMediaOptimization((prev) => ({ ...prev, active: true }));
    let optimizedFiles = limitedFiles;
    let optimizationResult = null;
    try {
      optimizationResult = await optimizeImageFiles(limitedFiles);
      optimizedFiles = optimizationResult.files;
    } catch {
      optimizedFiles = limitedFiles;
    } finally {
      setMediaOptimization({
        active: false,
        optimizedCount: optimizationResult?.optimizedCount || 0,
        savedBytes: optimizationResult?.savedBytes || 0
      });
    }

    const newItems = optimizedFiles.map((f) => ({ file: f, cropped: false, leftAsIs: false }));
    const newPreviews = optimizedFiles.map((file) => ({
      url: URL.createObjectURL(file),
      name: file.name
    }));

    setFiles((prev) => [...prev, ...newItems]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  // ── NEW CROP SYSTEM: fixed frame, image pans/zooms behind it ──────────
  // The crop frame IS the canvas. Image must always cover the frame.
  // Aspect ratio buttons resize the frame overlay, image adjusts to cover it.

  // Pure helper: compute crop frame rectangle (canvas-relative, px)
  const computeCropFrame = (cw, ch, aspect) => {
    if (!aspect) return { x: 0, y: 0, w: cw, h: ch };
    const ratio = ASPECT_PRESETS[aspect];
    let w = cw;
    let h = w / ratio;
    if (h > ch) { h = ch; w = h * ratio; }
    return {
      x: Math.round((cw - w) / 2),
      y: Math.round((ch - h) / 2),
      w: Math.round(w),
      h: Math.round(h)
    };
  };

  // Minimum scale to make the image exactly cover the crop frame
  const computeMinScale = (frame, nw, nh) => {
    if (!nw || !nh) return 0.1;
    return Math.max(frame.w / nw, frame.h / nh);
  };

  // Keep the image reachable inside the frame. When zoomed below the fitted
  // size, allow it to move freely across the available empty space.
  const clampImagePos = (pos, scale, frame, nw, nh) => {
    const sw = nw * scale;
    const sh = nh * scale;
    const clampAxis = (value, frameStart, frameSize, imageSize) => {
      if (imageSize <= frameSize) {
        return Math.min(frameStart + frameSize - imageSize, Math.max(frameStart, value));
      }
      return Math.min(frameStart, Math.max(frameStart + frameSize - imageSize, value));
    };
    return {
      x: clampAxis(pos.x, frame.x, frame.w, sw),
      y: clampAxis(pos.y, frame.y, frame.h, sh)
    };
  };

  // Pinch distance helper
  const getTouchDist = (t1, t2) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Open crop editor: load image, fit-to-cover the canvas, reset aspect
  const initializeCropArea = (imageUrl, forceAspect = null) => {
    const img = new Image();
    img.onload = () => {
      const container = cropContainerRef.current;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      imgNaturalSizeRef.current = { w: nw, h: nh };
      const frame = computeCropFrame(cw, ch, forceAspect);
      const minScale = computeMinScale(frame, nw, nh);
      const scaledW = nw * minScale;
      const scaledH = nh * minScale;
      setCropAspect(forceAspect);
      setImageScale(minScale);
      setImagePosition({
        x: frame.x + (frame.w - scaledW) / 2,
        y: frame.y + (frame.h - scaledH) / 2
      });
    };
    img.src = imageUrl;
  };

  // Zoom toward a canvas pivot point; clamp scale + position
  const doZoom = useCallback((newScale, pivotX, pivotY, currentScale, currentPos, aspect) => {
    const container = cropContainerRef.current;
    if (!container) return;
    const { w: nw, h: nh } = imgNaturalSizeRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const frame = computeCropFrame(cw, ch, aspect);
    const minScale = computeMinScale(frame, nw, nh);
    const lowestScale = minScale * CROP_MIN_ZOOM;
    const highestScale = Math.max(CROP_MAX_ZOOM, minScale * 5);
    const clampedScale = Math.max(lowestScale, Math.min(highestScale, newScale));
    const ratio = clampedScale / currentScale;
    const rawPos = {
      x: pivotX - (pivotX - currentPos.x) * ratio,
      y: pivotY - (pivotY - currentPos.y) * ratio
    };
    setImageScale(clampedScale);
    setImagePosition(clampImagePos(rawPos, clampedScale, frame, nw, nh));
  }, []); // stable — reads all values from args

  // Mouse/touch event handlers
  const handleCropMouseDown = (e) => {
    if (!croppingImage) return;
    setIsPanning(true);
    setPanStart({ startX: e.clientX, startY: e.clientY, startPos: { ...imagePosition } });
  };

  const handleCropTouchStart = (e) => {
    if (!croppingImage) return;
    if (e.touches.length === 2) {
      pinchDistRef.current = getTouchDist(e.touches[0], e.touches[1]);
      pinchScaleRef.current = imageScale;
      setIsPanning(false);
      return;
    }
    if (!e.touches[0]) return;
    setIsPanning(true);
    setPanStart({ startX: e.touches[0].clientX, startY: e.touches[0].clientY, startPos: { ...imagePosition } });
  };

  const handleCropMouseMove = (e) => {
    if (!isPanning || !croppingImage) return;
    const container = cropContainerRef.current;
    if (!container) return;
    const { w: nw, h: nh } = imgNaturalSizeRef.current;
    const frame = computeCropFrame(container.clientWidth, container.clientHeight, cropAspect);
    setImagePosition(clampImagePos(
      { x: panStart.startPos.x + (e.clientX - panStart.startX), y: panStart.startPos.y + (e.clientY - panStart.startY) },
      imageScale, frame, nw, nh
    ));
  };

  const handleCropTouchMove = (e) => {
    if (!croppingImage) return;
    // Pinch-to-zoom
    if (e.touches.length === 2 && pinchDistRef.current !== null && pinchScaleRef.current !== null) {
      e.preventDefault();
      const d = getTouchDist(e.touches[0], e.touches[1]);
      const container = cropContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pivotX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
      const pivotY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
      doZoom(pinchScaleRef.current * (d / pinchDistRef.current), pivotX, pivotY, pinchScaleRef.current, imagePosition, cropAspect);
      return;
    }
    // Single-finger pan
    if (!isPanning || !e.touches[0]) return;
    const container = cropContainerRef.current;
    if (!container) return;
    const { w: nw, h: nh } = imgNaturalSizeRef.current;
    const frame = computeCropFrame(container.clientWidth, container.clientHeight, cropAspect);
    setImagePosition(clampImagePos(
      { x: panStart.startPos.x + (e.touches[0].clientX - panStart.startX), y: panStart.startPos.y + (e.touches[0].clientY - panStart.startY) },
      imageScale, frame, nw, nh
    ));
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
    setIsResizingCrop(null);
    pinchDistRef.current = null;
    pinchScaleRef.current = null;
  };

  const handleCropTouchEnd = () => {
    setIsDragging(false);
    setIsPanning(false);
    setIsResizingCrop(null);
    pinchDistRef.current = null;
    pinchScaleRef.current = null;
  };

  // Mouse-wheel zoom (desktop)
  const handleCropWheel = (e) => {
    e.preventDefault();
    const container = cropContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { w: nw, h: nh } = imgNaturalSizeRef.current;
    const frame = computeCropFrame(container.clientWidth, container.clientHeight, cropAspect);
    const step = computeMinScale(frame, nw, nh) * 0.12;
    doZoom(
      imageScale + (e.deltaY < 0 ? step : -step),
      e.clientX - rect.left, e.clientY - rect.top,
      imageScale, imagePosition, cropAspect
    );
  };

  const handleZoomChange = (delta) => {
    const container = cropContainerRef.current;
    if (!container) return;
    const { w: nw, h: nh } = imgNaturalSizeRef.current;
    const frame = computeCropFrame(container.clientWidth, container.clientHeight, cropAspect);
    const fittedScale = computeMinScale(frame, nw, nh);
    doZoom(imageScale + (fittedScale * delta), container.clientWidth / 2, container.clientHeight / 2, imageScale, imagePosition, cropAspect);
  };

  const handleZoomInput = (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isNaN(v)) return;
    const container = cropContainerRef.current;
    if (!container) return;
    doZoom(v, container.clientWidth / 2, container.clientHeight / 2, imageScale, imagePosition, cropAspect);
  };

  // Reset image to cover-fit (minimum zoom, centered)
  const resetCropFit = () => {
    const container = cropContainerRef.current;
    if (!container) return;
    const { w: nw, h: nh } = imgNaturalSizeRef.current;
    const frame = computeCropFrame(container.clientWidth, container.clientHeight, cropAspect);
    const minScale = computeMinScale(frame, nw, nh);
    const sw = nw * minScale;
    const sh = nh * minScale;
    setImageScale(minScale);
    setImagePosition({ x: frame.x + (frame.w - sw) / 2, y: frame.y + (frame.h - sh) / 2 });
  };

  const applyCropAspectPreset = (preset) => {
    setCropAspect(preset);

    // The canvas dimensions change with the selected format. Measure them after
    // React has applied the new ratio, then fit the image to the actual frame.
    window.requestAnimationFrame(() => {
      const container = cropContainerRef.current;
      if (!container) return;
      const { w: nw, h: nh } = imgNaturalSizeRef.current;
      const newFrame = computeCropFrame(container.clientWidth, container.clientHeight, preset);
      const minScale = computeMinScale(newFrame, nw, nh);
      const scaledW = nw * minScale;
      const scaledH = nh * minScale;
      setImageScale(minScale);
      setImagePosition({
        x: newFrame.x + (newFrame.w - scaledW) / 2,
        y: newFrame.y + (newFrame.h - scaledH) / 2
      });
    });
  };

  // Extract the image region visible inside the crop frame
  const cropImage = useCallback(() => {
    if (!croppingImage) return null;
    const container = cropContainerRef.current;
    if (!container) return null;
    const { w: nw, h: nh } = imgNaturalSizeRef.current;
    const frame = computeCropFrame(container.clientWidth, container.clientHeight, cropAspect);

    // Export exactly what is visible, including the background revealed when
    // the user zooms below the fitted size.
    const maxOutputSide = 2400;
    const exportScale = Math.min(
      1 / imageScale,
      maxOutputSide / frame.w,
      maxOutputSide / frame.h
    );
    const outCanvas = document.createElement('canvas');
    outCanvas.width = Math.max(1, Math.round(frame.w * exportScale));
    outCanvas.height = Math.max(1, Math.round(frame.h * exportScale));
    const ctx = outCanvas.getContext('2d');

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
        // Bake the live brightness/contrast/saturation adjustments into the export.
        if (filterCss && filterCss !== 'none') ctx.filter = filterCss;
        ctx.drawImage(
          img,
          (imagePosition.x - frame.x) * exportScale,
          (imagePosition.y - frame.y) * exportScale,
          nw * imageScale * exportScale,
          nh * imageScale * exportScale
        );
        ctx.filter = 'none';
        outCanvas.toBlob((blob) => {
          resolve(new File([blob], croppingImage.file.name, { type: croppingImage.file.type, lastModified: Date.now() }));
        }, croppingImage.file.type, 0.95);
      };
      img.src = croppingImage.url;
    });
  }, [croppingImage, imagePosition, imageScale, cropAspect, filterCss]);

  const handleCropConfirm = async () => {
    const croppedFile = await cropImage();
    if (!croppedFile) return;
    
    const newPreview = {
      url: URL.createObjectURL(croppedFile),
      name: croppingImage.file.name
    };
    
    setFiles((prev) => {
      const updated = [...prev];
      updated[croppingImage.index] = { file: croppedFile, cropped: true };
      return updated;
    });
    
    setImagePreviews((prev) => {
      const updated = [...prev];
      const previousUrl = updated[croppingImage.index]?.url;
      if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl);
      updated[croppingImage.index] = newPreview;
      return updated;
    });
    
    setCroppingImage(null);
    setImageError('');
  };

  const handleCropCancel = () => {
    setCroppingImage(null);
    setCropData({ x: 0, y: 0, width: 0, height: 0 });
  };

  const applyImageTransform = useCallback(async (rotateDeg = 0, flipH = false, flipV = false) => {
    if (!croppingImage?.url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = croppingImage.url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const rad = (rotateDeg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const outW = Math.round(cos * w + sin * h);
    const outH = Math.round(sin * w + cos * h);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate(rad);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(img, 0, 0, w, h, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, croppingImage.file.type, 0.95));
    const file = new File([blob], croppingImage.file.name, { type: croppingImage.file.type, lastModified: Date.now() });
    const url = URL.createObjectURL(file);
    if (croppingImage.url && croppingImage.url.startsWith('blob:')) URL.revokeObjectURL(croppingImage.url);
    setCroppingImage((prev) => ({ ...prev, file, url }));
    // Re-init crop area after transform, preserving current aspect ratio
    setTimeout(() => initializeCropArea(url, cropAspect), 80);
  }, [croppingImage, cropAspect]);

  const handleRotateLeft = () => applyImageTransform(-90, false, false);
  const handleRotateRight = () => applyImageTransform(90, false, false);
  const handleFlipH = () => applyImageTransform(0, true, false);
  const handleFlipV = () => applyImageTransform(0, false, true);

  const editImageCrop = (index) => {
    const fileItem = files[index];
    const preview = imagePreviews[index];
    if (!fileItem || !preview?.url) return;
    const file = fileItem?.file || fileItem;
    if (!(file instanceof File)) return;
    imgNaturalSizeRef.current = { w: 0, h: 0 };
    pinchDistRef.current = null;
    pinchScaleRef.current = null;
    // Default the frame to the product-card display ratio (square) so the crop
    // matches how the image will be shown on the cards.
    setCropAspect(CARD_DISPLAY_ASPECT);
    setCropTab('crop');
    setImageFilters(DEFAULT_IMAGE_FILTERS);
    setCroppingImage({ file, url: preview.url, index });
    // initializeCropArea fires via the img onLoad in the modal
  };

  const handleLeaveAsIs = (index) => {
    setFiles((prev) => {
      const updated = [...prev];
      if (updated[index]) updated[index] = { ...updated[index], leftAsIs: true };
      return updated;
    });
  };

  const removeImage = (index) => {
    const removedPreview = imagePreviews[index];
    if (removedPreview?.url?.startsWith('blob:')) URL.revokeObjectURL(removedPreview.url);
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setFiles(newFiles);
    setImagePreviews(newPreviews);
    // Option→image links use the combined [existing…, new…] index space.
    shiftAttributeOptionImages(existingImages.length + index);
    if (newFiles.length < maxImagesLimit) setImageError('');
  };

  const removeExistingImage = (index) => {
    const target = existingImages[index];
    if (!target) return;
    setExistingImages(existingImages.filter((_, i) => i !== index));
    setRemovedImages((prev) => [...prev, target]);
    shiftAttributeOptionImages(index);
    if (existingImages.length - 1 + files.length < maxImagesLimit) setImageError('');
  };

  useEffect(() => {
    imagePreviewsRef.current = imagePreviews;
  }, [imagePreviews]);

  useEffect(
    () => () => {
      imagePreviewsRef.current.forEach((preview) => {
        if (preview?.url?.startsWith('blob:')) URL.revokeObjectURL(preview.url);
      });
    },
    []
  );

  const compressVideoFile = useCallback((file) => new Promise((resolve, reject) => {
    const mimeType = pickVideoRecorderMimeType();
    if (!mimeType || typeof MediaRecorder === 'undefined') {
      reject(new Error('Compression vidéo non supportée par ce navigateur.'));
      return;
    }

    let objectUrl = '';
    let progressInterval = null;
    let drawFrameId = 0;
    let stopped = false;
    let stream = null;
    let sourceStream = null;
    let recorder = null;
    const chunks = [];

    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

    const cleanup = () => {
      stopped = true;
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (drawFrameId) {
        cancelAnimationFrame(drawFrameId);
        drawFrameId = 0;
      }
      try {
        recorder?.state === 'recording' && recorder.stop();
      } catch {
        // no-op
      }
      try {
        video.pause();
      } catch {
        // no-op
      }
      stream?.getTracks?.().forEach((track) => track.stop());
      sourceStream?.getTracks?.().forEach((track) => track.stop());
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (video.parentNode) video.parentNode.removeChild(video);
    };

    const fail = (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error('Compression vidéo impossible.'));
    };

    if (!ctx || typeof canvas.captureStream !== 'function') {
      fail(new Error('Compression vidéo non supportée par ce navigateur.'));
      return;
    }

    objectUrl = URL.createObjectURL(file);
    video.preload = 'auto';
    video.muted = false;
    video.volume = 0;
    video.playsInline = true;
    video.src = objectUrl;
    video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(video);

    video.onloadedmetadata = async () => {
      try {
        const duration = Number(video.duration || 0);
        if (!Number.isFinite(duration) || duration <= 0) {
          throw new Error('Durée vidéo illisible.');
        }
        if (!video.videoWidth || !video.videoHeight) {
          throw new Error('Dimensions vidéo illisibles.');
        }

        const output = calculateVideoOutputSize(video.videoWidth, video.videoHeight);
        canvas.width = output.width;
        canvas.height = output.height;

        const totalBitsPerSecond = Math.max(
          VIDEO_MIN_BITRATE,
          Math.min(VIDEO_MAX_BITRATE + VIDEO_AUDIO_BITRATE, Math.floor((VIDEO_COMPRESS_TARGET_BYTES * 8) / duration))
        );
        const hasSourceAudio = typeof video.captureStream === 'function';
        const videoBitsPerSecond = Math.max(
          VIDEO_MIN_BITRATE,
          Math.min(VIDEO_MAX_BITRATE, totalBitsPerSecond - (hasSourceAudio ? VIDEO_AUDIO_BITRATE : 0))
        );

        const canvasStream = canvas.captureStream(VIDEO_COMPRESS_FPS);
        const streamTracks = [...canvasStream.getVideoTracks()];

        if (hasSourceAudio) {
          try {
            sourceStream = video.captureStream();
            const audioTrack = sourceStream.getAudioTracks?.()[0];
            if (audioTrack) streamTracks.push(audioTrack);
          } catch {
            sourceStream = null;
          }
        }

        stream = new MediaStream(streamTracks);
        const recorderOptions = {
          mimeType,
          videoBitsPerSecond
        };
        if (stream.getAudioTracks().length) {
          recorderOptions.audioBitsPerSecond = VIDEO_AUDIO_BITRATE;
        }

        recorder = new MediaRecorder(stream, recorderOptions);
        recorder.ondataavailable = (event) => {
          if (event.data?.size) chunks.push(event.data);
        };
        recorder.onerror = (event) => {
          fail(event?.error || new Error('Erreur MediaRecorder.'));
        };
        recorder.onstop = () => {
          if (stopped && !chunks.length) return;
          const blob = new Blob(chunks, { type: mimeType });
          if (!blob.size) {
            fail(new Error('La vidéo compressée est vide.'));
            return;
          }
          const containerMimeType = String(mimeType || 'video/webm').split(';')[0] || 'video/webm';
          const compressedFile = new File(
            [blob],
            `${file.name.replace(/\.[^/.]+$/, '')}-hdmarket.webm`,
            { type: containerMimeType, lastModified: Date.now() }
          );
          const result = {
            file: compressedFile,
            outputWidth: output.width,
            outputHeight: output.height,
            originalWidth: video.videoWidth,
            originalHeight: video.videoHeight
          };
          cleanup();
          resolve(result);
        };

        const drawFrame = () => {
          if (stopped || video.ended || video.paused) return;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          drawFrameId = requestAnimationFrame(drawFrame);
        };

        progressInterval = setInterval(() => {
          const progress = duration > 0 ? Math.min(97, (video.currentTime / duration) * 100) : 0;
          setCompressionProgress(progress);
        }, 250);

        video.onended = () => {
          setCompressionProgress(99);
          if (drawFrameId) {
            cancelAnimationFrame(drawFrameId);
            drawFrameId = 0;
          }
          setTimeout(() => {
            if (recorder?.state === 'recording') recorder.stop();
          }, 150);
        };

        recorder.start(1000);
        video.currentTime = 0;
        await video.play();
        drawFrame();
      } catch (error) {
        fail(error);
      }
    };

    video.onerror = () => fail(new Error('Erreur lors du chargement de la vidéo.'));
  }), []);

  const handleVideoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      setVideoError('Le fichier doit être une vidéo (MP4, MOV, ...).');
      e.target.value = '';
      return;
    }
    
    setOriginalVideoSize(file.size);
    setVideoError('');
    
    // If file is larger than the accepted limit, compress it before upload.
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setIsCompressingVideo(true);
      setCompressionProgress(0);
      
      try {
        const result = await compressVideoFile(file);
        const compressedFile = result.file;
        setCompressionProgress(100);

        if (compressedFile.size >= file.size) {
          throw new Error('La compression ne réduit pas cette vidéo.');
        }
        if (compressedFile.size > MAX_VIDEO_SIZE_BYTES) {
          throw new Error('La vidéo reste trop lourde après compression.');
        }

        setVideoFile(compressedFile);
        setVideoError('');
      } catch (error) {
        console.error('Video compression error:', error);
        setVideoFile(null);
        setVideoError(
          error?.message === 'Compression vidéo non supportée par ce navigateur.'
            ? 'Votre navigateur ne permet pas de compresser cette vidéo. Essayez avec une vidéo déjà sous 20 Mo.'
            : 'La vidéo reste trop volumineuse. Essayez une vidéo plus courte ou exportée en 720p.'
        );
      } finally {
        setIsCompressingVideo(false);
        setTimeout(() => setCompressionProgress(0), 300);
        e.target.value = '';
      }
    } else {
      // File is already under 20MB, use as is
      setVideoFile(file);
      e.target.value = '';
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoError('');
    setIsCompressingVideo(false);
    setCompressionProgress(0);
    setOriginalVideoSize(0);
  };

  const handleReplaceVideo = () => {
    setRemoveExistingVideo(false);
    document.getElementById('product-form-video-input')?.click();
  };

  const handleRemoveExistingVideo = () => {
    setRemoveExistingVideo(true);
  };

  const handleKeepExistingVideo = () => {
    // No action needed - just keep the existing video as is
    // This button confirms the user wants to keep the current video
  };

  const handlePdfChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setPdfError('Le fichier doit être un PDF.');
      return;
    }
    if (file.size > MAX_PDF_SIZE_MB * 1024 * 1024) {
      setPdfError(`Le PDF doit faire moins de ${MAX_PDF_SIZE_MB} Mo.`);
      return;
    }
    setPdfError('');
    setPdfFile(file);
    setRemovePdf(false);
    e.target.value = '';
  };

  const removePdfFile = () => {
    setPdfFile(null);
    setPdfError('');
  };

  const addWholesaleTier = () => {
    setForm((prev) => ({
      ...prev,
      wholesaleTiers: [...(Array.isArray(prev.wholesaleTiers) ? prev.wholesaleTiers : []), { minQty: '', unitPrice: '', label: '' }]
    }));
  };

  const updateWholesaleTier = (index, field, value) => {
    setForm((prev) => {
      const tiers = Array.isArray(prev.wholesaleTiers) ? [...prev.wholesaleTiers] : [];
      const current = tiers[index] || { minQty: '', unitPrice: '', label: '' };
      tiers[index] = { ...current, [field]: value };
      return { ...prev, wholesaleTiers: tiers };
    });
  };

  const removeWholesaleTier = (index) => {
    setForm((prev) => {
      const tiers = Array.isArray(prev.wholesaleTiers) ? [...prev.wholesaleTiers] : [];
      tiers.splice(index, 1);
      return { ...prev, wholesaleTiers: tiers };
    });
  };

  const addProductAttribute = () => {
    setForm((prev) => ({
      ...prev,
      attributes: [...(Array.isArray(prev.attributes) ? prev.attributes : []), { ...ATTRIBUTE_TEMPLATE }]
    }));
  };

  const updateProductAttribute = (index, field, value) => {
    setForm((prev) => {
      const attributes = Array.isArray(prev.attributes) ? [...prev.attributes] : [];
      const current = attributes[index] || { ...ATTRIBUTE_TEMPLATE };
      const next = { ...current, [field]: value };
      if (field === 'type' && value !== 'select') {
        next.options = [];
      }
      if (field === 'type' && value === 'select' && !Array.isArray(current.options)) {
        next.options = [''];
      }
      attributes[index] = next;
      return { ...prev, attributes };
    });
  };

  const removeProductAttribute = (index) => {
    setForm((prev) => {
      const attributes = Array.isArray(prev.attributes) ? [...prev.attributes] : [];
      attributes.splice(index, 1);
      return { ...prev, attributes };
    });
  };

  const addProductAttributeOption = (attributeIndex) => {
    setForm((prev) => {
      const attributes = Array.isArray(prev.attributes) ? [...prev.attributes] : [];
      const current = attributes[attributeIndex];
      if (!current) return prev;
      attributes[attributeIndex] = {
        ...current,
        options: [...(Array.isArray(current.options) ? current.options : []), '']
      };
      return { ...prev, attributes };
    });
  };

  const updateProductAttributeOption = (attributeIndex, optionIndex, value) => {
    setForm((prev) => {
      const attributes = Array.isArray(prev.attributes) ? [...prev.attributes] : [];
      const current = attributes[attributeIndex];
      if (!current) return prev;
      const options = Array.isArray(current.options) ? [...current.options] : [];
      const previousKey = String(options[optionIndex] || '').trim().toLowerCase();
      options[optionIndex] = value;
      // Keep any per-option price/image attached to the renamed option.
      const nextKey = String(value || '').trim().toLowerCase();
      const migrateKey = (map) => {
        if (!map || !previousKey || previousKey === nextKey || map[previousKey] == null) return map;
        const next = { ...map, [nextKey]: map[previousKey] };
        delete next[previousKey];
        return next;
      };
      attributes[attributeIndex] = {
        ...current,
        options,
        optionPrices: migrateKey(current.optionPrices),
        optionImages: migrateKey(current.optionImages)
      };
      return { ...prev, attributes };
    });
  };

  const updateImageVariant = (combinedIndex, field, value) => {
    setImageVariants((prev) => {
      const current = prev[combinedIndex] || { label: '', price: '' };
      const entry = { ...current, [field]: value };
      const next = { ...prev, [combinedIndex]: entry };
      if (!String(entry.label || '').trim() && String(entry.price ?? '') === '') {
        delete next[combinedIndex];
      }
      return next;
    });
  };

  // Keep option→image links valid when an image is removed: drop links to the
  // removed slot and shift the ones after it.
  const shiftAttributeOptionImages = (removedIndex) => {
    setImageVariants((prev) => {
      const next = {};
      Object.entries(prev).forEach(([key, entry]) => {
        const index = Number(key);
        if (!Number.isInteger(index) || index === removedIndex) return;
        next[index > removedIndex ? index - 1 : index] = entry;
      });
      return next;
    });
    setForm((prev) => {
      const attributes = (Array.isArray(prev.attributes) ? prev.attributes : []).map((attribute) => {
        if (!attribute?.optionImages) return attribute;
        const optionImages = {};
        Object.entries(attribute.optionImages).forEach(([key, value]) => {
          const index = Number(value);
          if (!Number.isInteger(index) || index === removedIndex) return;
          optionImages[key] = index > removedIndex ? index - 1 : index;
        });
        return {
          ...attribute,
          optionImages: Object.keys(optionImages).length ? optionImages : undefined
        };
      });
      return { ...prev, attributes };
    });
  };

  // Serialize the per-photo variants into one select attribute (options in
  // photo order; a variant price requires the buyer to choose, so the
  // attribute becomes required as soon as any price is set).
  const buildImageVariantAttribute = () => {
    const entries = Object.entries(imageVariants)
      .map(([key, entry]) => ({
        index: Number(key),
        label: String(entry?.label || '').trim(),
        price: Number(entry?.price)
      }))
      .filter((entry) => Number.isInteger(entry.index) && entry.index >= 0 && entry.label)
      .sort((a, b) => a.index - b.index);
    if (!entries.length) return null;
    const seen = new Set();
    const options = [];
    const optionPrices = {};
    const optionImages = {};
    entries.forEach((entry) => {
      const key = entry.label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push(entry.label);
      optionImages[key] = entry.index;
      if (Number.isFinite(entry.price) && entry.price > 0) optionPrices[key] = entry.price;
    });
    return {
      name: String(imageVariantName || '').trim() || 'Variante',
      type: 'select',
      options,
      required: Object.keys(optionPrices).length > 0,
      defaultValue: '',
      ...(Object.keys(optionPrices).length ? { optionPrices } : {}),
      optionImages
    };
  };

  // Option + price fields rendered below each photo (Taobao-style variants).
  const renderImageVariantFields = (combinedIndex) => {
    const entry = imageVariants[combinedIndex] || {};
    return (
      <div className="space-y-1 border-t border-gray-200 bg-white p-2">
        <input
          type="text"
          value={entry.label || ''}
          onChange={(e) => updateImageVariant(combinedIndex, 'label', e.target.value)}
          placeholder={`${String(imageVariantName || '').trim() || 'Option'} (ex: Rouge)`}
          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#FF6A00] focus:outline-none"
        />
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={entry.price ?? ''}
          onChange={(e) => updateImageVariant(combinedIndex, 'price', e.target.value)}
          placeholder="Prix (optionnel)"
          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#FF6A00] focus:outline-none"
        />
      </div>
    );
  };

  const removeProductAttributeOption = (attributeIndex, optionIndex) => {
    setForm((prev) => {
      const attributes = Array.isArray(prev.attributes) ? [...prev.attributes] : [];
      const current = attributes[attributeIndex];
      if (!current) return prev;
      const options = Array.isArray(current.options) ? [...current.options] : [];
      const removedKey = String(options[optionIndex] || '').trim().toLowerCase();
      options.splice(optionIndex, 1);
      const dropKey = (map) => {
        if (!map || !removedKey || map[removedKey] == null) return map;
        const next = { ...map };
        delete next[removedKey];
        return Object.keys(next).length ? next : undefined;
      };
      attributes[attributeIndex] = {
        ...current,
        options: options.length ? options : [''],
        optionPrices: dropKey(current.optionPrices),
        optionImages: dropKey(current.optionImages)
      };
      return { ...prev, attributes };
    });
  };

  const updatePhysicalField = (group, field, value) => {
    setForm((prev) => ({
      ...prev,
      physical: {
        ...(prev.physical || {}),
        [group]: {
          ...((prev.physical && prev.physical[group]) || {}),
          [field]: value
        }
      }
    }));
  };

  const findRecentlyCreatedProduct = async () => {
    if (productId) return null;
    const titleKey = String(form.title || '').trim().toLowerCase();
    if (!titleKey) return null;

    const basePrice = Number(form.price || 0);
    const discountValue = Number(form.discount || 0);
    const expectedPrice =
      Number.isFinite(basePrice) && Number.isFinite(discountValue) && discountValue > 0
        ? Number((basePrice * (1 - discountValue / 100)).toFixed(2))
        : basePrice;
    const recentCutoff = Date.now() - 20 * 60 * 1000;

    const { data } = await api.get('/products', {
      skipCache: true,
      headers: { 'x-skip-cache': '1' }
    });
    const list = Array.isArray(data) ? data : [];
    return (
      list.find((item) => {
        const createdAt = item?.createdAt ? new Date(item.createdAt).getTime() : 0;
        const sameTitle = String(item?.title || '').trim().toLowerCase() === titleKey;
        const samePrice = Math.abs(Number(item?.price || 0) - Number(expectedPrice || 0)) < 1;
        return createdAt >= recentCutoff && sameTitle && samePrice;
      }) || null
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setInstallmentError('');
    setWholesaleError('');
    setWarrantyError('');

    if (form.socialVideoUrl?.trim() && !isValidSocialVideoUrl(form.socialVideoUrl)) {
      await appAlert('Le lien vidéo doit être un lien Facebook ou TikTok valide.');
      return;
    }

    if (form.installmentEnabled) {
      if (!isBoutiqueOwner) {
        setInstallmentError('Seules les boutiques peuvent activer le paiement par tranche.');
        return;
      }
      const minAmount = Number(form.installmentMinAmount || 0);
      const duration = Number(form.installmentDuration || 0);
      const startDate = form.installmentStartDate ? new Date(form.installmentStartDate) : null;
      const endDate = form.installmentEndDate ? new Date(form.installmentEndDate) : null;
      const priceValue = Number(form.price || 0);
      if (!Number.isFinite(minAmount) || minAmount <= 0) {
        setInstallmentError('Le minimum du premier paiement est requis.');
        return;
      }
      if (Number.isFinite(priceValue) && priceValue > 0 && minAmount > priceValue) {
        setInstallmentError('Le minimum du premier paiement ne peut pas dépasser le prix du produit.');
        return;
      }
      if (!Number.isInteger(duration) || duration <= 0) {
        setInstallmentError('La durée du paiement par tranche doit être exprimée en jours.');
        return;
      }
      if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
        setInstallmentError('Les dates de début et de fin sont requises.');
        return;
      }
      if (endDate <= startDate) {
        setInstallmentError('La date de fin doit être après la date de début.');
        return;
      }
      const dateDuration = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      if (dateDuration !== duration) {
        setInstallmentError(`La durée doit correspondre à l'écart des dates (${dateDuration} jours).`);
        return;
      }
    }

    if (form.wholesaleEnabled) {
      if (!isBoutiqueOwner) {
        setWholesaleError('Seules les boutiques peuvent activer la vente en gros.');
        return;
      }
      const rawTiers = Array.isArray(form.wholesaleTiers) ? form.wholesaleTiers : [];
      if (!rawTiers.length) {
        setWholesaleError('Ajoutez au moins un palier de quantité.');
        return;
      }
      const normalizedTiers = rawTiers
        .map((tier) => ({
          minQty: Number(tier?.minQty),
          unitPrice: Number(tier?.unitPrice),
          label: String(tier?.label || '').trim()
        }))
        .sort((a, b) => a.minQty - b.minQty);

      const seen = new Set();
      let previousUnitPrice = null;
      for (const tier of normalizedTiers) {
        if (!Number.isInteger(tier.minQty) || tier.minQty < 2) {
          setWholesaleError('Chaque palier doit commencer à partir de 2 unités.');
          return;
        }
        if (!Number.isFinite(tier.unitPrice) || tier.unitPrice <= 0) {
          setWholesaleError('Chaque palier doit avoir un prix unitaire valide.');
          return;
        }
        if (seen.has(tier.minQty)) {
          setWholesaleError('Les quantités minimum doivent être uniques.');
          return;
        }
        seen.add(tier.minQty);
        if (previousUnitPrice !== null && tier.unitPrice > previousUnitPrice) {
          setWholesaleError(
            'Le prix unitaire ne peut pas augmenter quand la quantité minimum augmente.'
          );
          return;
        }
        previousUnitPrice = tier.unitPrice;
      }
    }

    if (form.warrantyEnabled) {
      const period = Number(form.warrantyPeriodValue || 0);
      if (!Number.isInteger(period) || period < 1 || period > 120) {
        setWarrantyError('Indiquez une période de garantie entre 1 et 120.');
        return;
      }
    }

    if (!form.deliveryAvailable && !form.pickupAvailable) {
      await appAlert('Activez au moins un mode de réception: retrait boutique ou livraison.');
      return;
    }
    if (!form.deliveryAvailable) {
      setForm((prev) => ({ ...prev, deliveryFeeEnabled: false, deliveryFee: '' }));
    }
    if (form.deliveryAvailable && form.deliveryFeeEnabled) {
      const deliveryFeeValue = Number(form.deliveryFee || 0);
      if (!Number.isFinite(deliveryFeeValue) || deliveryFeeValue < 0) {
        await appAlert('Les frais de livraison doivent être un montant positif ou nul.');
        return;
      }
    }

    setLoading(true);
    if (videoFile) {
      setIsUploadingVideo(true);
      setUploadProgress(0);
    }
    try {
      const imageVariantAttribute = buildImageVariantAttribute();
      const normalizedAttributes = normalizeProductAttributes([
        ...(imageVariantAttribute ? [imageVariantAttribute] : []),
        // Prices and image links belong to the photo variants only; the
        // generic attribute editor carries price-neutral choices.
        ...(Array.isArray(form.attributes) ? form.attributes : []).map((attribute) =>
          attribute && typeof attribute === 'object'
            ? { ...attribute, optionImages: undefined, optionPrices: undefined }
            : attribute
        )
      ]);
      const physicalPayload = {
        weight: {
          value: form.physical?.weight?.value,
          unit: form.physical?.weight?.unit || 'kg'
        },
        dimensions: {
          length: form.physical?.dimensions?.length,
          width: form.physical?.dimensions?.width,
          height: form.physical?.dimensions?.height,
          unit: form.physical?.dimensions?.unit || 'cm'
        }
      };
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (['wholesaleTiers', 'attributes', 'physical'].includes(k)) return;
        if (k === 'wholesaleEnabled' && !isBoutiqueOwner) return;
        if (
          ['discount', 'installmentMinAmount', 'installmentDuration', 'installmentLatePenaltyRate', 'deliveryFee'].includes(k) &&
          (v === '' || v === null || v === undefined)
        ) {
          return;
        }
        if (['installmentStartDate', 'installmentEndDate'].includes(k) && !v) return;
        data.append(k, v);
      });
      if (isBoutiqueOwner) {
        const normalizedWholesaleTiers = (Array.isArray(form.wholesaleTiers) ? form.wholesaleTiers : [])
          .map((tier) => ({
            minQty: Number(tier?.minQty),
            unitPrice: Number(tier?.unitPrice),
            label: String(tier?.label || '').trim()
          }))
          .filter((tier) => Number.isFinite(tier.minQty) && Number.isFinite(tier.unitPrice))
          .sort((a, b) => a.minQty - b.minQty);
        data.append('wholesaleTiers', JSON.stringify(normalizedWholesaleTiers));
      }
      data.append('attributes', JSON.stringify(normalizedAttributes));
      data.append('physical', JSON.stringify(physicalPayload));
      files.slice(0, maxImagesLimit).forEach((item) => {
        const file = item?.file || item;
        if (file instanceof File) {
          data.append('images', file);
        }
      });
      removedImages.forEach((image) => data.append('removeImages', image));
      if (videoFile) {
        data.append('video', videoFile);
      }
      if (pdfFile) {
        data.append('pdf', pdfFile);
      }
      if (removePdf) {
        data.append('removePdf', 'true');
      }
      if (removeExistingVideo) {
        data.append('removeVideo', 'true');
      }
      // Wallet auto-validation flag
      if (!productId && payWithWallet) {
        data.append('payWithWallet', 'true');
        if (promoCode.trim()) {
          data.append('promoCode', promoCode.trim());
        }
      }
      const url = `/products${productId ? `/${productId}` : ''}`;
      const method = productId ? 'put' : 'post';
      const idempotencyKey = productId
        ? createIdempotencyKey('product-update')
        : submitIdempotencyKeyRef.current || createIdempotencyKey('product-create');
      if (!productId) {
        submitIdempotencyKeyRef.current = idempotencyKey;
      }
      const res = await api[method](url, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Idempotency-Key': idempotencyKey
        },
        onUploadProgress: (event) => {
          if (event.total) {
            const percentCompleted = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      if (productId) {
        onUpdated?.(res.data);
      } else {
        onCreated?.(res.data);
        submitIdempotencyKeyRef.current = '';
      }
      
      // Réinitialiser le formulaire
      imagePreviewsRef.current.forEach((preview) => {
        if (preview?.url?.startsWith('blob:')) URL.revokeObjectURL(preview.url);
      });
      setForm({
        title: '',
        description: '',
        price: '',
        category: '',
        condition: 'used',
        operator: 'MTN',
        discount: '',
        installmentEnabled: false,
        installmentMinAmount: '',
        installmentDuration: '',
        installmentStartDate: '',
        installmentEndDate: '',
        installmentLatePenaltyRate: '',
        installmentMaxMissedPayments: 3,
        installmentRequireGuarantor: false,
        wholesaleEnabled: false,
        wholesaleTiers: [],
        warrantyEnabled: false,
        warrantyPeriodValue: '',
        warrantyPeriodUnit: 'months',
        attributes: [],
        physical: {
          weight: { value: '', unit: 'kg' },
          dimensions: { length: '', width: '', height: '', unit: 'cm' }
        },
        deliveryAvailable: true,
        pickupAvailable: true,
        deliveryFeeEnabled: true,
        deliveryFee: ''
      });
      setFiles([]);
      setImagePreviews([]);
      setExistingImages([]);
      setRemovedImages([]);
      setImageError('');
      setVideoFile(null);
      setExistingVideoUrl(null);
      setRemoveExistingVideo(false);
      setVideoError('');
      setPdfFile(null);
      setPdfError('');
      setExistingPdf(null);
      setRemovePdf(false);
      setWholesaleError('');
      setWarrantyError('');
      
    } catch (e) {
      if (!productId && isApiPossiblyCommittedError(e)) {
        try {
          const recoveredProduct = await findRecentlyCreatedProduct();
          if (recoveredProduct?._id) {
            submitIdempotencyKeyRef.current = '';
            onCreated?.(recoveredProduct);
            await appAlert(
              'Annonce enregistrée. Le réseau a mis du temps à répondre, mais le produit est déjà dans vos annonces.'
            );
            return;
          }
        } catch {
          // Keep the original upload error below.
        }
      } else {
        submitIdempotencyKeyRef.current = '';
      }
      await appAlert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
      setIsUploadingVideo(false);
      setUploadProgress(0);
    }
  };

  const getHighestListingPrice = () => {
    const imagePrices = Object.values(imageVariants)
      .map((entry) => Number(entry?.price))
      .filter((price) => Number.isFinite(price) && price > 0);
    return Math.max(Number(form.price) || 0, ...imagePrices);
  };

  const calculateCommission = () => {
    const price = getHighestListingPrice();
    return Math.round((price * commissionRatePercent) / 100);
  };

  cropMoveRef.current = handleCropMouseMove;
  cropUpRef.current = handleCropMouseUp;

  useEffect(() => {
    if (!croppingImage) return;
    const onMove = (e) => {
      if (e.touches) return;
      cropMoveRef.current(e);
    };
    const onUp = () => cropUpRef.current();
    if (isDragging || isPanning || isResizingCrop) {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [croppingImage, isDragging, isPanning, isResizingCrop]);

  useEffect(() => {
    if (!initialValues) {
      setExistingImages([]);
      setExistingPdf(null);
      setRemovePdf(false);
      setRemovedImages([]);
      setImageVariants({});
      setImageVariantName('Couleur');
      return;
    }
    // The photo-linked attribute is edited under the image cards; explode it
    // back into per-image entries and keep the rest in the generic editor.
    const hydratedAttributes = normalizeProductAttributes(initialValues.attributes);
    const imageLinkedAttribute = hydratedAttributes.find(
      (attribute) => attribute.optionImages && Object.keys(attribute.optionImages).length
    );
    if (imageLinkedAttribute) {
      const hydratedVariants = {};
      imageLinkedAttribute.options.forEach((option) => {
        const key = option.toLowerCase();
        const index = imageLinkedAttribute.optionImages[key];
        if (!Number.isInteger(index)) return;
        hydratedVariants[index] = {
          label: option,
          price: imageLinkedAttribute.optionPrices?.[key] ?? ''
        };
      });
      setImageVariants(hydratedVariants);
      setImageVariantName(imageLinkedAttribute.name || 'Couleur');
    } else {
      setImageVariants({});
      setImageVariantName('Couleur');
    }
    setForm({
      title: initialValues.title || '',
      description: initialValues.description || '',
      price:
        initialValues.priceBeforeDiscount !== undefined && initialValues.priceBeforeDiscount !== null
          ? initialValues.priceBeforeDiscount
          : initialValues.price || '',
      category: initialValues.category || '',
      condition: initialValues.condition || 'new',
      operator: initialValues.operator || 'MTN',
      discount:
        typeof initialValues.discount === 'number' || typeof initialValues.discount === 'string'
          ? initialValues.discount
          : '',
      installmentEnabled: Boolean(initialValues.installmentEnabled),
      installmentMinAmount:
        initialValues.installmentMinAmount !== undefined && initialValues.installmentMinAmount !== null
          ? initialValues.installmentMinAmount
          : '',
      installmentDuration:
        initialValues.installmentDuration !== undefined && initialValues.installmentDuration !== null
          ? initialValues.installmentDuration
          : '',
      installmentStartDate: initialValues.installmentStartDate
        ? new Date(initialValues.installmentStartDate).toISOString().slice(0, 10)
        : '',
      installmentEndDate: initialValues.installmentEndDate
        ? new Date(initialValues.installmentEndDate).toISOString().slice(0, 10)
        : '',
      installmentLatePenaltyRate:
        initialValues.installmentLatePenaltyRate !== undefined &&
        initialValues.installmentLatePenaltyRate !== null
          ? initialValues.installmentLatePenaltyRate
          : '',
      installmentMaxMissedPayments:
        initialValues.installmentMaxMissedPayments !== undefined &&
        initialValues.installmentMaxMissedPayments !== null
          ? initialValues.installmentMaxMissedPayments
          : 3,
      installmentRequireGuarantor: Boolean(initialValues.installmentRequireGuarantor),
      wholesaleEnabled: Boolean(initialValues.wholesaleEnabled),
      wholesaleTiers: Array.isArray(initialValues.wholesaleTiers)
        ? initialValues.wholesaleTiers.map((tier) => ({
            minQty: tier?.minQty ?? '',
            unitPrice: tier?.unitPrice ?? '',
            label: tier?.label || ''
          }))
        : [],
      warrantyEnabled: Boolean(initialValues.warrantyEnabled),
      warrantyPeriodValue:
        initialValues.warrantyPeriodValue !== undefined && initialValues.warrantyPeriodValue !== null
          ? initialValues.warrantyPeriodValue
          : '',
      warrantyPeriodUnit: initialValues.warrantyPeriodUnit || 'months',
      attributes: hydratedAttributes
        .filter((attribute) => attribute !== imageLinkedAttribute)
        .map((attribute) => ({
          ...attribute,
          options:
            attribute.type === 'select'
              ? Array.isArray(attribute.options) && attribute.options.length
                ? attribute.options
                : ['']
              : []
        })),
      physical: {
        weight: {
          value: initialValues.physical?.weight?.value ?? '',
          unit: initialValues.physical?.weight?.unit || 'kg'
        },
        dimensions: {
          length: initialValues.physical?.dimensions?.length ?? '',
          width: initialValues.physical?.dimensions?.width ?? '',
          height: initialValues.physical?.dimensions?.height ?? '',
          unit: initialValues.physical?.dimensions?.unit || 'cm'
        }
      },
      deliveryAvailable: initialValues.deliveryAvailable !== false,
      pickupAvailable: initialValues.pickupAvailable !== false,
      deliveryFeeEnabled: initialValues.deliveryFeeEnabled !== false,
      deliveryFee:
        initialValues.deliveryFee !== undefined && initialValues.deliveryFee !== null
          ? initialValues.deliveryFee
          : '',
      socialVideoUrl: initialValues.socialVideoUrl || ''
    });
    setExistingImages(Array.isArray(initialValues.images) ? initialValues.images : []);
    setExistingPdf(initialValues.pdf || null);
    setRemovePdf(false);
    setRemovedImages([]);
  }, [initialValues]);

  const isEditing = Boolean(productId);

  // Preview promo code when wallet payment is selected
  useEffect(() => {
    if (!payWithWallet || !promoCode.trim() || isEditing) {
      setPromoPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setPromoLoading(true);
      try {
        const { data } = await api.post('/products/promo-preview', {
          code: promoCode.trim(),
          price: getHighestListingPrice()
        });
        if (!cancelled) {
          setPromoPreview(data);
        }
      } catch (err) {
        if (!cancelled) {
          setPromoPreview({
            valid: false,
            message: err.response?.data?.message || 'Code promo invalide.'
          });
        }
      } finally {
        if (!cancelled) setPromoLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [payWithWallet, promoCode, form.price, imageVariants, isEditing]);

  // Live preview of the installment plan shown inside the "vente en tranche" card.
  const installmentPlanPreview = useMemo(() => {
    if (!form.installmentEnabled) return null;
    const price = getHighestListingPrice();
    const firstPayment = Number(form.installmentMinAmount) || 0;
    const remaining = Math.max(0, price - firstPayment);
    let days = Number(form.installmentDuration) || 0;
    if (!days && form.installmentStartDate && form.installmentEndDate) {
      const start = new Date(form.installmentStartDate);
      const end = new Date(form.installmentEndDate);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
        days = Math.round((end - start) / (1000 * 60 * 60 * 24));
      }
    }
    if (!price && !firstPayment && !days) return null;
    return { price, firstPayment, remaining, days };
  }, [
    form.installmentEnabled,
    form.price,
    form.installmentMinAmount,
    form.installmentDuration,
    form.installmentStartDate,
    form.installmentEndDate
  ]);

  const headerTitle = isEditing ? 'Modifier une annonce' : 'Publier une annonce';
  const headerSubtitle = isEditing
    ? 'Mettez à jour les informations de votre produit'
    : 'Remplissez les détails de votre produit pour commencer à vendre';
  const buttonLabel =
    submitLabel || (isEditing ? "Mettre à jour l'annonce" : "Publier l'annonce");
  const requiredFields = useMemo(
    () => ({
      title: Boolean(String(form.title || '').trim()),
      description: Boolean(String(form.description || '').trim()),
      category: Boolean(String(form.category || '').trim()),
      price: Number(form.price || 0) > 0
    }),
    [form.category, form.description, form.price, form.title]
  );
  const requiredCompletedCount = useMemo(
    () => Object.values(requiredFields).filter(Boolean).length,
    [requiredFields]
  );
  const requiredTotalCount = 4;
  const completionPercent = Math.round((requiredCompletedCount / requiredTotalCount) * 100);
  const submitDisabled =
    loading || !requiredFields.title || !requiredFields.description || !requiredFields.category || !requiredFields.price;
  const priceGridClass = isEditing ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2';
  const normalizedWholesalePreviewTiers = (Array.isArray(form.wholesaleTiers) ? form.wholesaleTiers : [])
    .map((tier) => ({
      minQty: Number(tier?.minQty),
      unitPrice: Number(tier?.unitPrice),
      label: String(tier?.label || '').trim()
    }))
    .filter((tier) => Number.isInteger(tier.minQty) && tier.minQty >= 2 && Number.isFinite(tier.unitPrice) && tier.unitPrice > 0)
    .sort((a, b) => a.minQty - b.minQty);
  const wholesalePreviewBasePrice = Number(form.price || 0);
  const setInstallmentEnabled = (enabled) => {
    setForm((prev) => ({
      ...prev,
      installmentEnabled: enabled,
      installmentMinAmount: enabled ? prev.installmentMinAmount : '',
      installmentDuration: enabled ? prev.installmentDuration : '',
      installmentStartDate: enabled ? prev.installmentStartDate : '',
      installmentEndDate: enabled ? prev.installmentEndDate : '',
      installmentLatePenaltyRate: enabled ? prev.installmentLatePenaltyRate : '',
      installmentMaxMissedPayments: enabled ? prev.installmentMaxMissedPayments || 3 : 3,
      installmentRequireGuarantor: enabled ? prev.installmentRequireGuarantor : false
    }));
  };
  const setWholesaleEnabled = (enabled) => {
    setForm((prev) => ({
      ...prev,
      wholesaleEnabled: enabled,
      wholesaleTiers: enabled
        ? Array.isArray(prev.wholesaleTiers) && prev.wholesaleTiers.length
          ? prev.wholesaleTiers
          : [{ minQty: '', unitPrice: '', label: '' }]
        : []
    }));
  };
  const renderSwitchButton = ({ checked, disabled = false, onChange, label }) => (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange?.(!checked);
      }}
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:ring-offset-2 ${
        checked ? 'border-[#ff6a00] bg-[#ff6a00]' : 'border-gray-200 bg-gray-100'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-95'}`}
    >
      <span
        className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
  // Unified, branded header used by every section of the form. Collapsible
  // sections fold on mobile (chevron); static sections always render expanded.
  const renderSectionHeader = ({ id, icon: Icon, title, subtitle, collapsible = true, accent = 'orange' }) => {
    const badgeClass = accent === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-[#FFF1E6] text-[#FF6A00]';
    const badge = (
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badgeClass}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
    );

    if (collapsible && isMobile) {
      const expanded = expandedSections[id];
      return (
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl bg-gray-50 px-3 py-3 text-left transition active:bg-gray-100"
          aria-expanded={expanded}
        >
          <span className="flex min-w-0 items-center gap-3">
            {badge}
            <span className="min-w-0">
              <span className="block text-[15px] font-black text-gray-900">{title}</span>
              {subtitle && <span className="mt-0.5 block truncate text-xs text-gray-500">{subtitle}</span>}
            </span>
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>
      );
    }

    return (
      <div className="mb-4 flex items-center gap-3">
        {badge}
        <div className="min-w-0">
          <h2 className="text-base font-black text-gray-900 sm:text-lg">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 sm:text-sm">{subtitle}</p>}
        </div>
      </div>
    );
  };
  const sectionShellClass =
    'hd-form-card rounded-2xl p-4 sm:p-5';
  const innerPanelClass = 'rounded-2xl border border-gray-200 bg-gray-100/45 p-4';
  const inputClass =
    'ui-input w-full min-w-0 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400';
  const sectionProgressItems = [
    { key: 'info', label: 'Infos', done: requiredFields.title && requiredFields.description },
    { key: 'price', label: 'Prix', done: requiredFields.category && requiredFields.price },
    { key: 'commercial', label: 'Commercial', done: Boolean(form.installmentEnabled || form.wholesaleEnabled) },
    { key: 'media', label: 'Photos', done: imagePreviews.length > 0 || existingImages.length > 0 },
    { key: 'validation', label: 'Validation', done: !submitDisabled }
  ];

  // Taobao-style shared input class
  const tbInput = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#FF6A00] focus:ring-2 focus:ring-[#FF6A00]/15 transition-colors';
  // Section title with orange left accent
  const SectionTitle = ({ children }) => (
    <h3 className="flex items-center gap-2">
      <span className="w-[3px] h-[18px] rounded-full bg-[#FF6A00] flex-shrink-0" />
      <span className="text-sm font-black text-gray-900">{children}</span>
    </h3>
  );

  return (
    <div
      ref={formShellRef}
      className={`mx-auto max-w-3xl ${
        isMobile
          ? isEmbeddedMobile
            ? 'px-0 pb-24 scroll-pb-40'
            : 'px-0 pb-28 bg-[#f5f5f5] min-h-screen'
          : 'bg-[#f5f5f5]'
      }`}
    >
      {/* ── TAOBAO HEADER ── */}
      {!hideHeader && (
        <div className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#fff0e4] flex items-center justify-center flex-shrink-0">
            {isEditing ? <Edit className="w-4 h-4 text-[#FF6A00]" /> : <Plus className="w-4 h-4 text-[#FF6A00]" />}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-black text-gray-900 leading-tight">{headerTitle}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{headerSubtitle}</p>
          </div>
        </div>
      )}

      {/* ── PROGRESS ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-50">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-gray-500">Progression</p>
          <span className="text-xs font-black text-[#FF6A00]">{requiredCompletedCount}/{requiredTotalCount}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-[#FF6A00] transition-all duration-300" style={{ width: `${completionPercent}%` }} />
        </div>
        <div className="mt-2 flex gap-1.5">
          {sectionProgressItems.map((item) => (
            <span key={item.key}
              className={`flex-1 py-1 text-center text-[10px] font-bold rounded transition-colors ${item.done ? 'bg-[#FF6A00] text-white' : 'bg-gray-100 text-gray-400'}`}>
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <form
        onSubmit={submit}
        className={`space-y-4 ${
          isMobile
            ? isEmbeddedMobile
              ? 'pb-6'
              : 'mx-4 pb-6'
            : 'pb-6'
        }`}
      >
        {/* Section Informations de base */}
        <div className={sectionShellClass}>
          {renderSectionHeader({
            id: 'info',
            icon: FileText,
            title: 'Informations du produit',
            subtitle: "Les détails qui aident l'acheteur à décider vite."
          })}
          {(!isMobile || expandedSections.info) && (
                <div className="space-y-4 pt-1">
          {/* Titre */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4 text-neutral-500" />
              <span>Titre de l'annonce *</span>
            </label>
            <input
              className={`${inputClass} min-h-[50px] text-base`}
              placeholder="Ex: iPhone 13 Pro Max 256GB - État neuf"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4 text-neutral-500" />
              <span>Description détaillée *</span>
            </label>
            <textarea
              rows={4}
              className={`${inputClass} resize-none`}
              placeholder="Décrivez votre produit en détail : caractéristiques, état, accessoires inclus..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>

          {/* Catégorie et Prix en ligne */}
          <div className={`grid ${priceGridClass} gap-4`}>
            {/* Catégorie */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <Tag className="w-4 h-4 text-neutral-500" />
                <span>Catégorie *</span>
              </label>
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                required
              >
                <option value="">Sélectionnez une catégorie</option>
                {categoryGroups.map((group, index) => (
                  <optgroup key={index} label={group.label}>
                    {group.options.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Prix */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                <DollarSign className="w-4 h-4 text-neutral-500" />
                <span>Prix *</span>
              </label>
              <input
                type="number"
                className={inputClass}
                placeholder="Ex: 250000"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                min="0"
              />
            </div>

            {isEditing && (
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Tag className="w-4 h-4 text-amber-500" />
                  <span>Remise (%)</span>
                </label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="Ex: 5"
                  value={form.discount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setForm((prev) => ({ ...prev, discount: '' }));
                      return;
                    }
                    const numeric = Math.max(0, Math.min(99, Number(value)));
                    setForm((prev) => ({ ...prev, discount: numeric }));
                  }}
                  min="0"
                  max="99"
                />
                <p className="text-[11px] text-gray-500">
                  Laissez vide pour aucune remise. Le pourcentage maximum est de 99%.
                </p>
              </div>
            )}
          </div>

          {/* Condition et Opérateur */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Condition */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">État du produit</label>
              <div className={`flex gap-4 ${isMobile ? 'gap-6' : 'space-x-4'}`}>
                <label className={`flex items-center gap-2 cursor-pointer touch-manipulation ${isMobile ? 'min-h-[44px] py-2 -my-1' : ''}`}>
                  <div className="relative flex-shrink-0">
                    <input
                      type="radio"
                      name="condition"
                      value="new"
                      checked={form.condition === 'new'}
                      onChange={(e) => setForm({ ...form, condition: e.target.value })}
                      className="sr-only"
                    />
                    <div className={`border-2 rounded-full flex items-center justify-center transition-all ${isMobile ? 'w-6 h-6' : 'w-5 h-5'} ${
                      form.condition === 'new' 
                        ? 'border-neutral-500 bg-neutral-500' 
                        : 'border-gray-300'
                    }`}>
                      {form.condition === 'new' && (
                        <div className={`bg-white rounded-full ${isMobile ? 'w-2.5 h-2.5' : 'w-2 h-2'}`}></div>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-700">Neuf</span>
                </label>
                <label className={`flex items-center gap-2 cursor-pointer touch-manipulation ${isMobile ? 'min-h-[44px] py-2 -my-1' : ''}`}>
                  <div className="relative flex-shrink-0">
                    <input
                      type="radio"
                      name="condition"
                      value="used"
                      checked={form.condition === 'used'}
                      onChange={(e) => setForm({ ...form, condition: e.target.value })}
                      className="sr-only"
                    />
                    <div className={`border-2 rounded-full flex items-center justify-center transition-all ${isMobile ? 'w-6 h-6' : 'w-5 h-5'} ${
                      form.condition === 'used' 
                        ? 'border-neutral-500 bg-neutral-500' 
                        : 'border-gray-300'
                    }`}>
                      {form.condition === 'used' && (
                        <div className={`bg-white rounded-full ${isMobile ? 'w-2.5 h-2.5' : 'w-2 h-2'}`}></div>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-700">Occasion</span>
                </label>
              </div>
            </div>

          </div>

          <div className={`${innerPanelClass} space-y-4`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-neutral-700 shadow-sm ring-1 ring-gray-200">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Garantie</p>
                  <p className="text-xs text-gray-500">
                    Confirmez si le produit est couvert après l'achat et indiquez la durée.
                  </p>
                </div>
              </div>
              {renderSwitchButton({
                checked: Boolean(form.warrantyEnabled),
                label: 'Activer la garantie',
                onChange: (enabled) =>
                  setForm((prev) => ({
                    ...prev,
                    warrantyEnabled: enabled,
                    warrantyPeriodValue: enabled ? prev.warrantyPeriodValue : '',
                    warrantyPeriodUnit: prev.warrantyPeriodUnit || 'months'
                  }))
              })}
            </div>

            {form.warrantyEnabled && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px]">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Période après achat</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={form.warrantyPeriodValue}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, warrantyPeriodValue: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="Ex: 12"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Unité</label>
                  <select
                    value={form.warrantyPeriodUnit}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, warrantyPeriodUnit: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="days">Jours</option>
                    <option value="months">Mois</option>
                    <option value="years">Années</option>
                  </select>
                </div>
                <p className="md:col-span-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-gray-600">
                  Cette garantie sera visible sur la fiche produit et sauvegardée dans la commande.
                </p>
              </div>
            )}

            {warrantyError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {warrantyError}
              </p>
            )}
          </div>

          <div className={`${innerPanelClass} space-y-4`}>
            <div>
              <p className="text-sm font-semibold text-gray-900">Modes de réception</p>
              <p className="text-xs text-gray-500">
                Définissez si ce produit peut être retiré en boutique, livré, ou les deux.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                <span>Retrait boutique</span>
                <input
                  type="checkbox"
                  checked={Boolean(form.pickupAvailable)}
                  onChange={(e) => setForm((prev) => ({ ...prev, pickupAvailable: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                <span>Livraison disponible</span>
                <input
                  type="checkbox"
                  checked={Boolean(form.deliveryAvailable)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      deliveryAvailable: e.target.checked,
                      deliveryFeeEnabled: e.target.checked ? prev.deliveryFeeEnabled : false
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500"
                />
              </label>
            </div>
            {form.deliveryAvailable && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                  <span>Frais livraison actifs</span>
                  <input
                    type="checkbox"
                    checked={Boolean(form.deliveryFeeEnabled)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        deliveryFeeEnabled: e.target.checked,
                        deliveryFee: e.target.checked ? prev.deliveryFee : ''
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500"
                  />
                </label>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Frais livraison (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.deliveryFee}
                    disabled={!form.deliveryFeeEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, deliveryFee: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
                    placeholder="Ex: 1500"
                  />
                </div>
              </div>
            )}
            {!form.deliveryAvailable && form.pickupAvailable && (
              <p className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
                Ce produit sera affiché comme <strong>Retrait boutique uniquement</strong>.
              </p>
            )}
          </div>
                </div>
          )}
        </div>

        {/* Section Commercialisation */}
        <div className={sectionShellClass}>
          {renderSectionHeader({
            id: 'commercialisation',
            icon: Megaphone,
            title: 'Commercialisation',
            subtitle: 'Outils de vente optionnels — activez seulement ce dont vous avez besoin.'
          })}

          {(!isMobile || expandedSections.commercialisation) && (
            <div className="space-y-4 pt-1">

          <div className={`min-w-0 space-y-4 overflow-hidden rounded-2xl border p-4 transition-colors ${form.installmentEnabled ? 'border-[#FF6A00]/40 bg-[#FFF7ED]' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${form.installmentEnabled ? 'bg-[#FF6A00] text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <CreditCard className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900">Paiement par tranche</p>
                  <p className="mt-0.5 text-xs leading-snug text-gray-500">
                    Proposez un échéancier de paiement sur ce produit.
                  </p>
                </div>
              </div>
              {renderSwitchButton({
                checked: Boolean(form.installmentEnabled),
                disabled: !isBoutiqueOwner,
                label: 'Activer le paiement par tranche',
                onChange: setInstallmentEnabled
              })}
            </div>

            {!isBoutiqueOwner && (
              <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Réservé aux comptes convertis en boutique.
              </p>
            )}

            {form.installmentEnabled && (
              <div className="space-y-3">
                {/* Live plan preview */}
                {installmentPlanPreview && (
                  <div className="rounded-xl border border-[#FF6A00]/30 bg-white p-3">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#FF6A00]">
                      <Wallet className="h-3.5 w-3.5" />
                      Aperçu de l'échéancier
                    </div>
                    <div className="mt-2.5 flex items-stretch gap-2">
                      <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-gray-500">Premier versement</p>
                        <p className="mt-0.5 text-sm font-black text-gray-900">
                          {installmentPlanPreview.firstPayment > 0
                            ? formatPriceWithStoredSettings(installmentPlanPreview.firstPayment)
                            : '—'}
                        </p>
                      </div>
                      <div className="flex items-center text-gray-300">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                      <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-gray-500">Solde restant</p>
                        <p className="mt-0.5 text-sm font-black text-gray-900">
                          {installmentPlanPreview.remaining > 0
                            ? formatPriceWithStoredSettings(installmentPlanPreview.remaining)
                            : '—'}
                        </p>
                      </div>
                    </div>
                    {installmentPlanPreview.days > 0 && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                        <Clock className="h-3.5 w-3.5 text-[#FF6A00]" />
                        Solde à régler sur {installmentPlanPreview.days} jour
                        {installmentPlanPreview.days > 1 ? 's' : ''}.
                      </p>
                    )}
                  </div>
                )}

                {/* Group: amount & duration */}
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[#FF6A00]" />
                    <p className="text-xs font-black uppercase tracking-wide text-gray-700">Montant &amp; durée</p>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Premier paiement minimum</label>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={form.installmentMinAmount}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, installmentMinAmount: e.target.value }))
                        }
                        className={inputClass}
                        placeholder="Ex: 30000"
                      />
                      <p className="text-[11px] text-gray-400">Acompte requis à la commande (≤ prix du produit).</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Durée (jours)</label>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={form.installmentDuration}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, installmentDuration: e.target.value }))
                        }
                        className={inputClass}
                        placeholder="Ex: 30"
                      />
                      <p className="text-[11px] text-gray-400">Doit correspondre à l'écart des dates ci-dessous.</p>
                    </div>
                  </div>
                </div>

                {/* Group: schedule window */}
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#FF6A00]" />
                    <p className="text-xs font-black uppercase tracking-wide text-gray-700">Période de l'échéancier</p>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Date de début</label>
                      <input
                        type="date"
                        value={form.installmentStartDate}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, installmentStartDate: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Date de fin</label>
                      <input
                        type="date"
                        value={form.installmentEndDate}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, installmentEndDate: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Group: late rules & guarantees */}
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#FF6A00]" />
                    <p className="text-xs font-black uppercase tracking-wide text-gray-700">Règles &amp; garanties</p>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Percent className="h-3.5 w-3.5 text-gray-400" />
                        Pénalité de retard (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        inputMode="numeric"
                        value={form.installmentLatePenaltyRate}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, installmentLatePenaltyRate: e.target.value }))
                        }
                        className={inputClass}
                        placeholder="Ex: 5"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                        Impayés max avant suspension
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        inputMode="numeric"
                        value={form.installmentMaxMissedPayments}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, installmentMaxMissedPayments: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <label
                    className={`mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors ${
                      form.installmentRequireGuarantor
                        ? 'border-[#FF6A00]/40 bg-[#FFF7ED]'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          form.installmentRequireGuarantor ? 'bg-[#FF6A00] text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Users className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-800">Exiger un garant</span>
                        <span className="block text-[11px] text-gray-500">
                          L'acheteur devra fournir les informations d'un garant.
                        </span>
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(form.installmentRequireGuarantor)}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, installmentRequireGuarantor: e.target.checked }))
                      }
                      className="h-4 w-4 shrink-0 rounded border-gray-300 text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                  </label>
                </div>
              </div>
            )}

            {installmentError && (
              <p className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{installmentError}</span>
              </p>
            )}
          </div>

          <div className={`min-w-0 space-y-4 overflow-hidden rounded-2xl border p-4 transition-colors ${form.wholesaleEnabled ? 'border-[#FF6A00]/40 bg-[#FFF7ED]' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${form.wholesaleEnabled ? 'bg-[#FF6A00] text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Boxes className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900">Vente en gros</p>
                  <p className="mt-0.5 text-xs leading-snug text-gray-500">
                    Des paliers: plus la quantité augmente, plus le prix unitaire baisse.
                  </p>
                </div>
              </div>
              {renderSwitchButton({
                checked: Boolean(form.wholesaleEnabled),
                disabled: !isBoutiqueOwner,
                label: 'Activer la vente en gros',
                onChange: setWholesaleEnabled
              })}
            </div>

            {!isBoutiqueOwner && (
              <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Réservé aux comptes convertis en boutique.
              </p>
            )}

            {form.wholesaleEnabled && (
              <div className="space-y-3">
                {(Array.isArray(form.wholesaleTiers) ? form.wholesaleTiers : []).map((tier, index) => (
                  <div
                    key={`wholesale-tier-${index}`}
                    className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">Qté min</label>
                      <input
                        type="number"
                        min="2"
                        value={tier?.minQty ?? ''}
                        onChange={(e) => updateWholesaleTier(index, 'minQty', e.target.value)}
                        className={inputClass}
                        placeholder="Ex: 10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">Prix / unité</label>
                      <input
                        type="number"
                        min="1"
                        value={tier?.unitPrice ?? ''}
                        onChange={(e) => updateWholesaleTier(index, 'unitPrice', e.target.value)}
                        className={inputClass}
                        placeholder="Ex: 9500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">Libellé (optionnel)</label>
                      <input
                        type="text"
                        value={tier?.label ?? ''}
                        onChange={(e) => updateWholesaleTier(index, 'label', e.target.value)}
                        className={inputClass}
                        placeholder="Ex: 10-49"
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeWholesaleTier(index)}
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
                        aria-label="Supprimer ce palier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addWholesaleTier}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un palier
                </button>

                {normalizedWholesalePreviewTiers.length > 0 && (
                  <div className="rounded-xl border border-[#FF6A00]/30 bg-white p-3">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#FF6A00]">
                      <Boxes className="h-3.5 w-3.5" />
                      Aperçu des prix appliqués
                    </div>
                    <div className="space-y-1.5 text-xs text-gray-700">
                      {Number.isFinite(wholesalePreviewBasePrice) &&
                        wholesalePreviewBasePrice > 0 &&
                        normalizedWholesalePreviewTiers[0]?.minQty > 1 && (
                          <p>
                            Qté 1-{normalizedWholesalePreviewTiers[0].minQty - 1}:{" "}
                            <span className="font-semibold">
                              {formatPriceWithStoredSettings(wholesalePreviewBasePrice)}
                            </span>{" "}
                            / unité
                          </p>
                        )}
                      {normalizedWholesalePreviewTiers.map((tier, index) => {
                        const nextTier = normalizedWholesalePreviewTiers[index + 1];
                        const rangeLabel = nextTier
                          ? `${tier.minQty}-${nextTier.minQty - 1}`
                          : `${tier.minQty}+`;
                        return (
                          <p key={`wholesale-preview-${tier.minQty}-${index}`}>
                            {tier.label ? `${tier.label}:` : `Qté ${rangeLabel}:`}{" "}
                            <span className="font-semibold">
                              {formatPriceWithStoredSettings(tier.unitPrice)}
                            </span>{" "}
                            / unité
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {wholesaleError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {wholesaleError}
              </p>
            )}
          </div>
                </div>
          )}
        </div>

        <div className={sectionShellClass}>
          {renderSectionHeader({
            id: 'options',
            icon: Package,
            title: 'Options & dimensions',
            subtitle: 'Ajoutez seulement les options utiles à la commande.'
          })}

          {(!isMobile || expandedSections.options) && (
            <div className="space-y-4 pt-1">
              <div className={`${innerPanelClass} space-y-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Attributs acheteur</p>
                    <p className="text-xs text-gray-500">
                      Choix sans impact sur le prix (ex: taille, matière). Pour des prix différents par variante, renseignez le prix sous chaque photo, dans la section Photos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addProductAttribute}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                </div>

                {(Array.isArray(form.attributes) ? form.attributes : []).length > 0 ? (
                  <div className="space-y-3">
                    {(Array.isArray(form.attributes) ? form.attributes : []).map((attribute, index) => {
                      const attributeType = attribute?.type || 'select';
                      const attributeName = String(attribute?.name || '').trim();
                      const canUseOptions = attributeType === 'select';
                      return (
                        <div
                          key={`product-attribute-${index}`}
                          className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3"
                        >
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.9fr_auto]">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-gray-700">Nom affiché</label>
                              <div className="flex flex-wrap gap-2">
                                <select
                                  value={ATTRIBUTE_TYPE_OPTIONS.includes(attributeName) ? attributeName : 'Custom'}
                                  onChange={(e) => {
                                    const nextName = e.target.value === 'Custom' ? '' : e.target.value;
                                    updateProductAttribute(index, 'name', nextName);
                                  }}
                                  className="min-w-[132px] rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                                >
                                  {ATTRIBUTE_TYPE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                {(!ATTRIBUTE_TYPE_OPTIONS.includes(attributeName) || attributeName === '') && (
                                  <input
                                    type="text"
                                    value={attribute.name || ''}
                                    onChange={(e) => updateProductAttribute(index, 'name', e.target.value)}
                                    className="min-w-[180px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                                    placeholder="Ex: Pointure"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-gray-700">Type de saisie</label>
                              <select
                                value={attributeType}
                                onChange={(e) => updateProductAttribute(index, 'type', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                              >
                                {ATTRIBUTE_INPUT_TYPES.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-start justify-end">
                              <button
                                type="button"
                                onClick={() => removeProductAttribute(index)}
                                className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100 transition-colors"
                                aria-label="Supprimer cet attribut"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
                              <span>Champ obligatoire</span>
                              <input
                                type="checkbox"
                                checked={Boolean(attribute?.required)}
                                onChange={(e) => updateProductAttribute(index, 'required', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-neutral-600 focus:ring-neutral-500"
                              />
                            </label>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-gray-700">Valeur par défaut (optionnelle)</label>
                              <input
                                type={attributeType === 'number' ? 'number' : 'text'}
                                value={attribute?.defaultValue || ''}
                                onChange={(e) => updateProductAttribute(index, 'defaultValue', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                                placeholder={canUseOptions ? 'Ex: Rouge' : 'Valeur par défaut'}
                              />
                            </div>
                          </div>

                          {canUseOptions && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-medium text-gray-700">Choix disponibles</p>
                                  <p className="text-[11px] text-gray-500">
                                    Ajoutez autant d'options que nécessaire.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addProductAttributeOption(index)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Option
                                </button>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                {(Array.isArray(attribute?.options) ? attribute.options : ['']).map((option, optionIndex) => (
                                  <div key={`product-attribute-${index}-option-${optionIndex}`} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={option || ''}
                                      onChange={(e) => updateProductAttributeOption(index, optionIndex, e.target.value)}
                                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                                      placeholder={`Option ${optionIndex + 1}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeProductAttributeOption(index, optionIndex)}
                                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50"
                                      aria-label="Supprimer cette option"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-4 text-sm text-gray-500">
                    Aucun attribut configuré. Ajoutez-en seulement si l'acheteur doit choisir une option avant de commander.
                  </div>
                )}
              </div>

              <div className={`${innerPanelClass} space-y-4`}>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Caractéristiques physiques</p>
                  <p className="text-xs text-gray-500">
                    Facultatif. Prépare le produit pour la livraison, les futures variantes et les recommandations.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Poids</p>
                    <div className="grid grid-cols-[1fr_96px] gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.physical?.weight?.value ?? ''}
                        onChange={(e) => updatePhysicalField('weight', 'value', e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        placeholder="Ex: 2.5"
                      />
                      <select
                        value={form.physical?.weight?.unit || 'kg'}
                        onChange={(e) => updatePhysicalField('weight', 'unit', e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dimensions</p>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.physical?.dimensions?.length ?? ''}
                        onChange={(e) => updatePhysicalField('dimensions', 'length', e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        placeholder="Long."
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.physical?.dimensions?.width ?? ''}
                        onChange={(e) => updatePhysicalField('dimensions', 'width', e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        placeholder="Larg."
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.physical?.dimensions?.height ?? ''}
                        onChange={(e) => updatePhysicalField('dimensions', 'height', e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        placeholder="Haut."
                      />
                    </div>
                    <select
                      value={form.physical?.dimensions?.unit || 'cm'}
                      onChange={(e) => updatePhysicalField('dimensions', 'unit', e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                    >
                      <option value="cm">cm</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section Images */}
        <div className={sectionShellClass}>
          {renderSectionHeader({
            id: 'images',
            icon: Camera,
            title: 'Photos & variantes',
            subtitle: 'Chaque photo peut devenir une variante : option et prix sous l’image.'
          })}

          {/* Image upload content - shown on desktop always, on mobile when expanded */}
          {(!isMobile || expandedSections.images) && (
            <div className="space-y-3 pt-1">
              {/* Upload d'images */}
              <div className="space-y-3">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Camera className="w-4 h-4 text-neutral-500" />
                  <span>
                    Photos{' '}
                    {(existingImages.length + files.length) > 0 &&
                      `(${existingImages.length + files.length})`}
                  </span>
                </label>
                <p className="text-xs text-gray-500">
                  Jusqu&apos;à {maxImagesLimit} photos. Les images sont optimisées automatiquement avant l&apos;upload.
                </p>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-3 text-xs text-emerald-900">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700" />
                    <div className="space-y-1">
                      <p className="font-semibold">Pour de meilleures photos publiées</p>
                      <p className="leading-relaxed">
                        Utilisez une lumière naturelle, gardez le produit entier dans le cadre, prenez la première photo de face et évitez les captures WhatsApp floues. <span className="font-bold text-emerald-800">Le format carré (1:1, ex: 800×800px)</span> donne le rendu le plus propre sur les cartes produit et la page détail.
                      </p>
                    </div>
                  </div>
                </div>
                {mediaOptimization.active && (
                  <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700">
                    Optimisation des photos en cours...
                  </p>
                )}
                {!mediaOptimization.active && mediaOptimization.optimizedCount > 0 && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    {mediaOptimization.optimizedCount} photo(s) optimisée(s), {formatFileSize(mediaOptimization.savedBytes)} économisés.
                  </p>
                )}

                {existingImages.length + imagePreviews.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="shrink-0 text-xs font-semibold text-gray-600">Nom du choix</span>
                    <input
                      type="text"
                      value={imageVariantName}
                      onChange={(e) => setImageVariantName(e.target.value)}
                      className="min-w-[120px] flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#FF6A00] focus:outline-none"
                      placeholder="Ex: Couleur, Modèle, Dimension"
                    />
                    <span className="w-full text-[11px] text-gray-500 sm:w-auto">
                      Renseignez l'option et son prix sous chaque photo — l'acheteur choisira par photo.
                    </span>
                  </div>
                )}

                {existingImages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Images actuelles ({existingImages.length})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {existingImages.map((src, index) => (
                        <div key={`${src}-${index}`} className="group rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-100">
                          <div className="relative aspect-square">
                            <img
                              src={thumbImageUrl(src)}
                              alt={`Image existante ${index + 1}`}
                              className="w-full h-full object-contain"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingImage(index)}
                              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-500 shadow flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Supprimer l'image"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          {renderImageVariantFields(index)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <label className={`flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 active:bg-gray-100 transition-colors group ${isMobile ? 'h-28 min-h-[120px] py-4' : 'h-32'}`}>
                  <Upload className={`text-gray-400 group-hover:text-neutral-500 transition-colors mb-2 ${isMobile ? 'w-10 h-10' : 'w-8 h-8'}`} />
                  <span className={`text-gray-500 text-center ${isMobile ? 'text-sm' : 'text-sm'}`}>
                    <span className="text-neutral-600 font-medium">{isMobile ? 'Appuyez pour ajouter des photos' : 'Cliquez pour uploader'}</span>
                    <br />
                    <span className="text-xs">JPG, PNG, WEBP optimisés</span>
                  </span>
                  <input
                    type="file"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                    accept="image/*"
                  />
                </label>
                {imageError && (
                  <p className="text-xs text-red-500">{imageError}</p>
                )}

                {/* Previews des images – choisir Recadrer ou Laisser tel quel pour chaque photo */}
                {imagePreviews.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                      Pour chaque photo : <strong>Recadrer</strong> pour ajuster le cadre, ou <strong>Laisser tel quel</strong> pour garder l&apos;originale.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {imagePreviews.map((preview, index) => {
                        const item = files[index];
                        const cropped = item?.cropped;
                        const leftAsIs = item?.leftAsIs;
                        return (
                          <div key={index} className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                            <img
                              src={preview.url}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-28 sm:h-32 object-cover"
                            />
                            <div className="absolute top-1 left-1 flex flex-wrap gap-1">
                              {cropped && (
                                <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded font-semibold">
                                  Recadré
                                </span>
                              )}
                              {leftAsIs && (
                                <span className="bg-slate-500 text-white text-[10px] px-2 py-0.5 rounded font-semibold">
                                  Tel quel
                                </span>
                              )}
                            </div>
                            <div className="absolute top-1 right-1">
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-all"
                                aria-label="Supprimer l'image"
                                title="Supprimer"
                              >
                                <DeleteIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="p-2 flex flex-wrap gap-1.5 border-t border-gray-200 bg-white">
                              <button
                                type="button"
                                onClick={() => editImageCrop(index)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
                                aria-label="Recadrer cette image"
                                title="Recadrer"
                              >
                                <Crop className="w-3.5 h-3.5" />
                                Recadrer
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLeaveAsIs(index)}
                                disabled={leftAsIs}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-default transition-colors"
                                aria-label="Laisser cette image telle quelle"
                                title="Laisser tel quel"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Laisser tel quel
                              </button>
                            </div>
                            {renderImageVariantFields(existingImages.length + index)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {canUploadVideo ? (
          <div className={sectionShellClass}>
            {renderSectionHeader({
              icon: Video,
              collapsible: false,
              title: 'Vidéo de présentation',
              subtitle: `Ajoutez une courte vidéo (MP4, MOV, WEBM). Taille maximale ${MAX_VIDEO_SIZE_MB} Mo.`
            })}
            <input
              id="product-form-video-input"
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              className="hidden"
            />
            {existingVideoUrl && !videoFile && !removeExistingVideo ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Vidéo actuelle</p>
                <div className="rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  <video
                    src={existingVideoUrl}
                    controls
                    playsInline
                    className="w-full max-h-64 object-contain"
                  />
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleKeepExistingVideo}
                      className="px-3 py-2 text-sm font-semibold rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      Conserver
                    </button>
                    <button
                      type="button"
                      onClick={handleReplaceVideo}
                      className="px-3 py-2 text-sm font-semibold rounded-full bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Remplacer
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveExistingVideo}
                      className="px-3 py-2 text-sm font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ) : !videoFile && !isCompressingVideo ? (
              <label
                htmlFor="product-form-video-input"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <Video className="w-8 h-8 text-gray-400 group-hover:text-emerald-500 transition-colors mb-2" />
                <span className="text-sm text-gray-500 text-center">
                  {removeExistingVideo ? 'Vidéo supprimée. Cliquez pour en ajouter une nouvelle.' : 'Cliquez pour uploader votre vidéo'}
                </span>
              </label>
            ) : null}
            {isCompressingVideo && (
              <div className="space-y-3 p-4 rounded-xl border-2 border-neutral-300 bg-gradient-to-br from-neutral-50 to-neutral-50 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border-3 border-neutral-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">Compression de la vidéo en cours...</p>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        Optimisation en 720p pour réduire le poids et accélérer l'upload
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-bold text-neutral-700">{Math.round(compressionProgress)}%</span>
                    <span className="text-[10px] text-neutral-500 font-medium">Progression</span>
                  </div>
                </div>
                
                {/* Main Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full rounded-full bg-gray-200 h-3 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-neutral-500 via-neutral-500 to-teal-500 transition-all duration-300 ease-out shadow-lg relative"
                      style={{ width: `${compressionProgress}%` }}
                    >
                      {/* Subtle animated shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                    </div>
                  </div>
                  
                  {/* Progress indicators */}
                  <div className="flex items-center justify-between text-[10px] text-gray-600">
                    <span>0%</span>
                    <span className="font-semibold text-neutral-600">En cours...</span>
                    <span>100%</span>
                  </div>
                </div>
                
                {/* Additional info */}
                <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold text-neutral-700">Taille originale:</span>{' '}
                      {(originalVideoSize / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="w-px h-4 bg-neutral-200"></div>
                  <div className="flex-1 text-right">
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold text-neutral-700">Cible:</span>{' '}
                      {MAX_VIDEO_SIZE_MB} MB max
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {videoFile && !isCompressingVideo && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate font-medium">{videoFile.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500">
                        {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      {originalVideoSize > videoFile.size && (
                        <>
                          <span className="text-xs text-gray-400">•</span>
                          <p className="text-xs text-emerald-600 font-semibold">
                            Réduit de {((1 - videoFile.size / originalVideoSize) * 100).toFixed(1)}%
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeVideo}
                    className="ml-3 text-xs font-semibold text-red-600 hover:text-red-500 px-2 py-1 hover:bg-red-50 rounded transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
                {originalVideoSize > MAX_VIDEO_SIZE_MB * 1024 * 1024 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-700">
                      Vidéo optimisée avec succès pour un upload plus rapide.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {videoError && (
              <div className="px-3 py-2 rounded-xl border border-red-200 bg-red-50">
                <p className="text-xs text-red-600">{videoError}</p>
              </div>
            )}
            
            {isUploadingVideo && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Upload en cours...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full rounded-full bg-gray-100 h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-neutral-600 to-neutral-600 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
            <p className="font-semibold text-gray-700">Vidéo réservée aux boutiques certifiées</p>
            <p>
              Contactez un administrateur via{' '}
              <a href="/help" className="font-semibold text-neutral-600 hover:underline">
                le centre d'aide
              </a>{' '}
              pour valider votre boutique.
            </p>
          </div>
        )}

        <div className={sectionShellClass}>
          {renderSectionHeader({
            icon: Video,
            collapsible: false,
            title: 'Vidéo Facebook / TikTok',
            subtitle: 'Collez le lien d’une vidéo Facebook ou TikTok. Elle sera intégrée et lisible sur la page du produit.'
          })}
          <input
            type="url"
            inputMode="url"
            value={form.socialVideoUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, socialVideoUrl: e.target.value }))}
            placeholder="https://www.tiktok.com/@compte/video/123…  ·  https://www.facebook.com/…"
            className={inputClass}
          />
          {form.socialVideoUrl?.trim() && !isValidSocialVideoUrl(form.socialVideoUrl) && (
            <p className="mt-2 text-xs font-medium text-red-600">
              Lien non reconnu. Utilisez un lien Facebook ou TikTok valide.
            </p>
          )}
        </div>

        {canUploadPdf && (
          <div className={sectionShellClass}>
            {renderSectionHeader({
              icon: FileText,
              collapsible: false,
              title: 'Fiche produit (PDF)',
              subtitle: `Ajoutez un document PDF si le produit a une fiche technique. Taille maximale ${MAX_PDF_SIZE_MB} Mo.`
            })}
            {existingPdf && !pdfFile && !removePdf && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <div>
                  <span className="font-medium">PDF actuel :</span>{' '}
                  <a
                    href={existingPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-neutral-600 hover:underline"
                  >
                    Ouvrir
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setRemovePdf(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                  aria-label="Supprimer le PDF"
                  title="Supprimer le PDF"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            {removePdf && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <span>Le PDF sera supprimé lors de l'enregistrement.</span>
                <button
                  type="button"
                  onClick={() => setRemovePdf(false)}
                  className="text-xs font-semibold text-red-600 hover:text-red-500"
                >
                  Annuler
                </button>
              </div>
            )}
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors group">
              <FileText className="w-8 h-8 text-gray-400 group-hover:text-slate-600 transition-colors mb-2" />
              <span className="text-sm text-gray-500 text-center">Cliquez pour uploader un PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfChange}
                className="hidden"
              />
            </label>
            {pdfFile && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 bg-white">
                <span className="text-sm text-gray-700 truncate">{pdfFile.name}</span>
                <button
                  type="button"
                  onClick={removePdfFile}
                  className="text-xs font-semibold text-red-600 hover:text-red-500"
                >
                  Supprimer
                </button>
              </div>
            )}
            {pdfError && <p className="text-xs text-red-500">{pdfError}</p>}
          </div>
        )}

        {!isEditing && (
          <div className={sectionShellClass}>
            {renderSectionHeader({
              icon: ShieldCheck,
              collapsible: false,
              accent: 'amber',
              title: "Validation de l'annonce",
              subtitle: 'Résumé des frais avant publication.'
            })}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-3 flex-1">
                  <h3 className="font-semibold text-amber-800 text-sm">Commission de publication</h3>
                  <p className="text-amber-700 text-sm">
                    Pour valider votre annonce, envoyez <span className="font-bold">{formatPriceWithStoredSettings(calculateCommission())}</span> ({commissionRateLabel}% du prix).
                  </p>

                  {/* Wallet Payment Option */}
                  <div className="rounded-xl border border-amber-300 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          <ShieldCheck className="w-4 h-4 inline-block text-emerald-600 mr-1" />
                          Payer avec le portefeuille
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Prélèvement automatique de {formatPriceWithStoredSettings(calculateCommission())}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={payWithWallet}
                          onChange={(e) => setPayWithWallet(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                      </label>
                    </div>
                    {payWithWallet && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-start space-x-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-emerald-800">Validation automatique</p>
                            <p className="text-xs text-emerald-700">
                              Votre annonce sera <span className="font-bold">automatiquement validée</span> après prélèvement
                              {promoPreview?.valid && promoPreview?.commission?.dueAmount !== undefined
                                ? ` de ${formatPriceWithStoredSettings(promoPreview.commission.dueAmount)}`
                                : ` de ${formatPriceWithStoredSettings(calculateCommission())}`} sur votre portefeuille.
                            </p>
                          </div>
                        </div>

                        {/* Promo Code Input */}
                        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-3">
                          <label className="text-xs font-semibold text-neutral-600">Code promo (optionnel)</label>
                          <div className="mt-1.5 flex gap-2">
                            <input
                              type="text"
                              value={promoCode}
                              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                              placeholder="Ex: HDMPROMO"
                              className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium uppercase placeholder:text-neutral-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            />
                          </div>
                          {promoLoading && (
                            <p className="mt-1 text-[10px] text-neutral-400">Vérification...</p>
                          )}
                          {!promoLoading && promoCode.trim() && promoPreview && (
                            promoPreview.valid ? (
                              <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-2 text-xs">
                                {promoPreview.commission?.isWaived ? (
                                  <p className="font-semibold text-emerald-700">
                                    🎉 Commission offerte ! Votre annonce sera validée sans frais.
                                  </p>
                                ) : (
                                  <p className="text-emerald-700">
                                    <span className="font-semibold">Réduction :</span>{' '}
                                    {formatPriceWithStoredSettings(promoPreview.commission?.discountAmount || 0)} —{' '}
                                    reste à payer :{' '}
                                    <span className="font-bold">{formatPriceWithStoredSettings(promoPreview.commission?.dueAmount || 0)}</span>
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="mt-2 text-[10px] text-red-500">{promoPreview.message || 'Code invalide.'}</p>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {!payWithWallet && (
                    <p className="text-amber-700 text-sm">
                      Vous pouvez aussi utiliser un code promo dans la section paiement de <span className="font-semibold">/my</span>.
                    </p>
                  )}
                  <div className="flex items-center space-x-2 text-xs text-amber-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{payWithWallet ? 'Le montant sera débité immédiatement de votre portefeuille.' : 'Votre annonce sera approuvée sous 24h après paiement.'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Section */}
        {(form.title || imagePreviews.length > 0 || existingImages.length > 0) && (
          <div className={sectionShellClass}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Aperçu</h2>
                <p className="text-sm text-gray-500">Contrôlez le rendu avant publication.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors"
              >
                {showPreview ? (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    <span>Masquer</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    <span>Afficher</span>
                  </>
                )}
              </button>
            </div>
            
            {showPreview && (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="max-w-sm mx-auto">
                  <ProductCard
                    p={{
                      _id: 'preview',
                      title: form.title || 'Titre du produit',
                      description: form.description || 'Description du produit',
                      price: form.price || 0,
                      category: form.category || '',
                      condition: form.condition || 'used',
                      discount: form.discount || 0,
                      warrantyEnabled: Boolean(form.warrantyEnabled),
                      warrantyPeriodValue: form.warrantyPeriodValue || null,
                      warrantyPeriodUnit: form.warrantyPeriodUnit || 'months',
                      images: [
                        ...existingImages,
                        ...imagePreviews.map(p => p.url)
                      ].filter(Boolean),
                      user: user ? {
                        _id: user.id,
                        name: user.name,
                        shopName: user.shopName,
                        shopVerified: user.shopVerified,
                        shopLogo: user.shopLogo
                      } : null,
                      createdAt: new Date().toISOString(),
                      views: 0,
                      favoritesCount: 0,
                      commentCount: 0,
                      ratingAverage: 0,
                      ratingCount: 0
                    }}
                    hideMobileDiscountBadge={false}
                    disableProductNavigation
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bouton de soumission — sticky sur mobile (Apple-style primary) */}
        {isMobile ? (
          <div
            className={
              isEmbeddedMobile
                ? 'sticky bottom-0 z-30 mt-4 border-t border-neutral-200/80 bg-white/95 px-0 pt-3 pb-[calc(0.9rem+env(safe-area-inset-bottom))] backdrop-blur-md safe-area-pb'
                : 'fixed bottom-0 left-0 right-0 z-40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-[#f6f6f3]/95 backdrop-blur-xl border-t border-neutral-200/70 safe-area-pb'
            }
          >
            {isEmbeddedMobile && onCancel ? (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="hd-soft-button w-full min-h-[46px] rounded-xl text-sm font-semibold"
                >
                  Annuler
                </button>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={submitDisabled}
              className="hd-primary-button flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl py-4 text-[17px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{isEditing ? 'Mise à jour...' : 'Publication...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>{buttonLabel}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={submitDisabled}
            className="hd-primary-button flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{isEditing ? 'Mise à jour en cours...' : 'Publication en cours...'}</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>{buttonLabel}</span>
              </>
            )}
          </button>
        )}
      </form>

      {/* ── CROP MODAL (new system: fixed frame, image pans/zooms) ── */}
      {croppingImage && (() => {
        const cw = cropContainerRef.current?.clientWidth || 400;
        const ch = cropContainerRef.current?.clientHeight || 400;
        const { w: nw, h: nh } = imgNaturalSizeRef.current;
        const frame = computeCropFrame(cw, ch, cropAspect);
        const minScale = computeMinScale(frame, nw, nh);
        const zoomPct = nw > 0 ? Math.round((imageScale / minScale) * 100) : 100;
        const sliderMinScale = minScale * CROP_MIN_ZOOM;
        const sliderMaxScale = Math.max(CROP_MAX_ZOOM, minScale * 5);
        return (
          <BaseModal
            isOpen={Boolean(croppingImage)}
            onClose={handleCropCancel}
            size="full"
            mobileSheet
            ariaLabel="Recadrer image"
            rootClassName={isMobile ? '!p-0' : ''}
            panelClassName="border-0 bg-transparent shadow-none sm:max-w-none"
            backdropClassName="!bg-black/90 backdrop-blur-sm"
          >
            <div className={`bg-[#1a1a1a] shadow-2xl overflow-hidden flex flex-col ${isMobile ? 'w-full h-full max-h-none rounded-none' : 'rounded-2xl max-w-2xl w-full max-h-[95vh]'}`}>

              {/* ── Header ── */}
              <div className={`flex items-center justify-between bg-[#1a1a1a] border-b border-white/10 flex-shrink-0 ${isMobile ? 'px-4 py-3 safe-area-top' : 'px-4 py-3'}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FF6A00] flex items-center justify-center flex-shrink-0">
                    <Crop className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Modifier la photo</p>
                    <p className="text-[11px] text-white/50">Recadrez, pivotez et retouchez votre image</p>
                  </div>
                </div>
                <button type="button" onClick={handleCropCancel}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white active:bg-white/20 transition-colors touch-manipulation"
                  aria-label="Fermer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Aspect ratio pills ── */}
              <div className="flex-shrink-0 flex items-center gap-2 overflow-x-auto bg-[#111] px-4 py-2.5 border-b border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center">
                <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-wide text-white/40">Format</span>
                {[
                  { key: null, label: 'Libre', hint: 'Format original' },
                  { key: '1:1', label: 'Carré', hint: 'Fiche produit' },
                  { key: '4:5', label: 'Portrait', hint: '' },
                  { key: '4:3', label: 'Paysage', hint: '' },
                  { key: '3:4', label: '3:4', hint: '' },
                  { key: '16:9', label: '16:9', hint: '' },
                ].map(({ key, label }) => (
                  <button key={label} type="button" onClick={() => applyCropAspectPreset(key)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all touch-manipulation ${
                      cropAspect === key
                        ? 'bg-[#FF6A00] text-white shadow-[0_4px_12px_rgba(255,106,0,0.4)]'
                        : 'bg-white/10 text-white/70 active:bg-white/20'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Canvas ── */}
              <div className="flex-1 min-h-0 flex items-center justify-center bg-black overflow-hidden">
                <div
                  ref={cropContainerRef}
                  className={`relative overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing ${
                    isMobile ? 'w-full' : 'w-full max-w-lg'
                  }`}
                  onMouseDown={handleCropMouseDown}
                  onMouseMove={(e) => cropMoveRef.current(e)}
                  onMouseUp={handleCropMouseUp}
                  onMouseLeave={handleCropMouseUp}
                  onWheel={handleCropWheel}
                  onTouchStart={handleCropTouchStart}
                  onTouchMove={(e) => { e.preventDefault(); handleCropTouchMove(e); }}
                  onTouchEnd={handleCropTouchEnd}
                  onTouchCancel={handleCropTouchEnd}
                  style={{
                    aspectRatio: cropAspect
                      ? String(ASPECT_PRESETS[cropAspect])
                      : (nw > 0 && nh > 0 ? `${nw} / ${nh}` : '1 / 1'),
                    maxHeight: isMobile ? '55vh' : '480px',
                    touchAction: 'none',
                    backgroundColor: '#000'
                  }}
                >
                  {/* The image — pans and zooms inside the canvas */}
                  <img
                    ref={imageRef}
                    src={croppingImage.url}
                    alt="A recadrer"
                    draggable={false}
                    className="absolute pointer-events-none select-none"
                    style={{
                      width: `${nw * imageScale || 0}px`,
                      height: `${nh * imageScale || 0}px`,
                      left: `${imagePosition.x}px`,
                      top: `${imagePosition.y}px`,
                      filter: filterCss,
                      willChange: 'transform',
                    }}
                    onLoad={(e) => {
                      const img = e.target;
                      const container = cropContainerRef.current;
                      if (!container) return;
                      const natW = img.naturalWidth;
                      const natH = img.naturalHeight;
                      imgNaturalSizeRef.current = { w: natW, h: natH };
                      const containerW = container.clientWidth;
                      const containerH = container.clientHeight;
                      const fr = computeCropFrame(containerW, containerH, cropAspect);
                      const ms = computeMinScale(fr, natW, natH);
                      const sw = natW * ms;
                      const sh = natH * ms;
                      setImageScale(ms);
                      setImagePosition({
                        x: fr.x + (fr.w - sw) / 2,
                        y: fr.y + (fr.h - sh) / 2
                      });
                    }}
                  />

                  {/* Rule-of-thirds grid (always visible) */}
                  <div className="absolute inset-0 pointer-events-none">
                    {[1, 2].map((i) => (
                      <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: `${(i / 3) * 100}%` }} />
                    ))}
                    {[1, 2].map((i) => (
                      <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-white/20" style={{ top: `${(i / 3) * 100}%` }} />
                    ))}
                    {/* Orange border frame */}
                    <div className="absolute inset-0 border-2 border-[#FF6A00]/80 pointer-events-none" />
                    {/* Corner accents */}
                    {[
                      'top-0 left-0 border-t-2 border-l-2',
                      'top-0 right-0 border-t-2 border-r-2',
                      'bottom-0 left-0 border-b-2 border-l-2',
                      'bottom-0 right-0 border-b-2 border-r-2',
                    ].map((cls, i) => (
                      <div key={i} className={`absolute w-5 h-5 border-[#FF6A00] ${cls}`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Tabbed editor: Recadrer / Filtres ── */}
              <div className="flex-shrink-0 bg-[#111] border-t border-white/10">
                {/* Tab switcher */}
                <div className="flex items-center gap-2 px-4 pt-3">
                  {[
                    { id: 'crop', label: 'Recadrer', icon: Crop },
                    { id: 'filters', label: 'Filtres', icon: SlidersHorizontal }
                  ].map(({ id, label, icon: Icon }) => {
                    const active = cropTab === id;
                    return (
                      <button key={id} type="button" onClick={() => setCropTab(id)}
                        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition touch-manipulation ${
                          active ? 'bg-white text-[#1a1a1a]' : 'bg-white/10 text-white/60 active:bg-white/20'
                        }`}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                        {id === 'filters' && !filtersAreDefault && (
                          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#FF6A00]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content */}
                {cropTab === 'crop' ? (
                  <div className="px-4 py-3 space-y-3">
                    {/* Rotate / flip / fit */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {[
                          { fn: handleRotateLeft, icon: RotateCcw, label: 'Tourner gauche' },
                          { fn: handleRotateRight, icon: RotateCw, label: 'Tourner droite' },
                          { fn: handleFlipH, icon: FlipHorizontal, label: 'Miroir H' },
                          { fn: handleFlipV, icon: FlipVertical, label: 'Miroir V' }
                        ].map(({ fn, icon: Icon, label }) => (
                          <button key={label} type="button" onClick={fn}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition-colors active:bg-white/20 touch-manipulation"
                            aria-label={label} title={label}>
                            <Icon className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={resetCropFit}
                        className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 active:bg-white/20 touch-manipulation">
                        <Maximize2 className="w-3.5 h-3.5" />
                        Ajuster
                      </button>
                    </div>

                    {/* Zoom */}
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => handleZoomChange(-0.15)}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20 touch-manipulation"
                        aria-label="Zoom arrière">
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <input type="range" min={sliderMinScale} max={sliderMaxScale} step={0.001} value={imageScale}
                        onChange={handleZoomInput}
                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20"
                        style={{ accentColor: '#FF6A00' }} />
                      <button type="button" onClick={() => handleZoomChange(0.15)}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white active:bg-white/20 touch-manipulation"
                        aria-label="Zoom avant">
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <span className="w-12 flex-shrink-0 text-right text-xs font-black text-[#FF6A00]">{zoomPct}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 space-y-3.5">
                    {[
                      { key: 'brightness', label: 'Luminosité', icon: Sun, min: 50, max: 150 },
                      { key: 'contrast', label: 'Contraste', icon: Contrast, min: 50, max: 150 },
                      { key: 'saturate', label: 'Saturation', icon: Droplet, min: 0, max: 200 }
                    ].map(({ key, label, icon: Icon, min, max }) => (
                      <div key={key}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                            <Icon className="w-3.5 h-3.5 text-white/50" />
                            {label}
                          </span>
                          <span className="w-12 text-right text-[11px] font-black text-[#FF6A00]">
                            {imageFilters[key]}%
                          </span>
                        </div>
                        <input type="range" min={min} max={max} step={1} value={imageFilters[key]}
                          onChange={(e) => setImageFilters((f) => ({ ...f, [key]: Number(e.target.value) }))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20"
                          style={{ accentColor: '#FF6A00' }} />
                      </div>
                    ))}
                    <button type="button" onClick={() => setImageFilters(DEFAULT_IMAGE_FILTERS)} disabled={filtersAreDefault}
                      className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white/80 transition active:bg-white/20 disabled:opacity-40 touch-manipulation">
                      Réinitialiser les filtres
                    </button>
                  </div>
                )}
              </div>

              {/* ── Footer: cancel + confirm ── */}
              <div className={`flex items-stretch gap-0 border-t border-white/10 bg-[#1a1a1a] flex-shrink-0 ${isMobile ? 'pb-[env(safe-area-inset-bottom)]' : ''}`}>
                <button type="button" onClick={handleCropCancel}
                  className="flex-1 py-4 text-sm font-semibold text-white/60 active:bg-white/5 transition-colors touch-manipulation border-r border-white/10">
                  Annuler
                </button>
                <button type="button" onClick={handleCropConfirm}
                  className="flex-1 py-4 text-sm font-bold text-[#FF6A00] active:bg-[#FF6A00]/10 transition-colors touch-manipulation">
                  Confirmer
                </button>
              </div>

            </div>
          </BaseModal>
        );
      })()}
    </div>
  );
}
