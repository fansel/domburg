"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Phone, Mail, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface ExposeContactManagerProps {
  initialContacts: {
    contact1Name: string;
    contact1Phone: string;
    contact1Mobile: string;
    contact1Email: string;
    contact2Name: string;
    contact2Phone: string;
    contact2Mobile: string;
    contact2Email: string;
    houseAddress: string;
    housePhone: string;
  };
}

export function ExposeContactManager({ initialContacts }: ExposeContactManagerProps) {
  const [contacts, setContacts] = useState(initialContacts);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/expose-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contacts),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Gespeichert",
          description: "Kontaktdaten wurden erfolgreich gespeichert",
        });
        router.refresh();
      } else {
        toast({
          title: "Fehler",
          description: data.error || "Kontaktdaten konnten nicht gespeichert werden",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-2 pb-4">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <CardTitle className="text-lg sm:text-xl">Kontaktdaten</CardTitle>
        </div>
        <CardDescription className="text-sm">
          Verwalten Sie die Kontaktdaten für das Exposé
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Haus-Adresse */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-gray-600" />
            <Label className="text-sm font-semibold">Haus-Adresse</Label>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="houseAddress" className="text-xs">Adresse</Label>
              <Input
                id="houseAddress"
                value={contacts.houseAddress}
                onChange={(e) => setContacts({ ...contacts, houseAddress: e.target.value })}
                placeholder="Prinsepark 7, 4357 HB Domburg"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="housePhone" className="text-xs">Telefon (Haus)</Label>
              <Input
                id="housePhone"
                value={contacts.housePhone}
                onChange={(e) => setContacts({ ...contacts, housePhone: e.target.value })}
                placeholder="+31-11858-1470"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Kontakt 1 */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <Label className="text-sm font-semibold">Kontakt 1</Label>
          <div className="space-y-3">
            <div>
              <Label htmlFor="contact1Name" className="text-xs">Name</Label>
              <Input
                id="contact1Name"
                value={contacts.contact1Name}
                onChange={(e) => setContacts({ ...contacts, contact1Name: e.target.value })}
                placeholder="Bettina Mansel"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact1Phone" className="text-xs">Telefon</Label>
              <Input
                id="contact1Phone"
                value={contacts.contact1Phone}
                onChange={(e) => setContacts({ ...contacts, contact1Phone: e.target.value })}
                placeholder="+49-221-6110818"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact1Mobile" className="text-xs">Mobil</Label>
              <Input
                id="contact1Mobile"
                value={contacts.contact1Mobile}
                onChange={(e) => setContacts({ ...contacts, contact1Mobile: e.target.value })}
                placeholder="+49-172-5253560"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact1Email" className="text-xs">E-Mail</Label>
              <Input
                id="contact1Email"
                type="email"
                value={contacts.contact1Email}
                onChange={(e) => setContacts({ ...contacts, contact1Email: e.target.value })}
                placeholder="bettina.mansel@gmx.de"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Kontakt 2 */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <Label className="text-sm font-semibold">Kontakt 2</Label>
          <div className="space-y-3">
            <div>
              <Label htmlFor="contact2Name" className="text-xs">Name</Label>
              <Input
                id="contact2Name"
                value={contacts.contact2Name}
                onChange={(e) => setContacts({ ...contacts, contact2Name: e.target.value })}
                placeholder="Dorothea Patt"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact2Phone" className="text-xs">Telefon</Label>
              <Input
                id="contact2Phone"
                value={contacts.contact2Phone}
                onChange={(e) => setContacts({ ...contacts, contact2Phone: e.target.value })}
                placeholder=""
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact2Mobile" className="text-xs">Mobil</Label>
              <Input
                id="contact2Mobile"
                value={contacts.contact2Mobile}
                onChange={(e) => setContacts({ ...contacts, contact2Mobile: e.target.value })}
                placeholder="+49-179-5350376"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact2Email" className="text-xs">E-Mail</Label>
              <Input
                id="contact2Email"
                type="email"
                value={contacts.contact2Email}
                onChange={(e) => setContacts({ ...contacts, contact2Email: e.target.value })}
                placeholder="dolupatt@gmail.com"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Speichere..." : "Speichern"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

