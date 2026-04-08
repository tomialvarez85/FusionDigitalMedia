import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Camera, Calendar, User, ArrowLeft, X, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { API } from "@/App";
import ProtectedPhoto from "@/components/ProtectedPhoto";
import LightboxPhoto from "@/components/LightboxPhoto";

const PublicEvent = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);

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

  // Disable right-click, drag, and keyboard shortcuts globally on this page
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      // Disable Ctrl+S, Ctrl+U, Ctrl+Shift+I, F12
      if (
        (e.ctrlKey && e.key === 's') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        return false;
      }
      
      // Lightbox navigation
      if (lightboxIndex !== null) {
        if (e.key === 'ArrowLeft') {
          navigateLightbox(-1);
        } else if (e.key === 'ArrowRight') {
          navigateLightbox(1);
        } else if (e.key === 'Escape') {
          setLightboxIndex(null);
        }
      }
    };
    const handleDragStart = (e) => {
      if (e.target.tagName === 'CANVAS' || e.target.closest('.canvas-container')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, [lightboxIndex, photos.length]);

  const navigateLightbox = useCallback((direction) => {
    if (lightboxIndex === null) return;
    
    const newIndex = lightboxIndex + direction;
    if (newIndex >= 0 && newIndex < photos.length) {
      setLightboxIndex(newIndex);
    }
  }, [lightboxIndex, photos.length]);

  const openLightbox = (index) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  // WhatsApp placeholder number
  const whatsappNumber = "1234567890";
  const whatsappMessage = encodeURIComponent(`Hi! I'm interested in photos from the "${event?.name}" event.`);
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

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
        <Link to="/" className="lux-btn-outline px-6 py-3">Return Home</Link>
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
            {event.photographer_name && (
              <span className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {event.photographer_name}
              </span>
            )}
          </div>
          
          {event.description && (
            <p className="text-[#A3A3A3] max-w-2xl animate-slide-up stagger-2" data-testid="event-description">
              {event.description}
            </p>
          )}
        </div>
      </section>

      {/* Photos Grid - Masonry Style */}
      <section className="max-w-7xl mx-auto px-6 pb-24" data-testid="photos-section">
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
                className="cursor-pointer animate-slide-up mb-6 break-inside-avoid"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => openLightbox(index)}
                data-testid={`photo-${photo.photo_id}`}
              >
                <ProtectedPhoto
                  photoId={photo.photo_id}
                  width={photo.width}
                  height={photo.height}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div 
          className="fixed inset-0 z-50 bg-black/98 flex items-center justify-center"
          onClick={closeLightbox}
          data-testid="lightbox"
        >
          {/* Close button */}
          <button 
            className="absolute top-6 right-6 text-white hover:text-[#C8A97E] transition-colors z-10"
            onClick={closeLightbox}
            data-testid="close-lightbox"
          >
            <X className="w-8 h-8" />
          </button>
          
          {/* Photo counter */}
          <div className="absolute top-6 left-6 text-white/60 text-sm">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {/* Previous button */}
          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(-1);
              }}
              data-testid="lightbox-prev"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Next button */}
          {lightboxIndex < photos.length - 1 && (
            <button
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(1);
              }}
              data-testid="lightbox-next"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
          
          {/* Photo container */}
          <div 
            className="max-w-6xl max-h-[85vh] px-16"
            onClick={(e) => e.stopPropagation()}
          >
            <LightboxPhoto
              photoId={photos[lightboxIndex].photo_id}
              width={photos[lightboxIndex].width}
              height={photos[lightboxIndex].height}
            />
            
            {/* Purchase message */}
            <div className="text-center mt-4">
              <p className="text-[#C8A97E] text-sm font-medium">
                Contact us to purchase the full resolution image
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Contact Button */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-8 right-8 z-40 flex items-center gap-3 bg-[#25D366] hover:bg-[#20BD5A] text-white px-5 py-3 shadow-lg transition-all hover:scale-105"
        data-testid="whatsapp-contact"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="font-medium">Contact Us</span>
      </a>

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
