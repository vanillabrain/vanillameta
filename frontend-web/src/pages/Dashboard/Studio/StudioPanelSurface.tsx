import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from '@mui/material';

/** Keep one React/DOM subtree when the surrounding desktop rail becomes a mobile modal. */
export default function StudioPanelSurface({
  compact,
  onClose,
  children,
}: {
  compact: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [target] = useState(() => document.createElement('div'));
  const attach = useCallback(
    (host: HTMLDivElement | null) => {
      if (host) host.appendChild(target);
    },
    [target],
  );
  return (
    <>
      {createPortal(children, target)}
      {compact ? (
        <Drawer className="studio-panel-drawer" anchor="right" open onClose={onClose}>
          <div className="vm-studio" ref={attach} />
        </Drawer>
      ) : (
        <div className="studio-panel-host" ref={attach} />
      )}
    </>
  );
}
