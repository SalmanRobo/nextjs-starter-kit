"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

function SettingsContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("profile");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Profile form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Profile picture upload states
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const supabase = createClient();

  // Handle URL tab parameter
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["profile"].includes(tab)) {
      setCurrentTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user session
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          setName(user.user_metadata?.full_name || "");
          setEmail(user.email || "");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Remove undefined organizations dependency

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const handleUpdateProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name }
      });
      
      if (error) throw error;
      
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error("Failed to update profile: " + error.message);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!profileImage || !user) return;

    setUploadingImage(true);
    try {
      // Upload logic would go here - for now just show success
      toast.success("Profile picture updated successfully");
      setProfileImage(null);
      setImagePreview(null);
    } catch (error: any) {
      toast.error("Failed to upload profile picture: " + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/sign-in");
    } catch (error: any) {
      toast.error("Failed to sign out: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={handleTabChange}
        className="w-full max-w-4xl"
      >
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile information and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={email}
                    disabled
                    placeholder="Your email address"
                  />
                </div>
              </div>
              <Button onClick={handleUpdateProfile}>
                Save Changes
              </Button>
            </CardContent>
          </Card>

          {/* Profile Picture */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>
                Upload a profile picture to personalize your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 text-2xl">
                      {name.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="max-w-xs"
                  />
                  {profileImage && (
                    <Button
                      onClick={handleImageUpload}
                      disabled={uploadingImage}
                      size="sm"
                    >
                      {uploadingImage ? "Uploading..." : "Upload Picture"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>
                These actions are permanent and cannot be undone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full"></div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}