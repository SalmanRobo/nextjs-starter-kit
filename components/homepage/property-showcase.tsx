"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Car,
  Home,
  Building2,
  Users,
  Search
} from "lucide-react";
import Link from "next/link";

// Mock property data - will be replaced with real data from API
const featuredProperties = [
  {
    id: "1",
    title: "Luxury Villa in Al Olaya",
    description: "Spacious 4-bedroom villa with modern amenities and garden",
    price: 15000,
    currency: "SAR",
    purpose: "rent",
    type: "villa",
    bedrooms: 4,
    bathrooms: 3,
    areaSqm: 350,
    city: "Riyadh",
    neighborhood: "Al Olaya",
    parking: true,
    furnished: true,
    imageUrl: "/api/placeholder/400/250",
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
    parking: true,
    furnished: false,
    imageUrl: "/api/placeholder/400/250",
  },
  {
    id: "3",
    title: "Commercial Office in Business District",
    description: "Prime location office space with excellent facilities",
    price: 12000,
    currency: "SAR", 
    purpose: "rent",
    type: "commercial",
    bedrooms: 0,
    bathrooms: 2,
    areaSqm: 200,
    city: "Riyadh",
    neighborhood: "Business District",
    parking: true,
    furnished: true,
    imageUrl: "/api/placeholder/400/250",
  },
];

const stats = [
  { icon: Home, label: "Properties Listed", value: "10K+" },
  { icon: Building2, label: "Cities Covered", value: "25+" },
  { icon: Users, label: "Happy Customers", value: "5K+" },
];

export default function PropertyShowcase() {
  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Featured Properties in Saudi Arabia
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover premium properties for rent and sale across major Saudi cities. 
            Your dream property is just a click away.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center border-0 shadow-sm">
              <CardContent className="pt-6">
                <stat.icon className="h-12 w-12 text-primary mx-auto mb-4" />
                <div className="text-3xl font-bold mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Featured Properties */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {featuredProperties.map((property) => (
            <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video relative bg-gray-200">
                {/* Property Image Placeholder */}
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Home className="h-12 w-12" />
                </div>
                <Badge 
                  className="absolute top-3 left-3"
                  variant={property.purpose === 'sale' ? 'default' : 'secondary'}
                >
                  For {property.purpose === 'sale' ? 'Sale' : 'Rent'}
                </Badge>
              </div>
              
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg line-clamp-2 mb-1">
                      {property.title}
                    </CardTitle>
                    <div className="flex items-center text-muted-foreground text-sm">
                      <MapPin className="h-4 w-4 mr-1" />
                      {property.neighborhood}, {property.city}
                    </div>
                  </div>
                </div>
                
                <div className="text-2xl font-bold text-primary">
                  {property.price.toLocaleString()} {property.currency}
                  {property.purpose === 'rent' && (
                    <span className="text-sm font-normal text-muted-foreground">/month</span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <CardDescription className="mb-4 line-clamp-2">
                  {property.description}
                </CardDescription>

                {/* Property Details */}
                <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                  {property.bedrooms > 0 && (
                    <div className="flex items-center">
                      <Bed className="h-4 w-4 mr-1" />
                      {property.bedrooms}
                    </div>
                  )}
                  <div className="flex items-center">
                    <Bath className="h-4 w-4 mr-1" />
                    {property.bathrooms}
                  </div>
                  <div className="flex items-center">
                    <Square className="h-4 w-4 mr-1" />
                    {property.areaSqm}m²
                  </div>
                  {property.parking && (
                    <div className="flex items-center">
                      <Car className="h-4 w-4 mr-1" />
                    </div>
                  )}
                </div>

                {/* Property Features */}
                <div className="flex gap-2 mb-4">
                  <Badge variant="outline" className="text-xs">
                    {property.type}
                  </Badge>
                  {property.furnished && (
                    <Badge variant="outline" className="text-xs">
                      Furnished
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" size="sm">
                    View Details
                  </Button>
                  <Button variant="outline" size="sm">
                    Contact
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/properties">
              <Button size="lg" className="min-w-[200px]">
                <Search className="h-4 w-4 mr-2" />
                Browse All Properties
              </Button>
            </Link>
            <Link href="/dashboard/properties/add">
              <Button variant="outline" size="lg" className="min-w-[200px]">
                <Home className="h-4 w-4 mr-2" />
                List Your Property
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}