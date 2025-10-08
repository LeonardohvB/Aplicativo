import React, { createContext, useCallback, useContext, useState } from 'react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

type ConfirmOpts = {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'danger';
  loading?: boolean;
};

type Ctx = { confirm: (opts: ConfirmOpts) => Promise<boolean> };
const ConfirmCtx = createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<(ConfirmOpts & { open: boolean }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      const close = (ok: boolean) => { setOpts(null); resolve(ok); };
      setOpts({
        ...o,
        open: true,
        // handlers “pontes” são passados ao componente
        onClose: () => close(false),
        onConfirm: () => close(true),
      } as any);
    });
  }, []);

  return (
    <ConfirmCtx.Provider value={{ confirm }}>
      {children}
      {opts && (
        <ConfirmDialog
          open={opts.open}
          onClose={(opts as any).onClose}
          onConfirm={(opts as any).onConfirm}
          title={opts.title}
          description={opts.description}
          confirmText={opts.confirmText}
          cancelText={opts.cancelText}
          icon={opts.icon}
          variant={opts.variant}
          loading={opts.loading}
        />
      )}
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider />');
  return ctx.confirm;
};
