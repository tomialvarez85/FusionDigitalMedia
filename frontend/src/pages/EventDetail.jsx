import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Camera, ArrowLeft, Upload, Trash2, Image, X, Check } from "lucide-react";
import { useAuth, API } from "@/App";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const EventDetail = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletePhotoId, setDeletePhotoId] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const [eventRes, photosRes] = await Promise.all([
        fetch(`${API}/events/${eventId}`, { credentials: 'include' }),
        fetch(`${API}/events/${eventId}/photos`, { credentials: 'include' })
      ]);

      if (eventRes.ok) {
        const eventData = await eventRes.json();
        setEvent(eventData);
      }

      if (photosRes.ok) {
        const photosData = await photosRes.json();
        setPhotos(photosData);
      }
    } catch (error) {
      console.error("Failed to fetch event data:", error);
      toast.error("Failed to load event data");
    } finally {
      setLoading(false);
    }
  };

  const uploadToCloudinary = async (file) => {
    // Get signature from backend
    const sigResponse = await fetch(`${API}/cloudinary/signature?folder=luxstudio/events`, {
      credentials: 'include'
    });
    
    if (!sigResponse.ok) {
      throw new Error("Failed to get upload signature");
    }
    
    const sig = await sigResponse.json();
    
    // Upload to Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", sig.api_key);
    formData.append("timestamp", sig.timestamp);
    formData.append("signature", sig.signature);
    formData.append("folder", sig.folder);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
      { method: "POST", body: formData }
    );

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload to Cloudinary");
    }

    return uploadResponse.json();
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    const totalFiles = files.length;
    let completed = 0;
    const newPhotos = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }

      try {
        // Upload to Cloudinary
        const cloudinaryResult = await uploadToCloudinary(file);
        
        // Save to database
        const photoResponse = await fetch(`${API}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            cloudinary_url: cloudinaryResult.secure_url,
            public_id: cloudinaryResult.public_id,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height
          }),
          credentials: 'include'
        });

        if (photoResponse.ok) {
          const newPhoto = await photoResponse.json();
          newPhotos.push(newPhoto);
        }

        completed++;
        setUploadProgress(Math.round((completed / totalFiles) * 100));
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setPhotos([...newPhotos, ...photos]);
    setUploading(false);
    setUploadProgress(0);

    if (newPhotos.length > 0) {
      toast.success(`${newPhotos.length} photo(s) uploaded successfully`);
    }
  };

  const handleDeletePhoto = async () => {
    if (!deletePhotoId) return;

    try {
      const response = await fetch(`${API}/photos/${deletePhotoId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setPhotos(photos.filter(p => p.photo_id !== deletePhotoId));
        toast.success("Photo deleted successfully");
      } else {
        toast.error("Failed to delete photo");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete photo");
    } finally {
      setDeletePhotoId(null);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(Array.from(e.dataTransfer.files));
    }
  }, [eventId]);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(Array.from(e.target.files));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center" data-testid="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center" data-testid="not-found">
        <Camera className="w-16 h-16 text-[#A3A3A3] mb-4" />
        <h1 className="font-serif text-2xl text-white mb-4">Event Not Found</h1>
        <Link to="/dashboard" className="lux-btn">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]" data-testid="event-detail-page">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0A0A0A] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              className="text-[#A3A3A3] hover:text-white transition-colors"
              data-testid="back-to-dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <Camera className="w-6 h-6 text-[#C8A97E]" />
              <span className="font-serif text-2xl tracking-tight text-white">Lux Studio</span>
            </div>
          </div>
          
          <Link 
            to={`/event/${eventId}`} 
            target="_blank"
            className="text-[#A3A3A3] hover:text-white text-sm transition-colors"
            data-testid="view-public-link"
          >
            View Public Page →
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Event Info */}
        <div className="mb-8">
          <p className="lux-overline mb-2">{photos.length} Photos</p>
          <h1 className="font-serif text-3xl text-white mb-2" data-testid="event-name">{event.name}</h1>
          <p className="text-[#A3A3A3]">{event.date} • {event.photographer_name}</p>
        </div>

        {/* Upload Area */}
        <div
          className={`dropzone mb-8 ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          data-testid="upload-dropzone"
        >
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
            disabled={uploading}
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            {uploading ? (
              <div className="py-4">
                <div className="spinner mx-auto mb-4" />
                <p className="text-[#A3A3A3]">Uploading... {uploadProgress}%</p>
                <div className="w-48 mx-auto bg-white/10 h-1 mt-2">
                  <div 
                    className="bg-[#C8A97E] h-1 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
                <p className="text-white mb-2">Drop images here or click to upload</p>
                <p className="text-[#A3A3A3] text-sm">Supports JPG, PNG, WebP</p>
              </>
            )}
          </label>
        </div>

        {/* Photos Grid */}
        {photos.length === 0 ? (
          <div className="text-center py-20 lux-card" data-testid="no-photos">
            <Image className="w-16 h-16 text-[#A3A3A3] mx-auto mb-4" />
            <h2 className="font-serif text-xl text-white mb-2">No Photos Yet</h2>
            <p className="text-[#A3A3A3]">Upload your first photos to this event</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" data-testid="photos-grid">
            {photos.map((photo) => (
              <div 
                key={photo.photo_id} 
                className="group relative aspect-square bg-[#141414] overflow-hidden"
                data-testid={`photo-${photo.photo_id}`}
              >
                <img 
                  src={photo.cloudinary_url} 
                  alt=""
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={() => setDeletePhotoId(photo.photo_id)}
                    data-testid={`delete-photo-${photo.photo_id}`}
                  >
                    <Trash2 className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePhotoId} onOpenChange={() => setDeletePhotoId(null)}>
        <AlertDialogContent className="bg-[#141414] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-serif text-xl">Delete Photo?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A3A3A3]">
              This will permanently delete this photo. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-900 text-white hover:bg-red-800"
              onClick={handleDeletePhoto}
              data-testid="confirm-delete-photo-btn"
            >
              Delete Photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventDetail;
