"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Mail, 
  Plus,
  Eye,
  Edit,
  X,
  Check,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Viewing {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  propertyType: string;
  propertyPrice: number;
  purpose: string;
  viewerName: string;
  viewerEmail: string;
  viewerPhone: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  createdAt: string;
}

// Mock viewings data - will be replaced with real database query
const mockViewings: Viewing[] = [
  {
    id: "1",
    propertyId: "1",
    propertyTitle: "Luxury Villa in Al Olaya",
    propertyAddress: "Al Olaya District, Riyadh",
    propertyType: "villa",
    propertyPrice: 15000,
    purpose: "rent",
    viewerName: "Ahmed Al-Mansouri",
    viewerEmail: "ahmed.mansouri@email.com",
    viewerPhone: "+966 50 123 4567",
    scheduledDate: "2024-01-16",
    scheduledTime: "14:00",
    duration: 60,
    status: "confirmed",
    notes: "Interested in immediate occupancy for family of 4",
    createdAt: "2024-01-15T10:30:00Z"
  },
  {
    id: "2",
    propertyId: "2",
    propertyTitle: "Modern Apartment in King Abdullah District",
    propertyAddress: "King Abdullah District, Riyadh",
    propertyType: "apartment",
    propertyPrice: 850000,
    purpose: "sale",
    viewerName: "Sarah Johnson",
    viewerEmail: "sarah.j@email.com",
    viewerPhone: "+966 55 987 6543",
    scheduledDate: "2024-01-17",
    scheduledTime: "10:30",
    duration: 45,
    status: "scheduled",
    notes: "First-time buyer, needs detailed explanation",
    createdAt: "2024-01-14T14:20:00Z"
  },
  {
    id: "3",
    propertyId: "3",
    propertyTitle: "Commercial Office in Business District",
    propertyAddress: "Business District, Riyadh",
    propertyType: "commercial",
    propertyPrice: 12000,
    purpose: "rent",
    viewerName: "Tech Solutions Ltd",
    viewerEmail: "contact@techsolutions.sa",
    viewerPhone: "+966 11 234 5678",
    scheduledDate: "2024-01-18",
    scheduledTime: "11:00",
    duration: 90,
    status: "scheduled",
    notes: "Needs to see parking facilities and floor plans",
    createdAt: "2024-01-12T16:45:00Z"
  },
  {
    id: "4",
    propertyId: "1",
    propertyTitle: "Luxury Villa in Al Olaya",
    propertyAddress: "Al Olaya District, Riyadh",
    propertyType: "villa",
    propertyPrice: 15000,
    purpose: "rent",
    viewerName: "Fatima Al-Zahra",
    viewerEmail: "f.alzahra@email.com",
    viewerPhone: "+966 56 789 0123",
    scheduledDate: "2024-01-14",
    scheduledTime: "16:00",
    duration: 45,
    status: "completed",
    notes: "Showed interest, waiting for decision",
    createdAt: "2024-01-12T09:15:00Z"
  }
];

export default function ViewingsPage() {
  const [viewings] = useState<Viewing[]>(mockViewings);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Filter viewings based on status and search term
  const filteredViewings = viewings.filter(viewing => {
    const matchesStatus = selectedStatus === "all" || viewing.status === selectedStatus;
    const matchesSearch = searchTerm === "" || 
      viewing.viewerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      viewing.propertyTitle.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: viewings.length,
    scheduled: viewings.filter(v => v.status === 'scheduled').length,
    confirmed: viewings.filter(v => v.status === 'confirmed').length,
    completed: viewings.filter(v => v.status === 'completed').length,
    cancelled: viewings.filter(v => v.status === 'cancelled').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <Check className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      case 'no_show': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-SA', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    return new Date(`2024-01-01T${time}`).toLocaleTimeString('en-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const isToday = (date: string) => {
    const today = new Date().toDateString();
    const viewingDate = new Date(date).toDateString();
    return today === viewingDate;
  };

  const isTomorrow = (date: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const viewingDate = new Date(date).toDateString();
    return tomorrow.toDateString() === viewingDate;
  };

  const getDateLabel = (date: string) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return formatDate(date);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Property Viewings</h1>
          <p className="text-muted-foreground">
            Manage scheduled property viewings and appointments
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Viewing
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Viewings</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Scheduled</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.scheduled}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Confirmed</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.confirmed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-3xl text-gray-600">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Cancelled</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.cancelled}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input 
              placeholder="Search by viewer name or property..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Viewings List */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming & Recent Viewings</CardTitle>
          <CardDescription>
            All scheduled property viewings and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredViewings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <div className="text-muted-foreground mb-4">
                {searchTerm || selectedStatus !== "all" ? "No viewings found" : "No viewings scheduled"}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm || selectedStatus !== "all" 
                  ? "Try adjusting your search or filter criteria"
                  : "Schedule property viewings to manage appointments with potential buyers and renters"
                }
              </p>
              {(!searchTerm && selectedStatus === "all") && (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Your First Viewing
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredViewings.map((viewing) => (
                <Card key={viewing.id} className="border-l-4 border-l-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getStatusColor(viewing.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(viewing.status)}
                              {viewing.status.replace('_', ' ')}
                            </div>
                          </Badge>
                          <Badge variant="outline">
                            {viewing.purpose}
                          </Badge>
                          <Badge variant="outline">
                            {viewing.propertyType}
                          </Badge>
                        </div>
                        
                        <h3 className="font-semibold text-lg mb-1">
                          {viewing.propertyTitle}
                        </h3>
                        
                        <div className="flex items-center text-muted-foreground text-sm mb-2">
                          <MapPin className="h-4 w-4 mr-1" />
                          {viewing.propertyAddress}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-semibold text-primary">
                          {viewing.propertyPrice.toLocaleString()} SAR
                          {viewing.purpose === 'rent' && <span className="text-sm font-normal">/month</span>}
                        </div>
                      </div>
                    </div>

                    {/* Viewing Details */}
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{getDateLabel(viewing.scheduledDate)}</div>
                            <div className="text-sm text-muted-foreground">{formatDate(viewing.scheduledDate)}</div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{formatTime(viewing.scheduledTime)}</div>
                            <div className="text-sm text-muted-foreground">{viewing.duration} minutes</div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{viewing.viewerName}</div>
                            <div className="text-sm text-muted-foreground">Viewer</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center text-sm">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        <a href={`mailto:${viewing.viewerEmail}`} className="text-primary hover:underline">
                          {viewing.viewerEmail}
                        </a>
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                        <a href={`tel:${viewing.viewerPhone}`} className="text-primary hover:underline">
                          {viewing.viewerPhone}
                        </a>
                      </div>
                    </div>

                    {/* Notes */}
                    {viewing.notes && (
                      <div className="bg-white border p-3 rounded-lg mb-4">
                        <p className="text-sm text-muted-foreground">
                          <strong>Notes:</strong> {viewing.notes}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      {viewing.status === 'scheduled' && (
                        <>
                          <Button size="sm" variant="default">
                            <Check className="h-4 w-4 mr-2" />
                            Confirm
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4 mr-2" />
                            Reschedule
                          </Button>
                        </>
                      )}
                      
                      {viewing.status === 'confirmed' && (
                        <>
                          <Button size="sm" variant="default">
                            <Check className="h-4 w-4 mr-2" />
                            Mark Complete
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4 mr-2" />
                            Reschedule
                          </Button>
                        </>
                      )}
                      
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        View Property
                      </Button>
                      
                      {!['completed', 'cancelled'].includes(viewing.status) && (
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}