"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface PropertyForm {
  title: string;
  description: string;
  type: string;
  purpose: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  areaSqm: string;
  city: string;
  neighborhood: string;
  address: string;
  furnished: boolean;
  parking: boolean;
}

const initialForm: PropertyForm = {
  title: "",
  description: "",
  type: "",
  purpose: "",
  price: "",
  bedrooms: "",
  bathrooms: "",
  areaSqm: "",
  city: "",
  neighborhood: "",
  address: "",
  furnished: false,
  parking: false,
};

const propertyTypes = [
  { value: "apartment", label: "Apartment" },
  { value: "villa", label: "Villa" },
  { value: "townhouse", label: "Townhouse" },
  { value: "penthouse", label: "Penthouse" },
  { value: "commercial", label: "Commercial" },
  { value: "office", label: "Office" },
  { value: "warehouse", label: "Warehouse" },
  { value: "land", label: "Land" },
];

const saudiCities = [
  { value: "riyadh", label: "Riyadh" },
  { value: "jeddah", label: "Jeddah" },
  { value: "mecca", label: "Mecca" },
  { value: "medina", label: "Medina" },
  { value: "dammam", label: "Dammam" },
  { value: "khobar", label: "Khobar" },
  { value: "dhahran", label: "Dhahran" },
  { value: "taif", label: "Taif" },
  { value: "tabuk", label: "Tabuk" },
  { value: "buraidah", label: "Buraidah" },
];

export default function AddPropertyPage() {
  const router = useRouter();
  const [form, setForm] = useState<PropertyForm>(initialForm);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!form.title || !form.type || !form.purpose || !form.price || !form.city) {
        toast.error("Please fill in all required fields");
        return;
      }

      // Mock API call - will be replaced with real API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success("Property listed successfully!");
      router.push("/dashboard/properties");
    } catch (error) {
      toast.error("Failed to list property. Please try again.");
      console.error("Error creating property:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field: keyof PropertyForm, value: string | boolean) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/properties">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Properties
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Add New Property</h1>
            <p className="text-muted-foreground">
              List your property for rent or sale
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the basic details about your property
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Property Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Luxury Villa in Al Olaya"
                  value={form.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Property Type *</Label>
                <Select value={form.type} onValueChange={(value) => updateForm("type", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your property's features, amenities, and unique selling points..."
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Purpose */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Purpose</CardTitle>
            <CardDescription>
              Set your price and listing purpose
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose *</Label>
                <Select value={form.purpose} onValueChange={(value) => updateForm("purpose", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">For Rent</SelectItem>
                    <SelectItem value="sale">For Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">
                  Price (SAR) * {form.purpose === "rent" && "per month"}
                </Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="e.g., 15000"
                  value={form.price}
                  onChange={(e) => updateForm("price", e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Details */}
        <Card>
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
            <CardDescription>
              Specify the physical characteristics of your property
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  min="0"
                  placeholder="e.g., 3"
                  value={form.bedrooms}
                  onChange={(e) => updateForm("bedrooms", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min="1"
                  placeholder="e.g., 2"
                  value={form.bathrooms}
                  onChange={(e) => updateForm("bathrooms", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="areaSqm">Area (m²)</Label>
                <Input
                  id="areaSqm"
                  type="number"
                  placeholder="e.g., 150"
                  value={form.areaSqm}
                  onChange={(e) => updateForm("areaSqm", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="furnished"
                  checked={form.furnished}
                  onCheckedChange={(checked) => updateForm("furnished", !!checked)}
                />
                <Label htmlFor="furnished">Furnished</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="parking"
                  checked={form.parking}
                  onCheckedChange={(checked) => updateForm("parking", !!checked)}
                />
                <Label htmlFor="parking">Parking Available</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
            <CardDescription>
              Specify where your property is located
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Select value={form.city} onValueChange={(value) => updateForm("city", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {saudiCities.map((city) => (
                      <SelectItem key={city.value} value={city.value}>
                        {city.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="neighborhood">Neighborhood</Label>
                <Input
                  id="neighborhood"
                  placeholder="e.g., Al Olaya"
                  value={form.neighborhood}
                  onChange={(e) => updateForm("neighborhood", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Full Address</Label>
              <Input
                id="address"
                placeholder="Enter the complete address"
                value={form.address}
                onChange={(e) => updateForm("address", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4">
          <Link href="/dashboard/properties">
            <Button variant="outline" disabled={loading}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              "Creating..."
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                List Property
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}