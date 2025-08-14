import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, MapPin, Phone, Mail, Calendar, Eye, Reply, Archive, Filter } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

export default async function InquiriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Mock inquiries data - will be replaced with real database query
  const inquiries = [
    {
      id: "1",
      propertyId: "1",
      propertyTitle: "Luxury Villa in Al Olaya",
      inquirerName: "Ahmed Al-Mansouri",
      inquirerEmail: "ahmed.mansouri@email.com",
      inquirerPhone: "+966 50 123 4567",
      message: "I'm interested in viewing this villa. Could we schedule a visit for this weekend? I have a family of 4 and looking for immediate occupancy.",
      status: "new",
      priority: "high",
      createdAt: "2024-01-15T10:30:00Z",
      inquiryType: "viewing",
      propertyType: "villa",
      propertyCity: "Riyadh",
      propertyPrice: 15000,
      purpose: "rent"
    },
    {
      id: "2",
      propertyId: "2",
      propertyTitle: "Modern Apartment in King Abdullah District",
      inquirerName: "Sarah Johnson",
      inquirerEmail: "sarah.j@email.com",
      inquirerPhone: "+966 55 987 6543",
      message: "Hello, I'm relocating to Riyadh for work. Is this apartment still available for purchase? What's included in the sale?",
      status: "in_progress",
      priority: "medium",
      createdAt: "2024-01-14T14:20:00Z",
      inquiryType: "purchase",
      propertyType: "apartment",
      propertyCity: "Riyadh",
      propertyPrice: 850000,
      purpose: "sale"
    },
    {
      id: "3",
      propertyId: "1",
      propertyTitle: "Luxury Villa in Al Olaya",
      inquirerName: "Mohammed Al-Rashid",
      inquirerEmail: "m.alrashid@gmail.com",
      inquirerPhone: "+966 54 234 5678",
      message: "Is the villa pet-friendly? We have two cats. Also, what's the minimum lease term?",
      status: "responded",
      priority: "low",
      createdAt: "2024-01-13T09:15:00Z",
      inquiryType: "information",
      propertyType: "villa",
      propertyCity: "Riyadh",
      propertyPrice: 15000,
      purpose: "rent"
    },
    {
      id: "4",
      propertyId: "3",
      propertyTitle: "Commercial Office in Business District",
      inquirerName: "Tech Solutions Ltd",
      inquirerEmail: "contact@techsolutions.sa",
      inquirerPhone: "+966 11 234 5678",
      message: "We're looking for office space for 25 employees. Can you provide floor plans and available parking spaces?",
      status: "new",
      priority: "high",
      createdAt: "2024-01-12T16:45:00Z",
      inquiryType: "commercial",
      propertyType: "commercial",
      propertyCity: "Riyadh",
      propertyPrice: 12000,
      purpose: "rent"
    }
  ];

  const stats = {
    total: inquiries.length,
    new: inquiries.filter(i => i.status === 'new').length,
    inProgress: inquiries.filter(i => i.status === 'in_progress').length,
    responded: inquiries.filter(i => i.status === 'responded').length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-red-100 text-red-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'responded': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Property Inquiries</h1>
          <p className="text-muted-foreground">
            Manage and respond to inquiries about your properties
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Inquiries</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>New Inquiries</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.new}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{stats.inProgress}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Responded</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.responded}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Input 
              placeholder="Search inquiries by name, email, or property..."
              className="max-w-md"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Inquiries List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Inquiries</CardTitle>
          <CardDescription>
            All inquiries about your properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inquiries.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <div className="text-muted-foreground mb-4">
                No inquiries yet
              </div>
              <p className="text-sm text-muted-foreground">
                Inquiries will appear here when potential buyers or renters contact you
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {inquiries.map((inquiry) => (
                <Card key={inquiry.id} className={`border-l-4 ${getPriorityColor(inquiry.priority)}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getStatusColor(inquiry.status)}>
                            {inquiry.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline">
                            {inquiry.inquiryType}
                          </Badge>
                          <Badge variant="outline">
                            {inquiry.priority} priority
                          </Badge>
                        </div>
                        
                        <h3 className="font-semibold text-lg mb-1">
                          {inquiry.inquirerName}
                        </h3>
                        
                        <div className="flex items-center text-muted-foreground text-sm mb-2">
                          <Calendar className="h-4 w-4 mr-1" />
                          {formatDate(inquiry.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Property Info */}
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-primary">
                          {inquiry.propertyTitle}
                        </h4>
                        <div className="text-lg font-semibold">
                          {inquiry.propertyPrice.toLocaleString()} SAR
                          {inquiry.purpose === 'rent' && <span className="text-sm font-normal">/month</span>}
                        </div>
                      </div>
                      <div className="flex items-center text-muted-foreground text-sm">
                        <MapPin className="h-4 w-4 mr-1" />
                        {inquiry.propertyCity} • {inquiry.propertyType} • For {inquiry.purpose}
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center text-sm">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        <a href={`mailto:${inquiry.inquirerEmail}`} className="text-primary hover:underline">
                          {inquiry.inquirerEmail}
                        </a>
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                        <a href={`tel:${inquiry.inquirerPhone}`} className="text-primary hover:underline">
                          {inquiry.inquirerPhone}
                        </a>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="bg-white border p-4 rounded-lg mb-4">
                      <p className="text-sm leading-relaxed">
                        "{inquiry.message}"
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm">
                        <Reply className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View Property
                      </Button>
                      <Button variant="outline" size="sm">
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule Viewing
                      </Button>
                      <Button variant="outline" size="sm" className="text-muted-foreground">
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </Button>
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