import '../../src/index.css';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import VoiceSearchButton from '../../src/components/search/VoiceSearchButton';
import ImageSearchModal from '../../src/components/search/ImageSearchModal';
import { searchIntentPath } from '../../src/utils/aiSearchIntent';
function Harness() {
  const [result, setResult] = useState('');
  const [image, setImage] = useState(false);
  return <BrowserRouter><VoiceSearchButton onResult={(query, intent) => setResult(searchIntentPath(query, intent))} /><button onClick={() => setImage(true)}>Ouvrir photo</button><ImageSearchModal open={image} onClose={() => setImage(false)} /><output aria-label="Recherche finale">{result}</output></BrowserRouter>;
}
createRoot(document.getElementById('root')).render(<Harness />);
