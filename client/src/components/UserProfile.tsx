import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { FirebaseUser } from "@/lib/firebase";

interface UserProps {
  user: Partial<FirebaseUser>;
}

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

export default function UserProfile({ user }: UserProps) {
  const { toast } = useToast();
  const { updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: user.name || "",
    age: user.age || "",
    bloodType: user.bloodType || "",
    allergies: user.allergies || "",
    photoURL: user.photoURL || "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File size should be less than 5MB");
      return;
    }
    setProfileImage(file);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let photoURL = user.photoURL;
      if (profileImage) {
        setIsUploading(true);
        try {
          photoURL = await uploadToCloudinary(profileImage);
          toast({
            title: "Photo updated",
            description: "Your profile picture was saved.",
          });
        } catch (uploadError: any) {
          setError(uploadError.message || "Failed to upload image");
          return;
        } finally {
          setIsUploading(false);
        }
      }

      const profileData: Partial<FirebaseUser> = {
        name: formData.name,
        bloodType: formData.bloodType,
        allergies: formData.allergies,
        photoURL,
      };
      if (formData.age) {
        profileData.age = parseInt(formData.age.toString(), 10);
      }

      await updateProfile(profileData);
      toast({
        title: "Profile updated",
        description: "Your details were saved.",
      });
      setIsEditing(false);
    } catch (submitError: any) {
      setError(submitError.message || "Failed to update profile.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {user.photoURL ? (
              <AvatarImage src={user.photoURL} alt={user.name} />
            ) : (
              <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                {user.name?.charAt(0) || "U"}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Medical information
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Age</span>
              <span className="font-medium">{user.age || "Not specified"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Blood type</span>
              <span className="font-medium">
                {user.bloodType || "Not specified"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Allergies</span>
              <span className="font-medium">
                {user.allergies || "None specified"}
              </span>
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          variant="outline"
          onClick={() => setIsEditing(true)}
        >
          Edit profile
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-2 flex flex-col items-center">
        <Avatar className="mb-4 h-24 w-24">
          {profileImage ? (
            <AvatarImage src={URL.createObjectURL(profileImage)} alt="Preview" />
          ) : user.photoURL ? (
            <AvatarImage src={user.photoURL} alt={user.name} />
          ) : (
            <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
              {user.name?.charAt(0) || "U"}
            </AvatarFallback>
          )}
        </Avatar>
        <Label htmlFor="photo" className="cursor-pointer text-sm font-medium text-primary">
          {isUploading ? "Uploading…" : "Change profile photo"}
          <Input
            id="photo"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
            disabled={isUploading}
          />
        </Label>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            name="age"
            type="number"
            value={formData.age}
            onChange={handleInputChange}
            placeholder="Your age"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bloodType">Blood type</Label>
          <Select value={formData.bloodType} onValueChange={(v) => setFormData((p) => ({ ...p, bloodType: v }))}>
            <SelectTrigger id="bloodType">
              <SelectValue placeholder="Select blood type" />
            </SelectTrigger>
            <SelectContent>
              {bloodTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="allergies">Allergies</Label>
          <Textarea
            id="allergies"
            name="allergies"
            value={formData.allergies}
            onChange={handleInputChange}
            placeholder="List your allergies"
            rows={3}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => setIsEditing(false)}
          disabled={isLoading || isUploading}
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading || isUploading}>
          {isLoading || isUploading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
