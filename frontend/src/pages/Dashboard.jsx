import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Plus, Calendar, User, Image, Trash2, Edit2, Eye, EyeOff, LogOut } from "lucide-react";
import { useAuth, API } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    date: new Date(),
    description: "",
    photographer_name: "",
    published: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API}/events`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!formData.name || !formData.photographer_name) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          date: format(formData.date, 'yyyy-MM-dd')
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const newEvent = await response.json();
        setEvents([newEvent, ...events]);
        setCreateDialogOpen(false);
        resetForm();
        toast.success("Event created successfully");
      } else {
        toast.error("Failed to create event");
      }
    } catch (error) {
      console.error("Create error:", error);
      toast.error("Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEvent = async () => {
    if (!selectedEvent) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API}/events/${selectedEvent.event_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          date: format(formData.date, 'yyyy-MM-dd')
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const updatedEvent = await response.json();
        setEvents(events.map(e => e.event_id === updatedEvent.event_id ? updatedEvent : e));
        setEditDialogOpen(false);
        resetForm();
        toast.success("Event updated successfully");
      } else {
        toast.error("Failed to update event");
      }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update event");
    } finally {
      setSubmitting(false);
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

  const resetForm = () => {
    setFormData({
      name: "",
      date: new Date(),
      description: "",
      photographer_name: "",
      published: true
    });
    setSelectedEvent(null);
  };

  const openEditDialog = (event) => {
    setSelectedEvent(event);
    setFormData({
      name: event.name,
      date: new Date(event.date),
      description: event.description,
      photographer_name: event.photographer_name,
      published: event.published
    });
    setEditDialogOpen(true);
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
          <Link to="/dashboard" className="flex items-center gap-3">
            <Camera className="w-6 h-6 text-[#C8A97E]" />
            <span className="font-serif text-2xl tracking-tight text-white">Lux Studio</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3">
              {user?.picture && (
                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
              )}
              <span className="text-[#A3A3A3] text-sm">{user?.name}</span>
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
            <h1 className="font-serif text-3xl text-white" data-testid="dashboard-title">Photo Events</h1>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="lux-btn" data-testid="create-event-btn">
                <Plus className="w-5 h-5 mr-2" />
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#141414] border-white/10 text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Create New Event</DialogTitle>
              </DialogHeader>
              <EventForm 
                formData={formData} 
                setFormData={setFormData} 
                onSubmit={handleCreateEvent}
                submitting={submitting}
              />
            </DialogContent>
          </Dialog>
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
            <Button 
              className="lux-btn"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Event
            </Button>
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
                    event.published ? 'bg-green-900/80 text-green-300' : 'bg-yellow-900/80 text-yellow-300'
                  }`}>
                    {event.published ? 'Published' : 'Draft'}
                  </div>
                </div>

                <h3 className="font-serif text-xl text-white mb-2">{event.name}</h3>
                
                <div className="flex items-center gap-4 text-[#A3A3A3] text-sm mb-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {event.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {event.photographer_name}
                  </span>
                </div>

                <p className="text-[#A3A3A3] text-sm line-clamp-2 mb-4">{event.description}</p>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                  <Link 
                    to={`/dashboard/event/${event.event_id}`}
                    className="flex-1"
                  >
                    <Button 
                      variant="ghost" 
                      className="w-full text-white hover:bg-white/10"
                      data-testid={`manage-photos-${event.event_id}`}
                    >
                      <Image className="w-4 h-4 mr-2" />
                      Manage Photos
                    </Button>
                  </Link>
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-[#A3A3A3] hover:text-white hover:bg-white/10"
                    onClick={() => openEditDialog(event)}
                    data-testid={`edit-event-${event.event_id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#141414] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Edit Event</DialogTitle>
          </DialogHeader>
          <EventForm 
            formData={formData} 
            setFormData={setFormData} 
            onSubmit={handleEditEvent}
            submitting={submitting}
            isEdit
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#141414] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white font-serif text-xl">Delete Event?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A3A3A3]">
              This will permanently delete "{selectedEvent?.name}" and all its photos. This action cannot be undone.
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

// Event Form Component
const EventForm = ({ formData, setFormData, onSubmit, submitting, isEdit = false }) => {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className="space-y-4 mt-4">
      <div>
        <Label className="text-[#A3A3A3] text-sm mb-2 block">Event Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. Sarah & John's Wedding"
          className="lux-input"
          data-testid="event-name-input"
        />
      </div>

      <div>
        <Label className="text-[#A3A3A3] text-sm mb-2 block">Date *</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left lux-input hover:bg-transparent"
              data-testid="event-date-picker"
            >
              <Calendar className="mr-2 h-4 w-4 text-[#A3A3A3]" />
              {formData.date ? format(formData.date, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-[#141414] border-white/10" align="start">
            <CalendarComponent
              mode="single"
              selected={formData.date}
              onSelect={(date) => {
                setFormData({ ...formData, date: date || new Date() });
                setCalendarOpen(false);
              }}
              initialFocus
              className="bg-[#141414]"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label className="text-[#A3A3A3] text-sm mb-2 block">Photographer Name *</Label>
        <Input
          value={formData.photographer_name}
          onChange={(e) => setFormData({ ...formData, photographer_name: e.target.value })}
          placeholder="e.g. John Smith"
          className="lux-input"
          data-testid="photographer-name-input"
        />
      </div>

      <div>
        <Label className="text-[#A3A3A3] text-sm mb-2 block">Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the event..."
          className="lux-input min-h-[100px] resize-none"
          data-testid="event-description-input"
        />
      </div>

      <div className="flex items-center justify-between py-2">
        <div>
          <Label className="text-white text-sm">Published</Label>
          <p className="text-[#A3A3A3] text-xs">Make this event visible to the public</p>
        </div>
        <Switch
          checked={formData.published}
          onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
          data-testid="event-published-switch"
        />
      </div>

      <Button 
        className="w-full lux-btn mt-6" 
        onClick={onSubmit}
        disabled={submitting}
        data-testid="submit-event-btn"
      >
        {submitting ? (
          <div className="spinner" />
        ) : (
          isEdit ? 'Update Event' : 'Create Event'
        )}
      </Button>
    </div>
  );
};

export default Dashboard;
