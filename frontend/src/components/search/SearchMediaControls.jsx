import { searchIntentPath } from '../../utils/aiSearchIntent';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraIcon } from '@heroicons/react/24/outline';
import { useAppSettings } from '../../context/AppSettingsContext';
import VoiceSearchButton from './VoiceSearchButton';
import ImageSearchModal from './ImageSearchModal';

const enabled = (value) => value === true || value === 1 || ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());

export default function SearchMediaControls() {
  const { getRuntimeValue } = useAppSettings();
  const navigate = useNavigate();
  const [imageOpen, setImageOpen] = useState(false);
  const imageEnabled = enabled(getRuntimeValue('enable_image_search', false));
  const voiceEnabled = enabled(getRuntimeValue('enable_voice_search', false));
  if (!imageEnabled && !voiceEnabled) return null;
  return (
    <div className="flex shrink-0 items-center gap-1">
      {imageEnabled ? <button type="button" aria-label="Recherche par image" title="Recherche par image" onClick={() => setImageOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-orange-50 text-[#e85d00] hover:bg-orange-100"><CameraIcon className="h-5 w-5" /></button> : null}
      {voiceEnabled ? <VoiceSearchButton className="!h-9 !w-9 rounded-full bg-orange-50" onResult={(text, intent) => navigate(searchIntentPath(text, intent))} /> : null}
      {imageEnabled ? <ImageSearchModal open={imageOpen} onClose={() => setImageOpen(false)} /> : null}
    </div>
  );
}
