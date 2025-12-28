import useIsMobile from './useIsMobile';

export default function useDesktopExternalLink() {
  const isMobile = useIsMobile();
  return isMobile ? {} : { target: '_blank', rel: 'noopener noreferrer' };
}
