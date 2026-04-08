import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Camera, Calendar, User, ArrowRight, Image } from "lucide-react";
import { API } from "@/App";
import ProtectedThumbnail from "@/components/ProtectedThumbnail";

const PublicGallery = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API}/public/events`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10" data-testid="public-nav">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
            <Camera className="w-6 h-6 text-[#C8A97E]" />
            <span className="font-serif text-2xl tracking-tight text-white">Lux Studio</span>
          </Link>
          <Link 
            to="/admin" 
            className="text-[#A3A3A3] hover:text-white transition-colors text-sm"
            data-testid="admin-link"
          >
            Admin
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ 
            backgroundImage: `url(https://images.unsplash.com/photo-1715558643415-04dc77392936?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHw0fHxkYXJrJTIwcGhvdG9ncmFwaHklMjBzdHVkaW98ZW58MHx8fHwxNzc1NjgwNTcxfDA&ixlib=rb-4.1.0&q=85)` 
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0A0A]/50 to-[#0A0A0A]" />
        
        <div className="relative z-10 text-center px-6">
          <p className="lux-overline mb-4 animate-fade-in" data-testid="hero-overline">Photography Portfolio</p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white tracking-tight mb-6 animate-slide-up" data-testid="hero-title">
            Capturing Moments,<br />Creating Memories
          </h1>
          <p className="text-[#A3A3A3] text-lg max-w-xl mx-auto animate-slide-up stagger-1" data-testid="hero-description">
            Browse our collection of professional photography events and discover the art of visual storytelling.
          </p>
        </div>
      </section>

      {/* Events Grid */}
      <section className="max-w-7xl mx-auto px-6 py-16" data-testid="events-section">
        <div className="flex items-center justify-between mb-12">
          <div>
            <p className="lux-overline mb-2">Our Work</p>
            <h2 className="font-serif text-2xl md:text-3xl text-white">Photo Events</h2>
          </div>
          <p className="text-[#A3A3A3] text-sm">{events.length} Events</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-spinner">
            <div className="spinner" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20" data-testid="no-events">
            <Camera className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
            <p className="text-[#A3A3A3]">No events available yet.</p>
          </div>
        ) : (
          <div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" 
            data-testid="events-grid"
          >
            {events.map((event, index) => (
              <EventCard key={event.event_id} event={event} index={index} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12" data-testid="footer">
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

// Event Card Component with Protected Thumbnail
const EventCard = ({ event, index }) => {
  const [firstPhotoId, setFirstPhotoId] = useState(null);
  const [loadingPhoto, setLoadingPhoto] = useState(true);

  useEffect(() => {
    fetchFirstPhoto();
  }, [event.event_id]);

  const fetchFirstPhoto = async () => {
    try {
      const response = await fetch(`${API}/public/events/${event.event_id}/photos`);
      if (response.ok) {
        const photos = await response.json();
        if (photos.length > 0) {
          setFirstPhotoId(photos[0].photo_id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch first photo:", error);
    } finally {
      setLoadingPhoto(false);
    }
  };

  return (
    <Link 
      to={`/event/${event.event_id}`}
      className="event-card lux-card group animate-slide-up"
      style={{ animationDelay: `${index * 0.1}s` }}
      data-testid={`event-card-${event.event_id}`}
    >
      <div className="aspect-[4/3] overflow-hidden mb-4 relative bg-[#1a1a1a]">
        {loadingPhoto ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="spinner" />
          </div>
        ) : firstPhotoId ? (
          <ProtectedThumbnail
            photoId={firstPhotoId}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-12 h-12 text-[#A3A3A3]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Photo count badge */}
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2 py-1 text-xs text-white flex items-center gap-1">
          <Image className="w-3 h-3" />
          {event.photo_count}
        </div>
      </div>
      
      <h3 className="font-serif text-xl text-white mb-3 group-hover:text-[#C8A97E] transition-colors">
        {event.name}
      </h3>
      
      <div className="flex items-center gap-4 text-[#A3A3A3] text-sm mb-4">
        <span className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {event.date}
        </span>
        {event.photographer_name && (
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" />
            {event.photographer_name}
          </span>
        )}
      </div>
      
      {event.description && (
        <p className="text-[#A3A3A3] text-sm line-clamp-2 mb-4">
          {event.description}
        </p>
      )}
      
      <div className="flex items-center gap-2 text-white text-sm group-hover:text-[#C8A97E] transition-colors">
        View Gallery
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
};

export default PublicGallery;
