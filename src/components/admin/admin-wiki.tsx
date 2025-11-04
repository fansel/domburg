"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  CalendarDays, 
  Link as LinkIcon, 
  Info, 
  Mail, 
  Euro, 
  Settings, 
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Sparkle,
  Key,
  X,
  CheckSquare,
  Plus,
  Edit,
  Save,
  Trash2,
  Unlink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface WikiSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const sections: WikiSection[] = [
  { id: "overview", title: "Übersicht", icon: BookOpen, color: "bg-blue-500" },
  { id: "bookings", title: "Buchungen", icon: CalendarDays, color: "bg-green-500" },
  { id: "manual-blockings", title: "Manuelle Blockierungen", icon: Calendar, color: "bg-purple-500" },
  { id: "grouping", title: "Event-Gruppierung", icon: LinkIcon, color: "bg-orange-500" },
  { id: "info-events", title: "Info-Events", icon: Info, color: "bg-teal-500" },
  { id: "email-templates", title: "Email-Templates", icon: Mail, color: "bg-pink-500" },
  { id: "pricing", title: "Preisverwaltung", icon: Euro, color: "bg-yellow-500" },
  { id: "settings", title: "Einstellungen", icon: Settings, color: "bg-gray-500" },
  { id: "cleaning", title: "Putzplan", icon: Sparkles, color: "bg-cyan-500" },
];

export function AdminWiki() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["overview"]));
  const [navExpanded, setNavExpanded] = useState(false);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Navigation - Auf Smartphones kollabierbar, auf Desktop sticky */}
      <Card className="sticky top-20 z-40 shadow-md hidden md:block">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg sm:text-xl">Schnellnavigation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSections.has(section.id);
              return (
                <Button
                  key={section.id}
                  variant={isExpanded ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    toggleSection(section.id);
                    // Scroll zu Section
                    setTimeout(() => {
                      document.getElementById(`section-${section.id}`)?.scrollIntoView({ 
                        behavior: "smooth", 
                        block: "start" 
                      });
                    }, 100);
                  }}
                  className="justify-start text-xs sm:text-sm"
                >
                  <Icon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">{section.title}</span>
                  <span className="sm:hidden">{section.title.split(" ")[0]}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mobile Navigation - Kollabierbar am unteren Rand */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
        <Button
          variant="outline"
          className="w-full rounded-none border-0 border-b"
          onClick={() => setNavExpanded(!navExpanded)}
        >
          <ChevronDown className={cn("h-4 w-4 mr-2 transition-transform", navExpanded && "rotate-180")} />
          Schnellnavigation
        </Button>
        {navExpanded && (
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isExpanded = expandedSections.has(section.id);
                return (
                  <Button
                    key={section.id}
                    variant={isExpanded ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      toggleSection(section.id);
                      setNavExpanded(false);
                      // Scroll zu Section
                      setTimeout(() => {
                        document.getElementById(`section-${section.id}`)?.scrollIntoView({ 
                          behavior: "smooth", 
                          block: "start" 
                        });
                      }, 100);
                    }}
                    className="justify-start text-xs"
                  >
                    <Icon className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{section.title}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Padding am unteren Rand für Mobile Navigation */}
      <div className="md:hidden h-16"></div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Overview */}
        <WikiSection
          id="overview"
          title="Übersicht"
          icon={BookOpen}
          color="bg-blue-500"
          expanded={expandedSections.has("overview")}
          onToggle={() => toggleSection("overview")}
        >
          <div className="space-y-4">
            <p className="text-sm sm:text-base text-muted-foreground">
              Willkommen im Admin-Wiki! Dieses Handbuch erklärt alle Funktionen des Buchungssystems.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Hauptfunktionen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Buchungsverwaltung</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Manuelle Kalender-Blockierungen</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Event-Gruppierung</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Preisverwaltung</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Email-Templates</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Navigation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    <span><strong>Anfragen:</strong> Buchungsanfragen verwalten</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span><strong>Kalender:</strong> Vollständige Kalenderansicht</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-yellow-500" />
                    <span><strong>Preise:</strong> Preisphasen verwalten</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-gray-500" />
                    <span><strong>Einstellungen:</strong> Systemeinstellungen</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </WikiSection>

        {/* Buchungen */}
        <WikiSection
          id="bookings"
          title="Buchungen"
          icon={CalendarDays}
          color="bg-green-500"
          expanded={expandedSections.has("bookings")}
          onToggle={() => toggleSection("bookings")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Buchungsstatus</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <Badge variant="secondary" className="mb-1 bg-yellow-500 text-yellow-950">Ausstehend</Badge>
                    <p className="text-sm text-muted-foreground">
                      Neue Buchungsanfrage, wartet auf Genehmigung oder Ablehnung.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <Badge variant="secondary" className="mb-1 bg-green-500 text-green-950">Genehmigt</Badge>
                    <p className="text-sm text-muted-foreground">
                      Buchung wurde genehmigt und ist aktiv. Event wird im Google Calendar erstellt.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <Badge variant="secondary" className="mb-1 bg-red-500 text-red-950">Abgelehnt</Badge>
                    <p className="text-sm text-muted-foreground">
                      Buchung wurde abgelehnt. Gast wird per Email benachrichtigt.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                  <XCircle className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <Badge variant="secondary" className="mb-1 bg-gray-500 text-gray-950">Storniert</Badge>
                    <p className="text-sm text-muted-foreground">
                      Buchung wurde storniert. Event wird aus Google Calendar entfernt.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Buchung bearbeiten</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>Öffne die Buchungsanfrage in <strong>Anfragen</strong></li>
                <li>Klicke auf die Buchung, um Details zu sehen</li>
                <li>Klicke auf <strong>"Bearbeiten"</strong> um Daten zu ändern</li>
                <li>Änderungen werden sofort im Google Calendar übernommen</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Buchung stornieren</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>Öffne die Buchungsdetails</li>
                <li className="flex items-center gap-2">
                  <span>Klicke auf</span>
                  <ActionButton icon={Trash2} label="Stornieren" variant="destructive" />
                </li>
                <li>Gib einen Grund für die Stornierung an</li>
                <li>Das Event wird aus dem Google Calendar entfernt</li>
                <li>Der Gast wird automatisch per Email benachrichtigt</li>
              </ol>
            </div>
          </div>
        </WikiSection>

        {/* Manuelle Blockierungen */}
        <WikiSection
          id="manual-blockings"
          title="Manuelle Blockierungen"
          icon={Calendar}
          color="bg-purple-500"
          expanded={expandedSections.has("manual-blockings")}
          onToggle={() => toggleSection("manual-blockings")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Was sind manuelle Blockierungen?</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Manuelle Blockierungen sind Kalender-Einträge, die <strong>direkt im Google Kalender</strong> erstellt werden 
                und <strong>nicht über das Buchungssystem</strong> kommen. Sie unterscheiden sich von Buchungen dadurch, dass sie 
                nicht durch Gäste über das Buchungsformular erstellt wurden.
              </p>
              <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-sm sm:text-base mb-2">Unterschied zu Buchungen:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm sm:text-base">
                  <div>
                    <p className="font-medium text-muted-foreground mb-2">Buchungen:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Werden über das Buchungssystem erstellt</li>
                      <li>Stammen von Gästen (Buchungsanfragen)</li>
                      <li>Haben Gast-Informationen (Name, Email, etc.)</li>
                      <li>Können <strong>nicht</strong> gruppiert werden</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground mb-2">Manuelle Blockierungen:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Werden direkt im Google Kalender erstellt</li>
                      <li>Stammen von Admins (manuell erstellt)</li>
                      <li>Haben keine Gast-Informationen</li>
                      <li>Können gruppiert werden</li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground mt-4">
                Manuelle Blockierungen werden verwendet für: Wartungsarbeiten, persönliche Nutzung, private Events, 
                oder andere Zeiträume, die blockiert werden sollen, ohne dass eine Buchung vorliegt.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Manuelle Blockierung erstellen</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={CalendarDays} label="Anfragen" />
                    <span>→</span>
                    <NavTab icon={Calendar} label="Kalender" />
                  </NavigationStep>
                </li>
                <li className="flex items-center gap-2">
                  <span>Klicke auf</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                    <Plus className="h-3 w-3 mr-1.5" />
                    + Neue Blockierung
                  </Button>
                </li>
                <li>Fülle die Felder aus:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li><strong>Titel:</strong> Beschreibung der Blockierung (z.B. "Wartungsarbeiten")</li>
                    <li><strong>Start:</strong> Beginn der Blockierung</li>
                    <li><strong>Ende:</strong> Ende der Blockierung</li>
                    <li><strong>Info-Event:</strong> Wenn aktiviert, blockiert das Event nicht (siehe Info-Events)</li>
                  </ul>
                </li>
                <li className="flex items-center gap-2">
                  <span>Klicke auf</span>
                  <ActionButton icon={Save} label="Erstellen" />
                </li>
                <li>Das Event wird im Google Calendar erstellt und blockiert den Zeitraum</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Manuelle Blockierung bearbeiten</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={CalendarDays} label="Anfragen" />
                    <span>→</span>
                    <NavTab icon={Calendar} label="Kalender" />
                  </NavigationStep>
                </li>
                <li>Klicke auf die Blockierung, die du bearbeiten möchtest</li>
                <li className="flex items-center gap-2">
                  <span>Klicke auf</span>
                  <ActionButton icon={Edit} label="Bearbeiten" />
                </li>
                <li>Ändere Titel, Start- oder Enddatum</li>
                <li>Änderungen werden sofort im Google Calendar übernommen</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Wo werden manuelle Blockierungen angezeigt?</h3>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li><strong>Admin Kalender:</strong> Im Kalender-View unter "Alle Buchungen"</li>
                <li><strong>Anfragen → Kalender:</strong> In der Liste aller manuellen Blockierungen</li>
                <li><strong>Google Calendar:</strong> Direkt im verknüpften Google Calendar</li>
                <li><strong>Putzplan:</strong> Werden für Reinigungsplanung berücksichtigt</li>
              </ul>
            </div>
          </div>
        </WikiSection>

        {/* Event-Gruppierung */}
        <WikiSection
          id="grouping"
          title="Event-Gruppierung"
          icon={LinkIcon}
          color="bg-orange-500"
          expanded={expandedSections.has("grouping")}
          onToggle={() => toggleSection("grouping")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Was ist Event-Gruppierung?</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Gruppierte Events werden als zusammengehörig behandelt. Im Putzplan werden sie als ein einzelnes Event 
                behandelt, sodass zwischen ihnen keine Reinigung geplant wird.
              </p>
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-sm sm:text-base mb-2 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Wichtiger Hinweis
                </h4>
                <p className="text-sm sm:text-base text-muted-foreground">
                  <strong>Nur manuelle Blockierungen können gruppiert werden!</strong> Buchungen, die über das Buchungssystem 
                  erstellt wurden, können <strong>nicht</strong> gruppiert werden, da davon ausgegangen wird, dass sie immer von 
                  unterschiedlichen Personen stammen. Buchungen bleiben daher immer getrennt.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2 flex items-center gap-2">
                <Sparkle className="h-5 w-5 text-orange-500" />
                Automatische Gruppierung
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                <strong>Nur manuelle Blockierungen</strong> werden <strong>automatisch</strong> gruppiert, wenn:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground ml-2">
                <li>Sie die <strong>gleiche Farbe</strong> haben</li>
                <li>Sie sich um <strong>mehr als 1 Tag überlappen</strong></li>
                <li>Sie sind <strong>keine Buchungen</strong> (nur manuelle Blockierungen)</li>
                <li>Beispiel: Manuelle Blockierung A (1. - 5. Januar) und Blockierung B (3. - 8. Januar) überlappen 3 Tage → automatisch gruppiert</li>
              </ul>
              <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <p className="text-sm sm:text-base text-muted-foreground">
                  <strong>Wichtig:</strong> Bei automatischer Gruppierung werden die Events auch im <strong>Google Kalender</strong> verlinkt 
                  und in der Datenbank als zusammengehörig gespeichert. Sie erhalten die gleiche Farbe und werden im Putzplan als ein Event behandelt.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2 flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-orange-500" />
                Manuelle Gruppierung
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                <strong>Nur manuelle Blockierungen</strong> müssen <strong>manuell</strong> gruppiert werden, wenn:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground ml-2">
                <li>Sie die <strong>gleiche Farbe</strong> haben</li>
                <li>Sie sich nur an <strong>einem Tag berühren</strong> (Check-out Tag X = Check-in Tag X)</li>
                <li>Sie sind <strong>keine Buchungen</strong> (nur manuelle Blockierungen)</li>
                <li>Beispiel: Manuelle Blockierung A endet am 5. Januar, Blockierung B beginnt am 5. Januar</li>
              </ul>

              <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <h4 className="font-semibold text-sm sm:text-base mb-2">Manuelle Gruppierung durchführen:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                  <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={CalendarDays} label="Anfragen" />
                    <span>→</span>
                    <NavTab icon={Calendar} label="Kalender" />
                  </NavigationStep>
                </li>
                  <li>Aktiviere die <CheckSquare className="inline h-4 w-4 mx-1 text-blue-600" /> Checkboxen bei den <strong>manuellen Blockierungen</strong>, die gruppiert werden sollen</li>
                  <li><strong>Hinweis:</strong> Buchungen können nicht ausgewählt/gruppiert werden</li>
                  <li className="flex items-center gap-2">
                    <span>Klicke auf</span>
                    <ActionButton icon={LinkIcon} label="Ausgewählte zusammenlegen" />
                  </li>
                  <li>Die Events erhalten die gleiche Farbe im <strong>Google Kalender</strong></li>
                  <li>Die Events werden in der Datenbank verlinkt</li>
                  <li>Im Putzplan werden sie als ein Event behandelt</li>
                </ol>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Gruppierung aufheben</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={CalendarDays} label="Anfragen" />
                    <span>→</span>
                    <NavTab icon={Calendar} label="Kalender" />
                  </NavigationStep>
                </li>
                <li>Wähle die gruppierten Events aus (grüner Rahmen zeigt Gruppierung)</li>
                <li className="flex items-center gap-2">
                  <span>Klicke auf</span>
                  <ActionButton icon={Unlink} label="Ausgewählte trennen" />
                </li>
                <li>Jedes Event erhält eine eigene, eindeutige Farbe</li>
                <li>Die Verlinkung wird aus der Datenbank entfernt</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Gruppierte Events erkennen</h3>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>In <strong>Anfragen → Kalender</strong>: Grüner Rahmen um das Event</li>
                <li>Badge <strong>"X verlinkt"</strong> zeigt an, wie viele Events verlinkt sind</li>
                <li>Klicke auf ein gruppiertes Event, um alle verlinkten Events zu sehen</li>
                <li>Im Admin Kalender: Gruppierte Events werden als zusammengehörig angezeigt</li>
              </ul>
            </div>
          </div>
        </WikiSection>

        {/* Info-Events */}
        <WikiSection
          id="info-events"
          title="Info-Events"
          icon={Info}
          color="bg-teal-500"
          expanded={expandedSections.has("info-events")}
          onToggle={() => toggleSection("info-events")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Was sind Info-Events?</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Info-Events sind Kalender-Einträge, die <strong>nicht blockieren</strong>. Sie werden im Google Calendar 
                angezeigt, erscheinen aber nicht im Hauptkalender und blockieren keine neuen Buchungen.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Info-Event erstellen</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={CalendarDays} label="Anfragen" />
                    <span>→</span>
                    <NavTab icon={Calendar} label="Kalender" />
                  </NavigationStep>
                </li>
                <li>Klicke auf <strong>"+ Neue Blockierung"</strong></li>
                <li>Aktiviere das Häkchen <strong>"Info-Event"</strong></li>
                <li>Fülle Titel, Start und Ende aus</li>
                <li>Das Event wird mit grüner Farbe (Basilikum) erstellt</li>
                <li>Es blockiert <strong>nicht</strong> und erscheint nicht im Hauptkalender</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Event als Info markieren</h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm sm:text-base mb-2">Im Kalender:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                    <li>Öffne den Admin Kalender</li>
                    <li>Klicke auf das <Info className="inline h-4 w-4 mx-1 text-teal-600" /> Icon direkt auf dem Event-Badge</li>
                    <li>Bestätige die Aktion im Dialog</li>
                    <li>Das Event wird sofort als Info markiert und verschwindet aus dem Kalender</li>
                  </ol>
                </div>
                <div>
                  <h4 className="font-medium text-sm sm:text-base mb-2">In der Detailansicht:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                    <li>Klicke auf ein Event im Kalender, um Details zu sehen</li>
                    <li>Klicke auf <strong>"Als Info markieren"</strong></li>
                    <li>Bestätige die Aktion</li>
                    <li>Das Event wird als Info markiert</li>
                  </ol>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Info-Markierung entfernen</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={CalendarDays} label="Anfragen" />
                    <span>→</span>
                    <NavTab icon={Calendar} label="Kalender" />
                  </NavigationStep>
                </li>
                <li>Filtere nach <strong>"Info-Events"</strong></li>
                <li>Klicke auf das Event mit dem Info-Badge</li>
                <li>Klicke auf <strong>"Info entfernen"</strong> <X className="inline h-4 w-4 mx-1 text-red-600" /></li>
                <li>Das Event blockiert wieder und erscheint im Hauptkalender</li>
              </ol>
            </div>

            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
              <h4 className="font-semibold text-sm sm:text-base mb-2">Wichtige Hinweise:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-muted-foreground">
                <li>Info-Events werden im <strong>Putzplan nicht berücksichtigt</strong></li>
                <li>Info-Events <strong>blockieren keine neuen Buchungen</strong></li>
                <li>Info-Events sind nur im Google Calendar und in der Kalender-Übersicht sichtbar</li>
                <li>Verwendung: Wartungsarbeiten, persönliche Notizen, Erinnerungen</li>
              </ul>
            </div>
          </div>
        </WikiSection>

        {/* Email-Templates */}
        <WikiSection
          id="email-templates"
          title="Email-Templates"
          icon={Mail}
          color="bg-pink-500"
          expanded={expandedSections.has("email-templates")}
          onToggle={() => toggleSection("email-templates")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Was sind Email-Templates?</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Email-Templates sind vorgefertigte Email-Vorlagen, die automatisch an Gäste gesendet werden. 
                Sie können mit Variablen personalisiert werden.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Template bearbeiten</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={Settings} label="Einstellungen" />
                    <span>→</span>
                    <NavTab icon={Mail} label="Email" />
                  </NavigationStep>
                </li>
                <li>Wähle das Template aus, das du bearbeiten möchtest</li>
                <li className="flex items-center gap-2">
                  <span>Klicke auf</span>
                  <ActionButton icon={Edit} label="Bearbeiten" />
                </li>
                <li>Ändere Betreff, HTML- oder Text-Version</li>
                <li>Nutze die Vorschau, um das Ergebnis zu sehen</li>
                <li>Klicke auf <strong>"Speichern"</strong></li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Verfügbare Variablen</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <code className="p-2 bg-muted rounded">{`{{guestName}}`}</code>
                <code className="p-2 bg-muted rounded">{`{{bookingCode}}`}</code>
                <code className="p-2 bg-muted rounded">{`{{startDate}}`}</code>
                <code className="p-2 bg-muted rounded">{`{{endDate}}`}</code>
                <code className="p-2 bg-muted rounded">{`{{totalPrice}}`}</code>
                <code className="p-2 bg-muted rounded">{`{{numberOfNights}}`}</code>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Diese Variablen werden automatisch durch die entsprechenden Werte ersetzt.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Template zurücksetzen</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={Settings} label="Einstellungen" />
                    <span>→</span>
                    <NavTab icon={Mail} label="Email" />
                  </NavigationStep>
                </li>
                <li>Klicke auf <strong>"Zurücksetzen"</strong> beim gewünschten Template</li>
                <li>Das Template wird auf die Standard-Version zurückgesetzt</li>
              </ol>
            </div>
          </div>
        </WikiSection>

        {/* Preisverwaltung */}
        <WikiSection
          id="pricing"
          title="Preisverwaltung"
          icon={Euro}
          color="bg-yellow-500"
          expanded={expandedSections.has("pricing")}
          onToggle={() => toggleSection("pricing")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Preisphasen</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Preisphasen definieren unterschiedliche Preise für verschiedene Zeiträume (z.B. Hauptsaison, Nebensaison).
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Preisphase erstellen</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>Gehe zu <strong>Preise</strong></li>
                <li>Klicke auf <strong>"+ Preisphase hinzufügen"</strong></li>
                <li>Fülle die Felder aus:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li><strong>Name:</strong> z.B. "Hauptsaison"</li>
                    <li><strong>Start/Ende:</strong> Zeitraum der Phase</li>
                    <li><strong>Preis pro Nacht:</strong> Standard-Preis</li>
                    <li><strong>Family-Preis:</strong> (optional) Preis für Familien</li>
                    <li><strong>Mindestnächte:</strong> (optional) Mindestanzahl Nächte</li>
                    <li><strong>Samstag zu Samstag:</strong> Nur Wochenbuchungen erlauben</li>
                    <li><strong>Priorität:</strong> Höhere Priorität überschreibt niedrigere</li>
                  </ul>
                </li>
                <li>Klicke auf <strong>"Speichern"</strong></li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Strandbuden-Sessions</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Strandbuden-Sessions definieren Zeiträume, in denen die Strandbude verfügbar ist.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={Euro} label="Preise" />
                    <span>→</span>
                    <NavTab icon={Sparkles} label="Strandbuden" />
                  </NavigationStep>
                </li>
                <li>Klicke auf <strong>"+ Session hinzufügen"</strong></li>
                <li>Definiere Name, Start und Ende der Session</li>
                <li>Die Strandbude ist nur in diesen Zeiträumen buchbar</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Basis-Einstellungen</h3>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li><strong>Basis-Preis:</strong> Standard-Preis pro Nacht (Standard/Family)</li>
                <li><strong>Endreinigung:</strong> Pauschale für Endreinigung</li>
                <li><strong>Strandbuden-Preis:</strong> Preis pro Woche/Tag für Strandbude</li>
              </ul>
            </div>
          </div>
        </WikiSection>

        {/* Einstellungen */}
        <WikiSection
          id="settings"
          title="Einstellungen"
          icon={Settings}
          color="bg-gray-500"
          expanded={expandedSections.has("settings")}
          onToggle={() => toggleSection("settings")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Gast-Codes</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Zugangscodes ermöglichen den Zugriff ohne Passwort. Es gibt zwei verschiedene Arten von Codes mit unterschiedlichen Berechtigungen.
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h4 className="font-semibold text-sm sm:text-base mb-2 flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-600" />
                    Gast-Zugangscode (GUEST)
                  </h4>
                  <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                    <li><strong>Berechtigung:</strong> Buchungen erstellen und verwalten</li>
                    <li><strong>Zugriff:</strong> Hauptseite, Buchungsformular, eigene Buchungen</li>
                    <li><strong>Erstellung:</strong> Muss manuell in Einstellungen → Gast-Codes erstellt werden</li>
                    <li><strong>Family-Preis:</strong> Kann optional den ermäßigten Family-Preis aktivieren</li>
                  </ul>
                </div>

                <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
                  <h4 className="font-semibold text-sm sm:text-base mb-2 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-cyan-600" />
                    Housekeeping-Zugangscode (CLEANING)
                  </h4>
                  <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                    <li><strong>Berechtigung:</strong> Nur Putzplan/Kalenderansicht</li>
                    <li><strong>Zugriff:</strong> Putzplan-Seite (<code className="text-xs bg-muted px-1 py-0.5 rounded">/housekeeping</code>)</li>
                    <li><strong>Verwendung:</strong> Für Putzhilfen/Haushaltshilfen</li>
                    <li><strong>Kein Zugriff:</strong> Auf Buchungen, Einstellungen oder andere Admin-Funktionen</li>
                    <li><strong>Manuell erstellen:</strong> Muss in Einstellungen → Gast-Codes erstellt werden</li>
                  </ul>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold text-sm sm:text-base mb-2">Code erstellen</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                  <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={Settings} label="Einstellungen" />
                    <span>→</span>
                    <NavTab icon={Key} label="Gast-Codes" />
                  </NavigationStep>
                </li>
                  <li className="flex items-center gap-2">
                    <span>Klicke auf</span>
                    <ActionButton icon={Plus} label="+ Code erstellen" />
                  </li>
                  <li>Wähle den <strong>Zugangstyp</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li><strong>Gast:</strong> Für normale Buchungen</li>
                      <li><strong>Housekeeping:</strong> Für Putzplan-Zugang</li>
                    </ul>
                  </li>
                  <li>Fülle optional aus:
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li><strong>Beschreibung:</strong> Wofür ist der Code</li>
                      <li><strong>Max. Nutzungen:</strong> Wie oft kann der Code verwendet werden</li>
                      <li><strong>Ablaufdatum:</strong> Wann läuft der Code ab</li>
                      <li><strong>Family-Preis:</strong> (nur bei Gast-Codes) Ermäßigten Preis aktivieren</li>
                    </ul>
                  </li>
                  <li>Der Code wird automatisch generiert und kann sofort verwendet werden</li>
                </ol>
              </div>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-semibold text-sm sm:text-base mb-2">Wichtige Hinweise:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-muted-foreground">
                  <li>Alle Zugangscodes (Gast und Housekeeping) müssen <strong>manuell</strong> erstellt werden</li>
                  <li>Codes können aktiviert/deaktiviert werden, ohne sie zu löschen</li>
                  <li>Die Nutzungsanzahl wird automatisch gezählt</li>
                  <li>Abgelaufene oder deaktivierte Codes funktionieren nicht mehr</li>
                  <li>Wenn ein Gast einen Code verwendet, wird dieser in der Buchung gespeichert</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Admin-Verwaltung</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={Settings} label="Einstellungen" />
                    <span>→</span>
                    <NavTab icon={ShieldCheck} label="Admins" />
                  </NavigationStep>
                </li>
                <li>Hier kannst du Admin-Benutzer verwalten</li>
                <li>Berechtigungen setzen:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li><strong>Buchungen sehen:</strong> Zugriff auf Buchungsverwaltung</li>
                    <li><strong>Preise verwalten:</strong> Zugriff auf Preisverwaltung</li>
                  </ul>
                </li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Google Calendar (nur SUPERADMIN)</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li>
                  <NavigationStep>
                    <span>Gehe zu</span>
                    <NavButton icon={Settings} label="Einstellungen" />
                    <span>→</span>
                    <NavTab icon={Calendar} label="Kalender" />
                  </NavigationStep>
                </li>
                <li>Hier wird die Google Calendar Integration konfiguriert</li>
                <li>Calendar-ID und Authentifizierung einrichten</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Email-Einstellungen</h3>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li><strong>Reply-To:</strong> Email-Adresse für Antworten</li>
                <li><strong>SMTP:</strong> Email-Server Konfiguration (nur SUPERADMIN)</li>
                <li><strong>Email-Logs:</strong> Versandhistorie aller Emails</li>
              </ul>
            </div>
          </div>
        </WikiSection>

        {/* Putzplan */}
        <WikiSection
          id="cleaning"
          title="Putzplan"
          icon={Sparkles}
          color="bg-cyan-500"
          expanded={expandedSections.has("cleaning")}
          onToggle={() => toggleSection("cleaning")}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Wie funktioniert der Putzplan?</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Der Putzplan erkennt automatisch, wann Reinigungen notwendig sind, basierend auf Check-in und Check-out Daten.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Reinigungsplanung</h3>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                <li><strong>Check-out:</strong> Reinigung wird am Check-out Tag geplant</li>
                <li><strong>Check-in:</strong> Reinigung wird am Check-in Tag geplant</li>
                <li><strong>Gruppierte Events:</strong> Zwischen gruppierten Events wird keine Reinigung geplant</li>
                <li><strong>Info-Events:</strong> Werden nicht berücksichtigt</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Gruppierte Events</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Wenn Events gruppiert sind (verlinkt), werden sie als ein zusammenhängendes Event behandelt. 
                Das bedeutet: Wenn Event A am 5. Januar endet und Event B am 5. Januar beginnt und beide gruppiert sind, 
                wird zwischen ihnen <strong>keine</strong> Reinigung geplant.
              </p>
              <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                <p className="text-sm sm:text-base font-medium mb-2">Beispiel:</p>
                <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-muted-foreground">
                  <li>Event A: 1. - 5. Januar (Check-out 5. Januar)</li>
                  <li>Event B: 5. - 10. Januar (Check-in 5. Januar)</li>
                  <li>Wenn gruppiert: <strong>Keine Reinigung</strong> am 5. Januar</li>
                  <li>Wenn nicht gruppiert: <strong>Reinigung</strong> am 5. Januar</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Putzplan ansehen</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3">
                Der Putzplan ist über eine spezielle Seite zugänglich, die mit einem Housekeeping-Zugangscode geschützt ist.
              </p>
              
              <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800 mb-4">
                <h4 className="font-semibold text-sm sm:text-base mb-2 flex items-center gap-2">
                  <Key className="h-5 w-5 text-cyan-600" />
                  Zugang zum Putzplan
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                  <li>
                    <span>Erstelle einen <strong>Housekeeping-Zugangscode</strong> in</span>
                    <NavigationStep>
                      <NavButton icon={Settings} label="Einstellungen" />
                      <span>→</span>
                      <NavTab icon={Key} label="Gast-Codes" />
                    </NavigationStep>
                  </li>
                  <li>Wähle beim Erstellen den Typ <strong>"Housekeeping"</strong> aus</li>
                  <li>Gib den Code an die Putzhilfe/Haushaltshilfe weiter</li>
                  <li>Die Putzhilfe kann sich unter <code className="text-xs bg-muted px-1 py-0.5 rounded">/housekeeping</code> mit diesem Code anmelden</li>
                  <li>Der Code gewährt <strong>nur</strong> Zugriff auf den Putzplan, keine anderen Funktionen</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold text-sm sm:text-base mb-2">Was zeigt der Putzplan?</h4>
                <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                  <li><strong>Ankunftstage:</strong> Wann Gäste ankommen (Check-in)</li>
                  <li><strong>Abreisetage:</strong> Wann Gäste abreisen (Check-out)</li>
                  <li><strong>Belegte Zeiten:</strong> Welche Zeiträume bereits gebucht sind</li>
                  <li><strong>Reinigungstage:</strong> Wann Reinigungen geplant sind</li>
                  <li><strong>Freie Zeiten:</strong> Verfügbare Zeitfenster zwischen Check-out (11:00) und Check-in (15:00)</li>
                </ul>
              </div>

              <div className="mt-4">
                <h4 className="font-semibold text-sm sm:text-base mb-2">Technische Details</h4>
                <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-muted-foreground">
                  <li>Der Putzplan wird über die API <code className="text-xs bg-muted px-1 py-0.5 rounded">/api/cleaning/calendar</code> bereitgestellt</li>
                  <li>Er berücksichtigt alle Buchungen und manuelle Blockierungen</li>
                  <li>Gruppierte Events werden automatisch erkannt (keine Reinigung zwischen ihnen)</li>
                  <li>Info-Events werden ignoriert</li>
                </ul>
              </div>
            </div>
          </div>
        </WikiSection>
      </div>
    </div>
  );
}

interface WikiSectionProps {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

// Helper-Komponenten für Navigation
function NavigationStep({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-2 flex-wrap">{children}</span>;
}

function NavButton({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>, label: string }) {
  return (
    <Button variant="default" size="sm" className="h-7 text-xs" disabled>
      <Icon className="h-3 w-3 mr-1.5" />
      {label}
    </Button>
  );
}

function NavTab({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>, label: string }) {
  return (
    <Tabs defaultValue="tab" className="inline-block">
      <TabsList className="h-7">
        <TabsTrigger value="tab" className="text-xs px-2 py-1">
          <Icon className="h-3 w-3 mr-1.5" />
          {label}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function ActionButton({ icon: Icon, label, variant = "default" }: { icon?: React.ComponentType<{ className?: string }>, label: string, variant?: "default" | "outline" | "destructive" }) {
  return (
    <Button variant={variant} size="sm" className="h-7 text-xs" disabled>
      {Icon && <Icon className="h-3 w-3 mr-1.5" />}
      {label}
    </Button>
  );
}

function WikiSection({ id, title, icon: Icon, color, expanded, onToggle, children }: WikiSectionProps) {
  return (
    <Card id={`section-${id}`} className="overflow-hidden">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", color)}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
          </div>
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

