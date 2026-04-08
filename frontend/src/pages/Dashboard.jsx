import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Plus, Calendar, User, Image, Trash2, Edit2, Eye, EyeOff, LogOut, LayoutDashboard } from "lucide-react";
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

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({ total_events: 0, total_photos: 0 });
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [eventsRes, statsRes] = await Promise.all([
        fetch(`${API}/events`, { credentials: 'include' }),
        fetch(`${API}/dashboard/stats`, { credentials: 'include' })
      ]);
      
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setEvents(data);
      }
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      const response = await fetch(`${API}/events/${selectedEvent.event_id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setEvents(events.filter(e => e.event_id !== selectedEvent.event_id));
        setStats(prev => ({
          ...prev,
          total_events: prev.total_events - 1,
          total_photos: prev.total_photos - (selectedEvent.photo_count || 0)
        }));
        setDeleteDialogOpen(false);
        setSelectedEvent(null);
        toast.success("Event deleted successfully");
      } else {
        toast.error("Failed to delete event");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete event");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]" data-testid="dashboard-page">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0A0A0A] sticky top-0 z-40" data-testid="dashboard-header">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/admin/dashboard" className="flex items-center gap-3">
            <Camera className="w-6 h-6 text-[#C8A97E]" />
            <span className="font-serif text-2xl tracking-tight text-white">Lux Studio</span>
            <span className="text-[#A3A3A3] text-sm ml-2">Admin</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#C8A97E] flex items-center justify-center text-black font-medium">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <span className="text-[#A3A3A3] text-sm">{user?.name || user?.email}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleLogout}
              className="text-[#A3A3A3] hover:text-white hover:bg-white/10"
              data-testid="logout-btn"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="lux-overline mb-2">Dashboard</p>
            <h1 className="font-serif text-3xl text-white" data-testid="dashboard-title">Overview</h1>
          </div>
          
          <Link to="/admin/events/new">
            <Button className="lux-btn" data-testid="create-event-btn">
              <Plus className="w-5 h-5 mr-2" />
              Create Event
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12" data-testid="stats-cards">
          <div className="lux-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#C8A97E]/10 flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-[#C8A97E]" />
              </div>
              <div>
                <p className="text-[#A3A3A3] text-sm">Total Events</p>
                <p className="font-serif text-3xl text-white" data-testid="total-events">{stats.total_events}</p>
              </div>
            </div>
          </div>
          
          <div className="lux-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#C8A97E]/10 flex items-center justify-center">
                <Image className="w-6 h-6 text-[#C8A97E]" />
              </div>
              <div>
                <p className="text-[#A3A3A3] text-sm">Total Photos</p>
                <p className="font-serif text-3xl text-white" data-testid="total-photos">{stats.total_photos}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Events Section */}
        <div className="mb-8">
          <h2 className="font-serif text-2xl text-white mb-6">All Events</h2>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20" data-testid="loading">
            <div className="spinner" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 lux-card" data-testid="no-events">
            <Camera className="w-16 h-16 text-[#A3A3A3] mx-auto mb-4" />
            <h2 className="font-serif text-xl text-white mb-2">No Events Yet</h2>
            <p className="text-[#A3A3A3] mb-6">Create your first photo event to get started</p>
            <Link to="/admin/events/new">
              <Button className="lux-btn">
                <Plus className="w-5 h-5 mr-2" />
                Create Event
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="events-grid">
            {events.map((event) => (
              <div 
                key={event.event_id} 
                className="lux-card group"
                data-testid={`event-${event.event_id}`}
              >
                <div className="aspect-video bg-[#1a1a1a] mb-4 overflow-hidden relative">
                  {event.cover_image ? (
                    <img 
                      src={event.cover_image} 
                      alt={event.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-12 h-12 text-[#A3A3A3]" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className={`absolute top-3 right-3 px-2 py-1 text-xs ${
                    (event.is_published ?? event.published) ? 'bg-green-900/80 text-green-300' : 'bg-yellow-900/80 text-yellow-300'
                  }`}>
                    {(event.is_published ?? event.published) ? 'Published' : 'Draft'}
                  </div>
                </div>

                <h3 className="font-serif text-xl text-white mb-2">{event.name}</h3>
                
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

                <p className="text-[#A3A3A3] text-sm mb-2">
                  <Image className="w-4 h-4 inline mr-1" />
                  {event.photo_count || 0} photos
                </p>

                {event.description && (
                  <p className="text-[#A3A3A3] text-sm line-clamp-2 mb-4">{event.description}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                  <Link 
                    to={`/admin/events/${event.event_id}`}
                    className="flex-1"
                  >
                    <Button 
                      variant="ghost" 
                      className="w-full text-white hover:bg-white/10"
                      data-testid={`manage-photos-${event.event_id}`}
                    >
                      <Image className="w-4 h-4 mr-2" />
                      Manage
                    </Button>
                  </Link>
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={() => {
                      setSelectedEvent(event);
                      setDeleteDialogOpen(true);
                    }}
                    data-testid={`delete-event-${event.event_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#141414] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-serif text-xl">Delete Event?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A3A3A3]">
              This will permanently delete "{selectedEvent?.name}" and all its photos ({selectedEvent?.photo_count || 0} photos). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-900 text-white hover:bg-red-800"
              onClick={handleDeleteEvent}
              data-testid="confirm-delete-btn"
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
