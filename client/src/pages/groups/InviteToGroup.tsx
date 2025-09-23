import { useRoute } from 'wouter';
import { useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';

const SITE = import.meta.env.VITE_SITE_URL;

export default function InviteToGroup() {
  const [, params] = useRoute('/groups/:id/invite');
  const id = params?.id;
  const inviteUrl = useMemo(() => `${SITE}/g/${id}`, [id]);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteUrl);
  };

  return (
    <div className="mx-auto max-w-md px-4 pb-24">
      <div className="mt-6 rounded-3xl bg-card p-6 flex flex-col items-center">
        <div className="rounded-2xl bg-white p-4 shadow-md">
          <QRCodeCanvas value={inviteUrl} size={240} includeMargin level="M" />
        </div>
        <p className="mt-3 text-center text-muted-foreground break-all">{inviteUrl}</p>
        <Button className="mt-2" onClick={copyToClipboard}>
          Copy invite link
        </Button>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Scan to join the group
        </div>
      </div>
    </div>
  );
}