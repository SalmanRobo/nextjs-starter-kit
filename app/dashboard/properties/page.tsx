import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Bed, Bath, Square, Car, Edit, Eye, Trash2 } from "lucide-react";
import Link from "next/link";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Mock properties data - will be replaced with real database query
  const properties = [
    {
      id: "1",
      title: "Luxury Villa in Al Olaya",
      description: "Spacious 4-bedroom villa with modern amenities",
      price: 15000,
      currency: "SAR",
      purpose: "rent",
      type: "villa",
      bedrooms: 4,
      bathrooms: 3,
      areaSqm: 350,
      city: "Riyadh",
      neighborhood: "Al Olaya",
      status: "active",
      parking: true,
      furnished: true,
      createdAt: "2024-01-15",
    },
    {
      id: "2",
      title: "Modern Apartment in King Abdullah District",
      description: "Contemporary 2-bedroom apartment with city views",
      price: 850000,
      currency: "SAR",
      purpose: "sale",
      type: "apartment",
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 120,
      city: "Riyadh",
      neighborhood: "King Abdullah District",
      status: "active",
      parking: true,
      furnished: false,
      createdAt: "2024-01-10",
    },
  ];

  const stats = {
    total: properties.length,
    active: properties.filter(p => p.status === 'active').length,
    forRent: properties.filter(p => p.purpose === 'rent').length,
    forSale: properties.filter(p => p.purpose === 'sale').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Properties</h1>
          <p className="text-muted-foreground">
            Manage your property listings and track their performance
          </p>
        </div>
        <Link href="/dashboard/properties/add">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Properties</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Listings</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>For Rent</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.forRent}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>For Sale</CardDescription>
            <CardTitle className="text-3xl text-purple-600">{stats.forSale}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Properties List */}
      <Card>
        <CardHeader>
          <CardTitle>Property Listings</CardTitle>
          <CardDescription>
            All your property listings in one place
          </CardDescription>
        </CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                You haven&apos;t listed any properties yet
              </div>
              <Link href="/dashboard/properties/add">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  List Your First Property
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {properties.map((property) => (
                <Card key={property.id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold mb-1">
                              {property.title}
                            </h3>
                            <div className="flex items-center text-muted-foreground text-sm mb-2">
                              <MapPin className="h-4 w-4 mr-1" />
                              {property.neighborhood}, {property.city}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {property.price.toLocaleString()} {property.currency}
                              {property.purpose === 'rent' && (
                                <span className="text-sm font-normal text-muted-foreground">/month</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-muted-foreground mb-4 line-clamp-2">
                          {property.description}
                        </p>

                        {/* Property Details */}
                        <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                          {property.bedrooms > 0 && (
                            <div className="flex items-center">
                              <Bed className="h-4 w-4 mr-1" />
                              {property.bedrooms} beds
                            </div>
                          )}
                          <div className="flex items-center">
                            <Bath className="h-4 w-4 mr-1" />
                            {property.bathrooms} baths
                          </div>
                          <div className="flex items-center">
                            <Square className="h-4 w-4 mr-1" />
                            {property.areaSqm}m²
                          </div>
                          {property.parking && (
                            <div className="flex items-center">
                              <Car className="h-4 w-4 mr-1" />
                              Parking
                            </div>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant={property.purpose === 'sale' ? 'default' : 'secondary'}>
                            For {property.purpose === 'sale' ? 'Sale' : 'Rent'}
                          </Badge>
                          <Badge variant="outline">
                            {property.type}
                          </Badge>
                          {property.furnished && (
                            <Badge variant="outline">
                              Furnished
                            </Badge>
                          )}
                          <Badge 
                            variant={property.status === 'active' ? 'default' : 'secondary'}
                          >
                            {property.status}
                          </Badge>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
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