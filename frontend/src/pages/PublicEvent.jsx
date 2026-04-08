import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Camera, Calendar, User, ArrowLeft, X } from "lucide-react";
import { API } from "@/App";
import ProtectedPhoto from "@/components/ProtectedPhoto";

const PublicEvent = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const [eventRes, photosRes] = await Promise.all([
        fetch(`${API}/public/events/${eventId}`),
        fetch(`${API}/public/events/${eventId}/photos`)
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
    } finally {
      setLoading(false);
    }
  };

  // Disable right-click globally on this page
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

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
        <Link to="/" className="lux-btn-outline">Return Home</Link>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[#0A0A0A]"
      onDragStart={(e) => e.preventDefault()}
      data-testid="public-event-page"
    >
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10" data-testid="event-nav">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="back-link">
            <ArrowLeft className="w-5 h-5 text-white" />
            <Camera className="w-6 h-6 text-[#C8A97E]" />
            <span className="font-serif text-2xl tracking-tight text-white">Lux Studio</span>
          </Link>
        </div>
      </nav>

      {/* Event Header */}
      <section className="pt-24 pb-12 px-6" data-testid="event-header">
        <div className="max-w-7xl mx-auto">
          <p className="lux-overline mb-4 animate-fade-in">{photos.length} Photos</p>
          <h1 className="font-serif text-4xl md:text-5xl text-white tracking-tight mb-6 animate-slide-up" data-testid="event-title">
            {event.name}
          </h1>
          
          <div className="flex flex-wrap items-center gap-6 text-[#A3A3A3] mb-8 animate-slide-up stagger-1">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {event.date}
            </span>
            <span className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {event.photographer_name}
            </span>
          </div>
          
          <p className="text-[#A3A3A3] max-w-2xl animate-slide-up stagger-2" data-testid="event-description">
            {event.description}
          </p>
        </div>
      </section>

      {/* Photos Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-16" data-testid="photos-section">
        {photos.length === 0 ? (
          <div className="text-center py-20" data-testid="no-photos">
            <Camera className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
            <p className="text-[#A3A3A3]">No photos in this event yet.</p>
          </div>
        ) : (
          <div className="photo-grid" data-testid="photos-grid">
            {photos.map((photo, index) => (
              <div 
                key={photo.photo_id}
                className="canvas-container cursor-pointer animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => setSelectedPhoto(photo)}
                data-testid={`photo-${photo.photo_id}`}
              >
                <ProtectedPhoto
                  src={photo.src}
                  width={photo.width}
                  height={photo.height}
                  watermarkText="Lux Studio"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
          data-testid="lightbox"
        >
          <button 
            className="absolute top-6 right-6 text-white hover:text-[#C8A97E] transition-colors"
            onClick={() => setSelectedPhoto(null)}
            data-testid="close-lightbox"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div 
            className="max-w-5xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ProtectedPhoto
              src={selectedPhoto.src}
              width={selectedPhoto.width}
              height={selectedPhoto.height}
              watermarkText="Lux Studio"
              className="max-h-[85vh] w-auto"
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 py-12" data-testid="event-footer">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#C8A97E]" />
            <span className="font-serif text-lg text-white">Lux Studio</span>
          </div>
          <p className="text-[#A3A3A3] text-sm">© 2025 Lux Studio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PublicEvent;
