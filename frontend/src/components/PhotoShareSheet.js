// Multi-destination photo upload sheet. Lets the player post one photo to
// several active challenges/tournaments at once via the backend
// /api/photos/broadcast endpoint.
import { useState, useEffect, useRef } from 'react';
import { API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Camera, Send, Loader2, X, Trophy, Target } from 'lucide-react';

export default function PhotoShareSheet({ open, onOpenChange, defaultTargets, courseId = null }) {
  const [targets, setTargets] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selected, setSelected] = useState(() => new Set(defaultTargets || []));
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(defaultTargets || []));
    setLoadingTargets(true);
    axios.get(`${API}/profile/photo-targets`)
      .then(res => {
        let list = res.data || [];
        if (courseId) {
          list = list.sort((a, b) => {
            const aMatch = a.type === 'challenge' && (a.course_ids || []).includes(courseId) ? 0 : 1;
            const bMatch = b.type === 'challenge' && (b.course_ids || []).includes(courseId) ? 0 : 1;
            return aMatch - bMatch;
          });
        }
        setTargets(list);
      })
      .catch(() => toast.error('Failed to load destinations'))
      .finally(() => setLoadingTargets(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, courseId]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Only images allowed'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('Photo too large (max 10MB)'); return; }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const toggle = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null); setCaption(''); setSelected(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async () => {
    if (!file) { toast.error('Pick a photo first'); return; }
    if (selected.size === 0) { toast.error('Pick at least one destination'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('caption', caption.trim());
      fd.append('targets', Array.from(selected).join(','));
      const res = await axios.post(`${API}/photos/broadcast`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Posted to ${res.data.count} place${res.data.count > 1 ? 's' : ''}!`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="photo-share-sheet">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit' }}>Share a Photo</DialogTitle>
        </DialogHeader>

        <input type="file" accept="image/*" ref={fileInputRef}
          onChange={pickFile} className="hidden" data-testid="share-file-input" />

        {file && previewUrl ? (
          <div className="relative rounded-lg overflow-hidden bg-[#E8E9E3]">
            <img src={previewUrl} alt="Preview" className="w-full max-h-[260px] object-contain" />
            <button onClick={reset}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"
              data-testid="share-clear-file">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button onClick={() => fileInputRef.current?.click()}
            className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12" data-testid="share-pick-file">
            <Camera className="h-5 w-5 mr-2" />Pick a Photo
          </Button>
        )}

        <Input value={caption} onChange={e => setCaption(e.target.value)}
          placeholder="Add a caption..." maxLength={280}
          className="border-[#E2E3DD]" data-testid="share-caption" />

        <div className="space-y-1">
          <p className="text-xs font-bold text-[#6B6E66] uppercase tracking-wider">Post to</p>
          {loadingTargets ? (
            <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin text-[#6B6E66] mx-auto" /></div>
          ) : targets.length === 0 ? (
            <div className="py-4 text-center text-sm text-[#6B6E66]">
              You have no active challenges or tournaments yet.
            </div>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {targets.map(t => {
                const key = `${t.type}:${t.id}`;
                const checked = selected.has(key);
                return (
                  <label key={key}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-[#1B3C35] bg-[#1B3C35]/5' : 'border-[#E2E3DD] hover:bg-[#E8E9E3]/50'}`}
                    data-testid={`share-target-${t.type}-${t.id}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggle(key)} />
                    {t.type === 'challenge' ? (
                      <Target className="h-4 w-4 text-[#C96A52] shrink-0" />
                    ) : (
                      <Trophy className="h-4 w-4 text-[#1B3C35] shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1B3C35] truncate">{t.name}</p>
                      <p className="text-[10px] text-[#6B6E66] uppercase tracking-wider">{t.type}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-[#C96A52] hover:bg-[#C96A52]/90" onClick={submit}
            disabled={uploading || !file || selected.size === 0}
            data-testid="share-submit">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            {uploading ? 'Posting...' : `Post${selected.size > 1 ? ` to ${selected.size}` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
