import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Camera, ArrowLeft, Upload, Trash2, Image, X, Check, Save, Eye, EyeOff, Calendar } from "lucide-react";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { format } from "date-fns";

const EventDetail = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [deletePhotoId, setDeletePhotoId] = useState(null);
  const [deleteEventDialogOpen, setDeleteEventDialogOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

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
        setEditData({
          name: eventData.name,
          date: new Date(eventData.date),
          description: eventData.description || "",
          photographer_name: eventData.photographer_name || "",
          is_published: eventData.is_published ?? eventData.published ?? false
        });
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

  const uploadToCloudinary = async (file, onProgress) => {
    // Get signature from backend with event_id for folder organization
    const sigResponse = await fetch(`${API}/cloudinary/signature?event_id=${eventId}`, {
      credentials: 'include'
    });
    
    if (!sigResponse.ok) {
      throw new Error("Failed to get upload signature");
    }
    
    const sig = await sigResponse.json();
    
    // Upload to Cloudinary with progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", sig.api_key);
      formData.append("timestamp", sig.timestamp);
      formData.append("signature", sig.signature);
      formData.append("folder", sig.folder);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error("Upload failed"));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Upload failed")));

      xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`);
      xhr.send(formData);
    });
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const initialProgress = {};
    Array.from(files).forEach((file, i) => {
      initialProgress[file.name] = { progress: 0, status: 'uploading' };
    });
    setUploadProgress(initialProgress);

    const newPhotos = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { progress: 0, status: 'error', message: 'Not an image' }
        }));
        continue;
      }

      try {
        // Upload to Cloudinary
        const cloudinaryResult = await uploadToCloudinary(file, (percent) => {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { progress: percent, status: 'uploading' }
          }));
        });
        
        // Save to database - store only public_id (storage_key)
        const photoResponse = await fetch(`${API}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            storage_key: cloudinaryResult.public_id,
            original_filename: file.name,
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            file_size: cloudinaryResult.bytes || 0
          }),
          credentials: 'include'
        });

        if (photoResponse.ok) {
          const newPhoto = await photoResponse.json();
          newPhotos.push(newPhoto);
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { progress: 100, status: 'complete' }
          }));
        } else {
          throw new Error("Failed to save photo");
        }
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { progress: 0, status: 'error', message: error.message }
        }));
      }
    }

    setPhotos([...newPhotos, ...photos]);
    setUploading(false);
    
    // Clear progress after a delay
    setTimeout(() => setUploadProgress({}), 3000);

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

  const handleDeleteEvent = async () => {
    try {
      const response = await fetch(`${API}/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success("Event deleted successfully");
        navigate('/admin/dashboard');
      } else {
        toast.error("Failed to delete event");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete event");
    }
  };

  const handleSaveEvent = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API}/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editData,
          date: format(editData.date, 'yyyy-MM-dd')
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const updatedEvent = await response.json();
        setEvent(updatedEvent);
        setEditing(false);
        toast.success("Event updated successfully");
      } else {
        toast.error("Failed to update event");
      }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update event");
    } finally {
      setSaving(false);
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
        <Link to="/admin/dashboard" className="lux-btn">Return to Dashboard</Link>
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
              to="/admin/dashboard" 
              className="text-[#A3A3A3] hover:text-white transition-colors"
              data-testid="back-to-dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <Camera className="w-6 h-6 text-[#C8A97E]" />
              <span className="font-serif text-2xl tracking-tight text-white">Fusion Digital Media</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link 
              to={`/event/${eventId}`} 
              target="_blank"
              className="text-[#A3A3A3] hover:text-white text-sm transition-colors flex items-center gap-1"
              data-testid="view-public-link"
            >
              <Eye className="w-4 h-4" />
              View Public
            </Link>
            <Button
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
              onClick={() => setDeleteEventDialogOpen(true)}
              data-testid="delete-event-btn"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Event
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Event Info - Inline Editing */}
        <div className="lux-card mb-8" data-testid="event-info">
          {editing ? (
            <div className="space-y-4">
              <div>
                <Label className="text-[#A3A3A3] text-sm mb-2 block">Event Name</Label>
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="lux-input"
                  data-testid="edit-name-input"
                />
              </div>
              
              <div>
                <Label className="text-[#A3A3A3] text-sm mb-2 block">Date</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left lux-input hover:bg-transparent"
                    >
                      <Calendar className="mr-2 h-4 w-4 text-[#A3A3A3]" />
                      {editData.date ? format(editData.date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#141414] border-white/10" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={editData.date}
                      onSelect={(date) => {
                        setEditData({ ...editData, date: date || new Date() });
                        setCalendarOpen(false);
                      }}
                      initialFocus
                      className="bg-[#141414]"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label className="text-[#A3A3A3] text-sm mb-2 block">Photographer</Label>
                <Input
                  value={editData.photographer_name}
                  onChange={(e) => setEditData({ ...editData, photographer_name: e.target.value })}
                  className="lux-input"
                  data-testid="edit-photographer-input"
                />
              </div>
              
              <div>
                <Label className="text-[#A3A3A3] text-sm mb-2 block">Description</Label>
                <Textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="lux-input min-h-[100px] resize-none"
                  data-testid="edit-description-input"
                />
              </div>
              
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-white text-sm">Published</Label>
                  <p className="text-[#A3A3A3] text-xs">Visible on public gallery</p>
                </div>
                <Switch
                  checked={editData.is_published}
                  onCheckedChange={(checked) => setEditData({ ...editData, is_published: checked })}
                  data-testid="edit-published-switch"
                />
              </div>
              
              <div className="flex gap-2 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  className="lux-btn-outline"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="lux-btn"
                  onClick={handleSaveEvent}
                  disabled={saving}
                  data-testid="save-event-btn"
                >
                  {saving ? <div className="spinner" /> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 text-xs ${
                    (event.is_published ?? event.published) ? 'bg-green-900/80 text-green-300' : 'bg-yellow-900/80 text-yellow-300'
                  }`}>
                    {(event.is_published ?? event.published) ? 'Published' : 'Draft'}
                  </span>
                </div>
                <h1 className="font-serif text-3xl text-white mb-2" data-testid="event-name">{event.name}</h1>
                <p className="text-[#A3A3A3] mb-4">{event.date} {event.photographer_name && `• ${event.photographer_name}`}</p>
                {event.description && (
                  <p className="text-[#A3A3A3] max-w-2xl">{event.description}</p>
                )}
              </div>
              <Button
                variant="outline"
                className="lux-btn-outline"
                onClick={() => setEditing(true)}
                data-testid="edit-event-btn"
              >
                Edit Details
              </Button>
            </div>
          )}
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
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
            disabled={uploading}
          />
          <label htmlFor="file-upload" className="cursor-pointer block">
            <Upload className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
            <p className="text-white mb-2">Drop images here or click to upload</p>
            <p className="text-[#A3A3A3] text-sm">Supports JPG, PNG, WebP • Multiple files allowed</p>
          </label>
        </div>

        {/* Upload Progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="lux-card mb-8 space-y-3" data-testid="upload-progress">
            <p className="text-white font-medium mb-4">Uploading...</p>
            {Object.entries(uploadProgress).map(([filename, data]) => (
              <div key={filename} className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-white truncate">{filename}</p>
                  <div className="w-full bg-white/10 h-1 mt-1">
                    <div 
                      className={`h-1 transition-all duration-300 ${
                        data.status === 'complete' ? 'bg-green-500' :
                        data.status === 'error' ? 'bg-red-500' : 'bg-[#C8A97E]'
                      }`}
                      style={{ width: `${data.progress}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-[#A3A3A3] w-12 text-right">
                  {data.status === 'complete' ? <Check className="w-4 h-4 text-green-500 inline" /> :
                   data.status === 'error' ? <X className="w-4 h-4 text-red-500 inline" /> :
                   `${data.progress}%`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Photos Section */}
        <div className="mb-4">
          <p className="lux-overline">{photos.length} Photos</p>
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
                
                {/* Overlay with delete button */}
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

      {/* Delete Photo Confirmation */}
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

      {/* Delete Event Confirmation */}
      <AlertDialog open={deleteEventDialogOpen} onOpenChange={setDeleteEventDialogOpen}>
        <AlertDialogContent className="bg-[#141414] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-serif text-xl">Delete Event?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A3A3A3]">
              This will permanently delete "{event.name}" and all {photos.length} photos. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-900 text-white hover:bg-red-800"
              onClick={handleDeleteEvent}
              data-testid="confirm-delete-event-btn"
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventDetail;
