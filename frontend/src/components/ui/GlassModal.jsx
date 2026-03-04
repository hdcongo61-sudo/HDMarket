import React from 'react';
import BaseModal, {
  BottomSheetModal,
  ModalBody,
  ModalFooter,
  ModalHeader
} from '../modals/BaseModal';
import { resolveGlassVariantClass } from './glassVariants';

const join = (...parts) => parts.filter(Boolean).join(' ');

export default function GlassModal({
  variant = 'glass',
  panelClassName = '',
  backdropClassName = '',
  ...props
}) {
  return (
    <BaseModal
      {...props}
      backdropClassName={join('glass-modal-backdrop', backdropClassName)}
      panelClassName={join('glass-modal-panel', resolveGlassVariantClass(variant), panelClassName)}
    />
  );
}

export function GlassBottomSheetModal({
  variant = 'glass',
  panelClassName = '',
  backdropClassName = '',
  ...props
}) {
  return (
    <BottomSheetModal
      {...props}
      backdropClassName={join('glass-modal-backdrop', backdropClassName)}
      panelClassName={join('glass-modal-panel', resolveGlassVariantClass(variant), panelClassName)}
    />
  );
}

export { ModalBody as GlassModalBody, ModalFooter as GlassModalFooter, ModalHeader as GlassModalHeader };
