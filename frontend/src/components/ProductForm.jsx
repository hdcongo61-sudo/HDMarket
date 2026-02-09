import React, { useContext, useEffect, useState, useRef, useCallback } from 'react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { Upload, Camera, DollarSign, Tag, FileText, Package, Send, AlertCircle, CheckCircle2, Video, Trash2, Crop, Eye, X, Maximize2, Minimize2, ChevronDown, ChevronUp, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, ZoomIn, ZoomOut } from 'lucide-react';
import categoryGroups from '../data/categories';
import ProductCard from './ProductCard';
import useIsMobile from '../hooks/useIsMobile';

const MAX_IMAGES = 3;
const MAX_VIDEO_SIZE_MB = 20;
const MAX_PDF_SIZE_MB = 10;
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
  const { onCreated, onUpdated, initialValues, productId, submitLabel } = props;
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'used',
    operator: 'MTN',
    discount: ''
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [removedImages, setRemovedImages] = useState([]);
  const [imageError, setImageError] = useState('');
  const { user } = useContext(AuthContext);
  const canUploadVideo = Boolean(user?.shopVerified && user?.accountType === 'shop');
  const canUploadPdf = user?.accountType === 'shop';
  const [videoFile, setVideoFile] = useState(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState(null);
  const [removeExistingVideo, setRemoveExistingVideo] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfError, setPdfError] = useState('');
  const [existingPdf, setExistingPdf] = useState(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
  const [cropAspect, setCropAspect] = useState(null); // null = free, '1:1', '4:3', '16:9'
  const [isResizingCrop, setIsResizingCrop] = useState(null); // null | 'se' | 'sw' | 'ne' | 'nw'
  const cropCanvasRef = useRef(null);
  const cropContainerRef = useRef(null);
  const imageRef = useRef(null);
  const cropMoveRef = useRef(() => {});
  const cropUpRef = useRef(() => {});

  const CROP_MIN_ZOOM = 0.3;
  const CROP_MAX_ZOOM = 3;
  const ASPECT_PRESETS = { '1:1': 1, '4:3': 4/3, '16:9': 16/9 };
  const [showPreview, setShowPreview] = useState(false);
  const isMobile = useIsMobile(768);
  const [expandedSections, setExpandedSections] = useState({
    info: true,
    images: true,
    media: true,
    validation: true,
    preview: false
  });
  const toggleSection = (key) => setExpandedSections((s) => ({ ...s, [key]: !s[key] }));

  const readFileAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImageChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;
    const maxSelectable = Math.max(0, MAX_IMAGES - existingImages.length - files.length);
    if (maxSelectable === 0) {
      setImageError(`Maximum ${MAX_IMAGES} photos au total. Supprimez une image pour en ajouter.`);
      e.target.value = '';
      return;
    }
    const limitedFiles = selectedFiles.slice(0, maxSelectable);
    if (selectedFiles.length > maxSelectable) {
      setImageError(`Maximum ${MAX_IMAGES} photos au total. Seules les premières ont été conservées.`);
    } else {
      setImageError('');
    }

    // Add all selected photos and create previews for each (no crop modal yet)
    const newItems = limitedFiles.map((f) => ({ file: f, cropped: false, leftAsIs: false }));
    const previewUrls = await Promise.all(limitedFiles.map(readFileAsDataURL));
    const newPreviews = limitedFiles.map((file, i) => ({
      url: previewUrls[i],
      name: file.name
    }));

    setFiles((prev) => [...prev, ...newItems]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  const initializeCropArea = (imageUrl) => {
    setCropAspect(null);
    const img = new Image();
    img.onload = () => {
      const container = cropContainerRef.current;
      if (!container) return;
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;
      
      let displayWidth, displayHeight;
      if (imgAspect > containerAspect) {
        displayWidth = containerWidth;
        displayHeight = containerWidth / imgAspect;
      } else {
        displayHeight = containerHeight;
        displayWidth = containerHeight * imgAspect;
      }
      
      setImageScale(displayWidth / img.width);
      setImagePosition({
        x: (containerWidth - displayWidth) / 2,
        y: (containerHeight - displayHeight) / 2
      });
      
      // Initialize crop area (square, centered)
      const cropSize = Math.min(displayWidth, displayHeight) * 0.8;
      setCropData({
        x: (containerWidth - cropSize) / 2,
        y: (containerHeight - cropSize) / 2,
        width: cropSize,
        height: cropSize
      });
    };
    img.src = imageUrl;
  };

  const getCropPointerOffset = (clientX, clientY) => {
    const rect = cropContainerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clientX - rect.left - cropData.x,
      y: clientY - rect.top - cropData.y
    };
  };

  const isPointInCropBox = (px, py) => {
    return px >= cropData.x && px <= cropData.x + cropData.width &&
           py >= cropData.y && py <= cropData.y + cropData.height;
  };

  const getCropInteraction = (clientX, clientY) => {
    const rect = cropContainerRef.current?.getBoundingClientRect();
    if (!rect) return 'pan';
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const HANDLE = 28;
    const { x, y, width, height } = cropData;
    if (px >= x + width - HANDLE && py >= y + height - HANDLE && px <= x + width && py <= y + height) return 'resize-se';
    if (px <= x + HANDLE && py <= y + HANDLE && px >= x && py >= y) return 'resize-nw';
    if (px >= x + width - HANDLE && py <= y + HANDLE && py >= y) return 'resize-ne';
    if (px <= x + HANDLE && py >= y + height - HANDLE && py <= y + height) return 'resize-sw';
    if (isPointInCropBox(px, py)) return 'crop';
    return 'pan';
  };

  const handleCropMouseDown = (e) => {
    if (!croppingImage || !cropContainerRef.current) return;
    const rect = cropContainerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const action = getCropInteraction(e.clientX, e.clientY);
    if (action === 'resize-se' || action === 'resize-nw' || action === 'resize-ne' || action === 'resize-sw') {
      e.stopPropagation();
      setIsResizingCrop(action.replace('resize-', ''));
      setDragStart({ x: px, y: py });
    } else if (action === 'crop') {
      setIsDragging(true);
      setDragStart(getCropPointerOffset(e.clientX, e.clientY));
    } else {
      setIsPanning(true);
      setPanStart({ startX: e.clientX, startY: e.clientY, startPos: { ...imagePosition } });
    }
  };

  const handleCropTouchStart = (e) => {
    if (!croppingImage || !e.touches[0] || !cropContainerRef.current) return;
    const t = e.touches[0];
    const action = getCropInteraction(t.clientX, t.clientY);
    const rect = cropContainerRef.current.getBoundingClientRect();
    const px = t.clientX - rect.left;
    const py = t.clientY - rect.top;
    if (action.startsWith('resize-')) {
      setIsResizingCrop(action.replace('resize-', ''));
      setDragStart({ x: px, y: py });
    } else if (action === 'crop') {
      setIsDragging(true);
      setDragStart(getCropPointerOffset(t.clientX, t.clientY));
    } else {
      setIsPanning(true);
      setPanStart({ startX: t.clientX, startY: t.clientY, startPos: { ...imagePosition } });
    }
  };

  const handleCropMouseMove = (e) => {
    if (!croppingImage || !cropContainerRef.current) return;
    const rect = cropContainerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (isPanning) {
      setImagePosition({
        x: panStart.startPos.x + (e.clientX - panStart.startX),
        y: panStart.startPos.y + (e.clientY - panStart.startY)
      });
      return;
    }
    if (isResizingCrop) {
      applyCropResize(px, py, rect);
      return;
    }
    if (!isDragging) return;
    const newX = e.clientX - rect.left - dragStart.x;
    const newY = e.clientY - rect.top - dragStart.y;
    const maxX = rect.width - cropData.width;
    const maxY = rect.height - cropData.height;
    setCropData({
      ...cropData,
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY))
    });
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
    setIsResizingCrop(null);
  };
  const handleCropTouchEnd = () => {
    setIsDragging(false);
    setIsPanning(false);
    setIsResizingCrop(null);
  };

  const handleCropTouchMove = (e) => {
    if (!croppingImage || !cropContainerRef.current || !e.touches[0]) return;
    const t = e.touches[0];
    const rect = cropContainerRef.current.getBoundingClientRect();
    const px = t.clientX - rect.left;
    const py = t.clientY - rect.top;

    if (isPanning) {
      setImagePosition({
        x: panStart.startPos.x + (t.clientX - panStart.startX),
        y: panStart.startPos.y + (t.clientY - panStart.startY)
      });
      return;
    }
    if (isResizingCrop) {
      applyCropResize(px, py, rect);
      return;
    }
    if (!isDragging) return;
    const newX = t.clientX - rect.left - dragStart.x;
    const newY = t.clientY - rect.top - dragStart.y;
    const maxX = rect.width - cropData.width;
    const maxY = rect.height - cropData.height;
    setCropData({
      ...cropData,
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY))
    });
  };

  const MIN_CROP_SIZE = 80;

  const applyCropResize = (px, py, rect) => {
    let { x, y, width, height } = cropData;
    const aspect = cropAspect ? ASPECT_PRESETS[cropAspect] : null;

    const applyAspect = (w, h) => {
      if (!aspect) return { w, h };
      if (aspect >= 1) return { w, h: w / aspect };
      return { w: h * aspect, h };
    };

    if (isResizingCrop === 'se') {
      let w = Math.max(MIN_CROP_SIZE, px - x);
      let h = Math.max(MIN_CROP_SIZE, py - y);
      ({ w, h } = applyAspect(w, h));
      w = Math.min(w, rect.width - x);
      h = Math.min(h, rect.height - y);
      if (aspect) ({ w, h } = applyAspect(w, h));
      setCropData({ x, y, width: w, height: h });
    } else if (isResizingCrop === 'sw') {
      let w = Math.max(MIN_CROP_SIZE, x + width - px);
      let h = Math.max(MIN_CROP_SIZE, py - y);
      ({ w, h } = applyAspect(w, h));
      const newX = x + width - w;
      if (newX < 0) { w = x + width; h = aspect ? w / aspect : h; }
      setCropData({ x: Math.max(0, newX), y, width: w, height: Math.min(h, rect.height - y) });
    } else if (isResizingCrop === 'ne') {
      let w = Math.max(MIN_CROP_SIZE, px - x);
      let h = Math.max(MIN_CROP_SIZE, y + height - py);
      ({ w, h } = applyAspect(w, h));
      const newY = y + height - h;
      setCropData({ x, y: Math.max(0, newY), width: w, height: h });
    } else if (isResizingCrop === 'nw') {
      let w = Math.max(MIN_CROP_SIZE, x + width - px);
      let h = Math.max(MIN_CROP_SIZE, y + height - py);
      ({ w, h } = applyAspect(w, h));
      const newX = x + width - w;
      const newY = y + height - h;
      setCropData({ x: Math.max(0, newX), y: Math.max(0, newY), width: w, height: h });
    }
  };

  const applyCropAspectPreset = (preset) => {
    const container = cropContainerRef.current;
    if (!container) return;
    const rect = { width: container.clientWidth, height: container.clientHeight };
    setCropAspect(preset);
    if (!preset) return;
    const ratio = ASPECT_PRESETS[preset];
    const centerX = cropData.x + cropData.width / 2;
    const centerY = cropData.y + cropData.height / 2;
    let w = cropData.width;
    let h = cropData.height;
    if (ratio >= 1) {
      h = w / ratio;
      if (h > rect.height) { h = rect.height; w = h * ratio; }
    } else {
      w = h * ratio;
      if (w > rect.width) { w = rect.width; h = w / ratio; }
    }
    w = Math.min(w, rect.width);
    h = Math.min(h, rect.height);
    const x = Math.max(0, Math.min(centerX - w / 2, rect.width - w));
    const y = Math.max(0, Math.min(centerY - h / 2, rect.height - h));
    setCropData({ x, y, width: w, height: h });
  };

  const cropImage = useCallback(() => {
    if (!croppingImage || !imageRef.current) return null;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    // Calculate actual crop coordinates on original image
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    
    const cropX = (cropData.x - imagePosition.x) * scaleX;
    const cropY = (cropData.y - imagePosition.y) * scaleY;
    const cropWidth = cropData.width * scaleX;
    const cropHeight = cropData.height * scaleY;
    
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    ctx.drawImage(
      img,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const file = new File([blob], croppingImage.file.name, {
          type: croppingImage.file.type,
          lastModified: Date.now()
        });
        resolve(file);
      }, croppingImage.file.type, 0.95);
    });
  }, [croppingImage, cropData, imagePosition]);

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
    setTimeout(() => initializeCropArea(url), 50);
  }, [croppingImage]);

  const handleRotateLeft = () => applyImageTransform(-90, false, false);
  const handleRotateRight = () => applyImageTransform(90, false, false);
  const handleFlipH = () => applyImageTransform(0, true, false);
  const handleFlipV = () => applyImageTransform(0, false, true);

  const handleZoomChange = (delta) => {
    setImageScale((s) => Math.max(CROP_MIN_ZOOM, Math.min(CROP_MAX_ZOOM, s + delta)));
  };
  const handleZoomInput = (e) => {
    const v = parseFloat(e.target.value);
    if (!Number.isNaN(v)) setImageScale(Math.max(CROP_MIN_ZOOM, Math.min(CROP_MAX_ZOOM, v)));
  };

  const editImageCrop = (index) => {
    const fileItem = files[index];
    const preview = imagePreviews[index];
    if (!fileItem || !preview?.url) return;
    const file = fileItem?.file || fileItem;
    if (!(file instanceof File)) return;
    setCroppingImage({ file, url: preview.url, index });
    setTimeout(() => initializeCropArea(preview.url), 100);
  };

  const handleLeaveAsIs = (index) => {
    setFiles((prev) => {
      const updated = [...prev];
      if (updated[index]) updated[index] = { ...updated[index], leftAsIs: true };
      return updated;
    });
  };

  const removeImage = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setFiles(newFiles);
    setImagePreviews(newPreviews);
    if (newFiles.length < MAX_IMAGES) setImageError('');
  };

  const removeExistingImage = (index) => {
    const target = existingImages[index];
    if (!target) return;
    setExistingImages(existingImages.filter((_, i) => i !== index));
    setRemovedImages((prev) => [...prev, target]);
    if (existingImages.length - 1 + files.length < MAX_IMAGES) setImageError('');
  };

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
    
    // If file is larger than 20MB, compress it
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setIsCompressingVideo(true);
      setCompressionProgress(0);
      
      try {
        const videoElement = document.createElement('video');
        videoElement.preload = 'auto';
        // Must NOT mute: Chrome's MediaRecorder gives 0 bytes when capturing muted video.
        // File selection is a user gesture, so play() works without muted.
        videoElement.muted = false;
        videoElement.volume = 0; // Silence during compression; does not affect captured stream
        videoElement.playsInline = true;
        videoElement.crossOrigin = 'anonymous';
        
        const videoUrl = URL.createObjectURL(file);
        videoElement.src = videoUrl;
        
        // Wait for metadata and canplay
        await new Promise((resolve, reject) => {
          videoElement.onloadedmetadata = () => {
            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
              reject(new Error('Impossible de lire les dimensions de la vidéo'));
            } else {
              resolve();
            }
          };
          videoElement.onerror = () => reject(new Error('Erreur lors du chargement de la vidéo'));
        });
        
        await new Promise((resolve, reject) => {
          videoElement.oncanplay = () => resolve();
          videoElement.onerror = () => reject(new Error('Erreur lors du chargement de la vidéo'));
        });
        
        const duration = videoElement.duration;
        const targetSizeBytes = MAX_VIDEO_SIZE_MB * 1024 * 1024 * 0.95;
        const totalBitsPerSecond = (targetSizeBytes * 8) / duration;
        const videoBitrate = Math.max(500000, Math.floor(totalBitsPerSecond * 0.9)); // 90% for video
        const audioBitrate = Math.min(128000, Math.floor(totalBitsPerSecond * 0.1)); // 10% for audio, max 128kbps
        
        let mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm;codecs=vp8,opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = 'video/mp4';
            }
          }
        }
        
        const chunks = [];
        let stream;
        
        if (typeof videoElement.captureStream === 'function') {
          // Preferred: captureStream includes video + audio at correct speed (Chrome, Firefox, Edge)
          stream = videoElement.captureStream();
        } else {
          // Fallback for Safari: canvas gives video only, no audio (captureStream not supported)
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          stream = canvas.captureStream(30);
          videoElement.onplaying = () => {
            const drawFrame = () => {
              if (videoElement.ended || videoElement.paused) return;
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
              requestAnimationFrame(drawFrame);
            };
            drawFrame();
          };
        }
        
        const mediaRecorderOptions = {
          mimeType,
          videoBitsPerSecond: videoBitrate
        };
        if (mimeType.includes('webm') && stream.getAudioTracks && stream.getAudioTracks().length > 0) {
          mediaRecorderOptions.audioBitsPerSecond = audioBitrate;
        }
        
        const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          setCompressionProgress(100);
          setTimeout(() => {
            const blob = new Blob(chunks, { type: mimeType });
            const fileExtension = mimeType.includes('webm') ? 'webm' : 'mp4';
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.' + fileExtension, {
              type: blob.type,
              lastModified: Date.now()
            });
            
            setVideoFile(compressedFile);
            setIsCompressingVideo(false);
            setCompressionProgress(0);
            URL.revokeObjectURL(videoUrl);
            e.target.value = '';
          }, 300);
        };
        
        mediaRecorder.onerror = (error) => {
          console.error('Compression error:', error);
          setVideoError('Erreur lors de la compression. Veuillez essayer avec une autre vidéo.');
          setIsCompressingVideo(false);
          setCompressionProgress(0);
          URL.revokeObjectURL(videoUrl);
          e.target.value = '';
        };
        
        // Update progress while video plays
        const progressInterval = setInterval(() => {
          if (videoElement.ended || videoElement.paused) return;
          const timeProgress = Math.min(98, (videoElement.currentTime / duration) * 100);
          setCompressionProgress(timeProgress);
        }, 200);
        
        videoElement.onended = () => {
          clearInterval(progressInterval);
          setCompressionProgress(98);
          setTimeout(() => mediaRecorder.stop(), 150);
        };
        
        mediaRecorder.start(100);
        videoElement.currentTime = 0;
        await videoElement.play();
        
      } catch (error) {
        console.error('Video compression error:', error);
        setVideoError('Erreur lors de la compression. Le fichier est peut-être trop volumineux ou corrompu. Veuillez essayer avec une vidéo plus courte.');
        setIsCompressingVideo(false);
        setCompressionProgress(0);
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

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (videoFile) {
      setIsUploadingVideo(true);
      setUploadProgress(0);
    }
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'discount' && (v === '' || v === null || v === undefined)) return;
        data.append(k, v);
      });
      files.slice(0, MAX_IMAGES).forEach((item) => {
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
      const url = `/products${productId ? `/${productId}` : ''}`;
      const method = productId ? 'put' : 'post';
      const res = await api[method](url, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
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
      }
      
      // Réinitialiser le formulaire
      setForm({
        title: '',
        description: '',
        price: '',
        category: '',
        condition: 'used',
        operator: 'MTN',
        discount: ''
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
      
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
      setIsUploadingVideo(false);
      setUploadProgress(0);
    }
  };

  const calculateCommission = () => {
    const price = parseFloat(form.price) || 0;
    return Math.round(price * 0.03);
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
      return;
    }
    setForm({
      title: initialValues.title || '',
      description: initialValues.description || '',
      price: initialValues.price || '',
      category: initialValues.category || '',
      condition: initialValues.condition || 'new',
      operator: initialValues.operator || 'MTN',
      discount:
        typeof initialValues.discount === 'number' || typeof initialValues.discount === 'string'
          ? initialValues.discount
          : ''
    });
    setExistingImages(Array.isArray(initialValues.images) ? initialValues.images : []);
    setExistingPdf(initialValues.pdf || null);
    setRemovePdf(false);
    setRemovedImages([]);
  }, [initialValues]);

  const isEditing = Boolean(productId);
  const headerTitle = isEditing ? 'Modifier une annonce' : 'Publier une annonce';
  const headerSubtitle = isEditing
    ? 'Mettez à jour les informations de votre produit'
    : 'Remplissez les détails de votre produit pour commencer à vendre';
  const buttonLabel =
    submitLabel || (isEditing ? 'Mettre à jour l’annonce' : 'Publier l’annonce');
  const priceGridClass = isEditing ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2';

  return (
    <div className={`max-w-2xl mx-auto ${isMobile ? 'px-0 pb-28 bg-[#f2f2f7] min-h-screen' : ''}`}>
      {/* En-tête du formulaire — Apple-style on mobile */}
      <div className={isMobile ? 'text-left px-4 pt-2 pb-4 bg-[#f2f2f7]' : 'text-center mb-8'}>
        {!isMobile && (
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
        )}
        <div className={isMobile ? 'flex items-center gap-3' : ''}>
          {isMobile && (
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-200/80">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className={`font-bold text-gray-900 ${isMobile ? 'text-[22px] leading-tight' : 'text-2xl mb-2'}`}>{headerTitle}</h1>
            <p className={`text-gray-500 ${isMobile ? 'text-[13px] mt-0.5' : 'text-sm'}`}>{headerSubtitle}</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className={`space-y-6 bg-white rounded-2xl border border-gray-100 ${isMobile ? 'p-4 pb-6 shadow-sm rounded-2xl mx-4 border-0' : 'p-6 shadow-sm'}`}>
        {/* Section Informations de base */}
        <div className="space-y-4">
          {isMobile ? (
              <button
                type="button"
                onClick={() => toggleSection('info')}
                className="flex items-center justify-between w-full py-3.5 px-0 text-left rounded-xl -mx-2 px-2 -mt-1 active:bg-gray-100/80 touch-manipulation min-h-[48px] transition-colors"
                aria-expanded={expandedSections.info}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h2 className="text-[17px] font-semibold text-gray-900">Informations du produit</h2>
                </div>
                <span className="min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 text-gray-400">
                  {expandedSections.info ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </button>
            ) : (
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-gray-900">Informations du produit</h2>
              </div>
            )}
          {(!isMobile || expandedSections.info) && (
                <div className="space-y-4 pt-1">
          {/* Titre */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Titre de l'annonce *</span>
            </label>
            <input
              className="w-full px-4 py-3.5 min-h-[48px] text-base bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
              placeholder="Ex: iPhone 13 Pro Max 256GB - État neuf"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Description détaillée *</span>
            </label>
            <textarea
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400 resize-none"
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
                <Tag className="w-4 h-4 text-indigo-500" />
                <span>Catégorie *</span>
              </label>
              <select
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                <DollarSign className="w-4 h-4 text-indigo-500" />
                <span>Prix (FCFA) *</span>
              </label>
              <input
                type="number"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
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
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all placeholder-gray-400"
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
                        ? 'border-indigo-500 bg-indigo-500' 
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
                        ? 'border-indigo-500 bg-indigo-500' 
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
                </div>
          )}
        </div>

        {/* Section Images */}
        <div className="space-y-4">
          {isMobile ? (
            <button
              type="button"
              onClick={() => toggleSection('images')}
              className="flex items-center justify-between w-full py-3.5 px-0 text-left rounded-xl -mx-2 px-2 -mt-1 active:bg-gray-100/80 touch-manipulation min-h-[48px] transition-colors"
              aria-expanded={expandedSections.images}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-[17px] font-semibold text-gray-900">Photos du produit</h2>
              </div>
              <span className="min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 text-gray-400">
                {expandedSections.images ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </span>
            </button>
          ) : (
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Photos du produit</h2>
            </div>
          )}

          {/* Image upload content - shown on desktop always, on mobile when expanded */}
          {(!isMobile || expandedSections.images) && (
            <div className="space-y-3 pt-1">
              {/* Upload d'images */}
              <div className="space-y-3">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Camera className="w-4 h-4 text-blue-500" />
                  <span>
                    Photos{' '}
                    {(existingImages.length + files.length) > 0 &&
                      `(${existingImages.length + files.length})`}
                  </span>
                </label>
                <p className="text-xs text-gray-500">Jusqu&apos;à {MAX_IMAGES} photos (PNG ou JPG, 10&nbsp;MB max chacun).</p>

                {existingImages.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Images actuelles</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {existingImages.map((src, index) => (
                        <div key={`${src}-${index}`} className="relative group">
                          <img
                            src={src}
                            alt={`Image existante ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeExistingImage(index)}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                            aria-label="Supprimer l'image"
                          >
                            <DeleteIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <label className={`flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 active:bg-gray-100 transition-colors group ${isMobile ? 'h-28 min-h-[120px] py-4' : 'h-32'}`}>
                  <Upload className={`text-gray-400 group-hover:text-indigo-500 transition-colors mb-2 ${isMobile ? 'w-10 h-10' : 'w-8 h-8'}`} />
                  <span className={`text-gray-500 text-center ${isMobile ? 'text-sm' : 'text-sm'}`}>
                    <span className="text-indigo-600 font-medium">{isMobile ? 'Appuyez pour ajouter des photos' : 'Cliquez pour uploader'}</span>
                    <br />
                    <span className="text-xs">PNG, JPG jusqu'à 10MB</span>
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
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
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
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-2 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Vidéo de présentation</h2>
            </div>
            <p className="text-sm text-gray-500">
              Ajoutez une courte vidéo (MP4, MOV, WEBM) pour montrer le produit. Taille maximale {MAX_VIDEO_SIZE_MB} Mo.
            </p>
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
              <div className="space-y-3 p-4 rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Compression de la vidéo en cours...</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Réduction de la taille tout en conservant la résolution originale
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-bold text-blue-700">{Math.round(compressionProgress)}%</span>
                    <span className="text-[10px] text-blue-500 font-medium">Progression</span>
                  </div>
                </div>
                
                {/* Main Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full rounded-full bg-gray-200 h-3 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 transition-all duration-300 ease-out shadow-lg relative"
                      style={{ width: `${compressionProgress}%` }}
                    >
                      {/* Subtle animated shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                    </div>
                  </div>
                  
                  {/* Progress indicators */}
                  <div className="flex items-center justify-between text-[10px] text-gray-600">
                    <span>0%</span>
                    <span className="font-semibold text-blue-600">En cours...</span>
                    <span>100%</span>
                  </div>
                </div>
                
                {/* Additional info */}
                <div className="flex items-center gap-2 pt-2 border-t border-blue-200">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold text-blue-700">Taille originale:</span>{' '}
                      {(originalVideoSize / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="w-px h-4 bg-blue-200"></div>
                  <div className="flex-1 text-right">
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold text-blue-700">Cible:</span>{' '}
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
                      Vidéo compressée avec succès. Résolution originale conservée.
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
                    className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">Vidéo réservée aux boutiques certifiées</p>
            <p>
              Contactez un administrateur via{' '}
              <a href="/help" className="font-semibold text-indigo-600 hover:underline">
                le centre d’aide
              </a>{' '}
              pour valider votre boutique.
            </p>
          </div>
        )}

        {canUploadPdf && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-2 h-6 bg-gradient-to-b from-slate-500 to-gray-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Fiche produit (PDF)</h2>
            </div>
            <p className="text-sm text-gray-500">
              Ajoutez un document PDF pour détailler votre produit. Taille maximale {MAX_PDF_SIZE_MB} Mo.
            </p>
            {existingPdf && !pdfFile && !removePdf && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <div>
                  <span className="font-medium">PDF actuel :</span>{' '}
                  <a
                    href={existingPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-indigo-600 hover:underline"
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
                <span>Le PDF sera supprimé lors de l’enregistrement.</span>
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
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-2 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Validation de l'annonce</h2>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-amber-800 text-sm">Commission de publication</h3>
                  <p className="text-amber-700 text-sm">
                    Pour valider votre annonce, envoyez <span className="font-bold">{calculateCommission().toLocaleString()} FCFA</span> (3% du prix).
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-amber-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Votre annonce sera approuvée sous 24h après paiement</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Section */}
        {(form.title || imagePreviews.length > 0 || existingImages.length > 0) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-gray-900">Aperçu</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
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
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
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
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bouton de soumission — sticky sur mobile (Apple-style primary) */}
        {isMobile ? (
          <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-[#f2f2f7]/95 backdrop-blur-xl border-t border-gray-200/50 safe-area-pb">
            <button
              type="submit"
              disabled={loading || !form.title || !form.description || !form.price || !form.category}
              className="w-full min-h-[52px] py-4 bg-blue-500 text-white text-[17px] font-semibold rounded-xl active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm touch-manipulation transition-opacity"
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
            disabled={loading || !form.title || !form.description || !form.price || !form.category}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2 shadow-lg"
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

      {/* Image Crop Modal — full-screen on mobile */}
      {croppingImage && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm ${isMobile ? 'p-0' : 'p-4'}`}>
          <div className={`bg-white shadow-2xl overflow-hidden flex flex-col ${isMobile ? 'w-full h-full max-h-none rounded-none' : 'rounded-2xl max-w-4xl w-full max-h-[90vh]'}`}>
            <div className={`flex items-center justify-between border-b border-gray-200 flex-shrink-0 ${isMobile ? 'p-4 min-h-[56px] safe-area-top' : 'p-4'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Crop className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Recadrer l'image</h3>
                  <p className="text-xs text-gray-500">Glissez la fenêtre pour la déplacer · Zone sombre pour déplacer l'image · Coins pour redimensionner</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCropCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Toolbar: rotate, flip, aspect, zoom */}
            <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-3 py-3 space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={handleRotateLeft} className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation" aria-label="Tourner à gauche">
                  <RotateCcw className="w-5 h-5 text-gray-700" />
                </button>
                <button type="button" onClick={handleRotateRight} className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation" aria-label="Tourner à droite">
                  <RotateCw className="w-5 h-5 text-gray-700" />
                </button>
                <button type="button" onClick={handleFlipH} className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation" aria-label="Retourner horizontalement">
                  <FlipHorizontal className="w-5 h-5 text-gray-700" />
                </button>
                <button type="button" onClick={handleFlipV} className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation" aria-label="Retourner verticalement">
                  <FlipVertical className="w-5 h-5 text-gray-700" />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs font-medium text-gray-500 mr-1">Format:</span>
                {[null, '1:1', '4:3', '16:9'].map((preset) => (
                  <button
                    key={preset || 'free'}
                    type="button"
                    onClick={() => applyCropAspectPreset(preset)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation ${cropAspect === preset ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                  >
                    {preset === null ? 'Libre' : preset}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleZoomChange(-0.2)} className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 active:bg-gray-200 touch-manipulation" aria-label="Zoom arrière">
                  <ZoomOut className="w-5 h-5 text-gray-700" />
                </button>
                <input
                  type="range"
                  min={CROP_MIN_ZOOM}
                  max={CROP_MAX_ZOOM}
                  step={0.1}
                  value={imageScale}
                  onChange={handleZoomInput}
                  className="flex-1 h-2 rounded-full appearance-none bg-gray-200 accent-indigo-600"
                />
                <button type="button" onClick={() => handleZoomChange(0.2)} className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 active:bg-gray-200 touch-manipulation" aria-label="Zoom avant">
                  <ZoomIn className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>
            
            <div className={`flex-1 overflow-auto ${isMobile ? 'p-2 flex items-center justify-center min-h-0' : 'p-4'}`}>
              <div
                ref={cropContainerRef}
                className={`relative bg-gray-100 rounded-lg overflow-hidden cursor-move touch-none select-none ${isMobile ? 'w-full max-w-full flex-1 min-h-[280px] max-h-[60vh]' : 'w-full h-96'}`}
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={handleCropMouseUp}
                onTouchStart={handleCropTouchStart}
                onTouchMove={handleCropTouchMove}
                onTouchEnd={handleCropTouchEnd}
                onTouchCancel={handleCropTouchEnd}
                style={{ touchAction: 'none' }}
              >
                <img
                  ref={imageRef}
                  src={croppingImage.url}
                  alt="Image à recadrer"
                  className="absolute"
                  style={{
                    width: `${imageRef.current?.naturalWidth * imageScale || 0}px`,
                    height: `${imageRef.current?.naturalHeight * imageScale || 0}px`,
                    left: `${imagePosition.x}px`,
                    top: `${imagePosition.y}px`,
                    pointerEvents: 'none'
                  }}
                  onLoad={(e) => {
                    const img = e.target;
                    const container = cropContainerRef.current;
                    if (!container) return;
                    
                    const containerWidth = container.clientWidth;
                    const containerHeight = container.clientHeight;
                    const imgAspect = img.naturalWidth / img.naturalHeight;
                    const containerAspect = containerWidth / containerHeight;
                    
                    let displayWidth, displayHeight;
                    if (imgAspect > containerAspect) {
                      displayWidth = containerWidth;
                      displayHeight = containerWidth / imgAspect;
                    } else {
                      displayHeight = containerHeight;
                      displayWidth = containerHeight * imgAspect;
                    }
                    
                    setImageScale(displayWidth / img.naturalWidth);
                    setImagePosition({
                      x: (containerWidth - displayWidth) / 2,
                      y: (containerHeight - displayHeight) / 2
                    });
                    
                    const cropSize = Math.min(displayWidth, displayHeight) * 0.8;
                    setCropData({
                      x: (containerWidth - cropSize) / 2,
                      y: (containerHeight - cropSize) / 2,
                      width: cropSize,
                      height: cropSize
                    });
                  }}
                />
                
                {/* Crop overlay — pointer-events-none so container gets all events */}
                <div
                  className="absolute border-2 border-white shadow-lg pointer-events-none"
                  style={{
                    left: `${cropData.x}px`,
                    top: `${cropData.y}px`,
                    width: `${cropData.width}px`,
                    height: `${cropData.height}px`,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  {/* Visual corner handles */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white border-2 border-blue-500 rounded-full pointer-events-none" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-white border-2 border-blue-500 rounded-full pointer-events-none" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-white border-2 border-blue-500 rounded-full pointer-events-none" />
                  <div className="absolute -top-1 -left-1 w-4 h-4 bg-white border-2 border-blue-500 rounded-full pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className={`flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 flex-shrink-0 ${isMobile ? 'p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] safe-area-pb' : 'p-4'}`}>
              <button
                type="button"
                onClick={handleCropCancel}
                className={`font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation ${isMobile ? 'min-h-[48px] px-5 py-3 text-base' : 'px-4 py-2 text-sm rounded-lg'}`}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                className={`font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] transition-all shadow-sm touch-manipulation ${isMobile ? 'min-h-[48px] px-5 py-3 text-base' : 'px-4 py-2 text-sm rounded-lg'}`}
              >
                Confirmer le recadrage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
