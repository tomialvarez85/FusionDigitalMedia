import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, ArrowLeft, Save } from "lucide-react";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar } from "lucide-react";

const CreateEvent = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    date: new Date(),
    description: "",
    photographer_name: "",
    is_published: false
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error("Event name is required");
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
        toast.success("Event created successfully");
        navigate(`/admin/events/${newEvent.event_id}`);
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

  return (
    <div className="min-h-screen bg-[#0A0A0A]" data-testid="create-event-page">
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
              <span className="font-serif text-2xl tracking-tight text-white">Lux Studio</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <p className="lux-overline mb-2">New Event</p>
          <h1 className="font-serif text-3xl text-white" data-testid="page-title">Create Event</h1>
        </div>

        <form onSubmit={handleSubmit} className="lux-card" data-testid="create-event-form">
          <div className="space-y-6">
            <div>
              <Label className="text-[#A3A3A3] text-sm mb-2 block">Event Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Sarah & John's Wedding"
                className="lux-input"
                data-testid="event-name-input"
                required
              />
            </div>

            <div>
              <Label className="text-[#A3A3A3] text-sm mb-2 block">Event Date *</Label>
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
              <Label className="text-[#A3A3A3] text-sm mb-2 block">Photographer Name</Label>
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
                className="lux-input min-h-[120px] resize-none"
                data-testid="event-description-input"
              />
            </div>

            <div className="flex items-center justify-between py-4 border-t border-white/10">
              <div>
                <Label className="text-white text-sm font-medium">Published</Label>
                <p className="text-[#A3A3A3] text-xs mt-1">Make this event visible on the public gallery</p>
              </div>
              <Switch
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                data-testid="event-published-switch"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Link to="/admin/dashboard" className="flex-1">
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full lux-btn-outline"
                >
                  Cancel
                </Button>
              </Link>
              <Button 
                type="submit"
                className="flex-1 lux-btn" 
                disabled={submitting}
                data-testid="submit-event-btn"
              >
                {submitting ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Create Event
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreateEvent;
