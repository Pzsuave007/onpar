import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, API } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Camera, ImagePlus, Send, Loader2, X } from 'lucide-react';

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function FeedPhoto({ photo }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [loadingImg, setLoadingImg] = useState(true);

  useEffect(() => {
    // If photo has a url_path (local storage), use it directly
    if (photo.url_path) {
      setImgSrc(photo.url_path);
      setLoadingImg(false);
      return;
    }
    // Fallback: load via API
    let cancelled = false;
    axios.get(`${API}/feed/photo/${photo.photo_id}`, { responseType: 'blob' })
      .then(res => {
        if (!cancelled) {
          setImgSrc(URL.createObjectURL(res.data));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingImg(false); });
    return () => { cancelled = true; };
  }, [photo.photo_id, photo.url_path]);

  useEffect(() => {
    return () => { if (imgSrc) URL.revokeObjectURL(imgSrc); };
  }, [imgSrc]);

  const initials = (photo.player_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-xl border border-[#E2E3DD] overflow-hidden" data-testid={`feed-photo-${photo.photo_id}`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3">
        {photo.picture ? (
          <img src={photo.picture} alt="" className="w-8 h-8 rounded-full object-cover border border-[#E2E3DD]" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#1B3C35] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1B3C35] truncate">{photo.player_name}</p>
          <p className="text-[10px] text-[#6B6E66]">{timeAgo(photo.created_at)}</p>
        </div>
      </div>
      {/* Photo */}
      <div className="relative bg-[#E8E9E3] min-h-[200px]">
        {loadingImg ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-[#6B6E66] animate-spin" />
          </div>
        ) : imgSrc ? (
          <img src={imgSrc} alt={photo.caption || 'Golf photo'} className="w-full object-contain max-h-[500px]" />
        ) : (
          <div className="flex items-center justify-center h-[200px] text-[#6B6E66] text-sm">
            Failed to load photo
          </div>
        )}
      </div>
      {/* Caption */}
      {photo.caption && (
        <div className="px-3 py-2">
          <p className="text-sm text-[#1B3C35]">
            <span className="font-semibold">{photo.player_name.split(' ')[0]}</span>{' '}
            {photo.caption}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TournamentFeed({ tournamentId, canPost = false }) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const fetchFeed = useCallback(() => {
    if (!tournamentId) return;
    axios.get(`${API}/tournaments/${tournamentId}/feed`)
      .then(res => setPhotos(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tournamentId]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Auto-refresh feed every 30 seconds
  useEffect(() => {
    if (!tournamentId) return;
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, [tournamentId, fetchFeed]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Only images allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Photo too large (max 10MB)');
      return;
    }
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const cancelUpload = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!previewFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', previewFile);
      formData.append('caption', caption.trim());
      await axios.post(`${API}/tournaments/${tournamentId}/feed`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Photo posted!');
      cancelUpload();
      fetchFeed();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid="tournament-feed">
      {/* Upload section */}
      {canPost && user && (
        <div className="mb-4">
          <input type="file" accept="image/*" ref={fileInputRef}
            onChange={handleFileSelect} className="hidden" data-testid="feed-file-input" />

          {previewFile ? (
            <Card className="border-[#E2E3DD] shadow-none overflow-hidden">
              <CardContent className="p-3 space-y-3">
                <div className="relative rounded-lg overflow-hidden bg-[#E8E9E3]">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-[300px] object-contain" />
                  <button onClick={cancelUpload}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
                    data-testid="feed-cancel-upload">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input value={caption} onChange={e => setCaption(e.target.value)}
                    placeholder="Add a caption..."
                    className="flex-1 border-[#E2E3DD] text-sm"
                    maxLength={280}
                    data-testid="feed-caption-input" />
                  <Button onClick={handleUpload} disabled={uploading}
                    className="bg-[#C96A52] hover:bg-[#C96A52]/90 shrink-0"
                    data-testid="feed-upload-btn">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => fileInputRef.current?.click()}
              className="w-full bg-[#1B3C35] hover:bg-[#1B3C35]/90 h-12 text-base"
              data-testid="feed-add-photo-btn">
              <Camera className="h-5 w-5 mr-2" />
              Share a Photo
            </Button>
          )}
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="h-5 w-5 text-[#6B6E66] animate-spin mx-auto" />
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-8">
          <ImagePlus className="h-10 w-10 text-[#D6D7D2] mx-auto mb-2" />
          <p className="text-sm text-[#6B6E66]">No photos yet. Be the first to share!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {photos.map(photo => (
            <FeedPhoto key={photo.photo_id} photo={photo} />
          ))}
        </div>
      )}
    </div>
  );
}
