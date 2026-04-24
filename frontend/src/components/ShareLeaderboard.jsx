// Generates a 1080x1920 Instagram-Story-sized leaderboard summary image using
// html2canvas, then triggers share/download via the Web Share API.
// Dark theme — matches "golf broadcast" vibe.
import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Share2, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

function formatToPar(score) {
  if (score == null) return '–';
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

function medalFor(idx) {
  return ['🥇', '🥈', '🥉'][idx] || '';
}

/**
 * Props:
 *   tournamentName: string
 *   courseName: string
 *   leaderboard: [{ user_id, name, total_to_par, total_strokes, picture }]
 *   featuredPhotoUrl?: string
 *   scoringFormat?: 'stroke' | 'stableford' | ...
 */
export default function ShareLeaderboard({ tournamentName, courseName, leaderboard = [], featuredPhotoUrl, scoringFormat = 'stroke' }) {
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  const top3 = leaderboard.slice(0, 3);
  const isStableford = scoringFormat === 'stableford';

  const generate = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      // Render at 2x for sharp image on high-DPI screens
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#1B3C35',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
      const filename = `leaderboard-${(tournamentName || 'onpar').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      // Prefer native share on mobile
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: tournamentName, text: `${tournamentName} — OnPar Live` });
        toast.success('Shared!');
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        toast.success('Image downloaded');
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not generate image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="border-[#C96A52] text-[#C96A52] hover:bg-[#C96A52]/10"
        onClick={generate}
        disabled={busy || top3.length === 0}
        data-testid="share-leaderboard-btn">
        {busy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Generating…</> :
          <><Share2 className="h-4 w-4 mr-1" />Share Leaderboard</>}
      </Button>

      {/* Hidden render target — positioned off-screen so html2canvas can grab it */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }} aria-hidden="true">
        <div
          ref={cardRef}
          style={{
            width: '1080px',
            height: '1920px',
            background: 'linear-gradient(180deg, #1B3C35 0%, #0F2924 100%)',
            color: 'white',
            padding: '80px 70px',
            fontFamily: 'Outfit, Inter, sans-serif',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '28px', letterSpacing: '8px', color: '#C96A52', fontWeight: 700 }}>
              ONPAR LIVE
            </div>
            <div style={{ fontSize: '72px', fontWeight: 800, marginTop: '14px', lineHeight: 1.05 }}>
              {tournamentName || 'Tournament'}
            </div>
            <div style={{ fontSize: '34px', color: '#D1D4CC', marginTop: '12px' }}>
              {courseName}
            </div>
          </div>

          {/* Featured photo (optional) */}
          {featuredPhotoUrl && (
            <div style={{
              borderRadius: '28px',
              overflow: 'hidden',
              marginBottom: '40px',
              border: '3px solid #C96A52',
              height: '480px',
              display: 'flex',
            }}>
              <img
                src={featuredPhotoUrl}
                alt=""
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          {/* Podium */}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '28px',
            padding: '40px 40px 20px',
            flex: 1,
          }}>
            <div style={{ fontSize: '22px', letterSpacing: '6px', color: '#C96A52', fontWeight: 700, marginBottom: '28px' }}>
              FINAL STANDINGS
            </div>
            {top3.map((p, i) => (
              <div key={p.user_id || i} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '24px 0',
                borderBottom: i < top3.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
              }}>
                <div style={{ fontSize: '72px', width: '100px', textAlign: 'center' }}>{medalFor(i)}</div>
                <div style={{ flex: 1, marginLeft: '24px' }}>
                  <div style={{ fontSize: '52px', fontWeight: 700, lineHeight: 1.1 }}>{p.name}</div>
                  <div style={{ fontSize: '26px', color: '#D1D4CC', marginTop: '6px' }}>
                    {p.total_strokes ? `${p.total_strokes} strokes` : ''}
                  </div>
                </div>
                <div style={{ fontSize: '68px', fontWeight: 800, color: '#C96A52', fontVariantNumeric: 'tabular-nums' }}>
                  {isStableford ? (p.stableford_points ?? '–') : formatToPar(p.total_to_par)}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '32px', opacity: 0.7 }}>
            <div style={{ fontSize: '22px', letterSpacing: '4px' }}>onparlive.com</div>
          </div>
        </div>
      </div>
    </>
  );
}
