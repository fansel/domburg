"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

type ImagePlacement = "ABOVE" | "BELOW" | "GALLERY";

interface ExposeSection {
  id: string;
  title: string | null;
  content: string;
  order: number;
}

interface Expose {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  imageText: string | null;
  sectionId: string | null;
  placement: ImagePlacement;
  order: number;
  section?: ExposeSection | null;
}

export default function ExposePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [exposes, setExposes] = useState<Expose[]>([]);
  const [sections, setSections] = useState<ExposeSection[]>([]);
  const [contacts, setContacts] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const loadExposes = async () => {
      try {
        const response = await fetch("/api/expose");
        if (!response.ok) {
          throw new Error("Fehler beim Laden der Expose-Einträge");
        }
        const data = await response.json();
        const sortedExposes = Array.isArray(data.exposes)
          ? [...data.exposes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [];
        const sortedSections = Array.isArray(data.sections)
          ? [...data.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [];
        setExposes(sortedExposes);
        setSections(sortedSections);
        setContacts(data.contacts || null);
      } catch (error) {
        console.error("Error loading exposes:", error);
        toast({
          title: "Fehler",
          description: "Expose-Einträge konnten nicht geladen werden",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadExposes();
  }, [toast]);

  const sectionImagesMap = useMemo(() => {
    const map = new Map<string, { above: Expose[]; below: Expose[] }>();
    for (const expose of exposes) {
      if (expose.placement === "GALLERY" || !expose.sectionId) {
        continue;
      }
      const entry = map.get(expose.sectionId) ?? { above: [] as Expose[], below: [] as Expose[] };
      if (expose.placement === "ABOVE") {
        entry.above.push(expose);
      } else {
        entry.below.push(expose);
      }
      map.set(expose.sectionId, entry);
    }
    return map;
  }, [exposes]);

  const galleryImages = useMemo(
    () =>
      exposes.filter(
        (expose) => expose.placement === "GALLERY" || !expose.sectionId
      ),
    [exposes]
  );

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const renderTextWithLinks = (text: string, keyPrefix: string) => {
    const segments = text.split(urlRegex);
    return segments.map((segment, index) =>
      index % 2 === 1 ? (
        <a
          key={`${keyPrefix}-link-${index}`}
          href={segment}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8b7355] hover:underline break-words"
        >
          {segment}
        </a>
      ) : (
        <span key={`${keyPrefix}-text-${index}`} className="break-words">
          {segment}
        </span>
      )
    );
  };

  const renderSectionContent = (content: string, keyPrefix: string) => {
    const normalized = content.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const paragraphs: string[] = [];
    let buffer: string[] = [];

    lines.forEach((line) => {
      if (line.trim().length === 0) {
        if (buffer.length > 0) {
          paragraphs.push(buffer.join("\n"));
          buffer = [];
        } else {
          paragraphs.push("");
        }
      } else {
        buffer.push(line);
      }
    });

    if (buffer.length > 0) {
      paragraphs.push(buffer.join("\n"));
    }

    return paragraphs.map((paragraph, index) => {
      if (paragraph.trim().length === 0) {
        return <div key={`${keyPrefix}-gap-${index}`} className="h-4" />;
      }
      return (
        <p
          key={`${keyPrefix}-paragraph-${index}`}
          className="text-[#4a4844] leading-relaxed font-light mb-4 whitespace-pre-wrap"
        >
          {renderTextWithLinks(paragraph, `${keyPrefix}-paragraph-${index}`)}
        </p>
      );
    });
  };

  const renderImageDetails = (expose: Expose) => {
    if (!expose.title && !expose.description && !expose.imageText) {
      return null;
    }

    return (
      <div className="space-y-3 px-1">
        {expose.title && (
          <h3 className="text-lg font-light text-[#2c2a26] tracking-tight">
            {expose.title}
          </h3>
        )}
        {expose.description && (
          <p className="text-sm text-[#6b6a66] leading-relaxed font-light whitespace-pre-wrap">
            {expose.description}
          </p>
        )}
        {expose.imageText && (
          <p className="text-sm text-[#4a4844] leading-relaxed font-light whitespace-pre-wrap">
            {expose.imageText}
          </p>
        )}
      </div>
    );
  };

  const renderImages = (images: Expose[], keyPrefix: string) => {
    if (images.length === 0) {
      return null;
    }

    return (
      <>
        <div className="md:hidden mb-8">
          <Swiper
            modules={[Navigation, Pagination]}
            spaceBetween={0}
            slidesPerView={1}
            navigation
            pagination={{ clickable: true }}
          >
            {images.map((expose) => (
              <SwiperSlide key={`${keyPrefix}-mobile-${expose.id}`}>
                <div className="mb-6">
                  <div
                    className="relative bg-[#e8e6e3] aspect-[4/3] overflow-hidden mb-5 rounded-sm cursor-pointer"
                    onClick={() => openLightbox(expose)}
                  >
                    <img
                      src={expose.imageUrl}
                      alt={expose.title || "Expose"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {renderImageDetails(expose)}
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {images.map((expose) => (
            <div key={`${keyPrefix}-desktop-${expose.id}`} className="space-y-5">
              <div
                className="relative bg-[#e8e6e3] aspect-[4/3] overflow-hidden rounded-sm cursor-pointer transition-opacity hover:opacity-90"
                onClick={() => openLightbox(expose)}
              >
                <img
                  src={expose.imageUrl}
                  alt={expose.title || "Expose"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {renderImageDetails(expose)}
            </div>
          ))}
        </div>
      </>
    );
  };

  const openLightbox = (expose: Expose) => {
    const index = exposes.findIndex((e) => e.id === expose.id);
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    if (exposes.length === 0) return;
    if (direction === "prev") {
      setLightboxIndex((prev) => (prev > 0 ? prev - 1 : exposes.length - 1));
    } else {
      setLightboxIndex((prev) => (prev < exposes.length - 1 ? prev + 1 : 0));
    }
  };

  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : exposes.length - 1));
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev < exposes.length - 1 ? prev + 1 : 0));
      } else if (e.key === "Escape") {
        setLightboxOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, exposes.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (exposes.length === 0 && sections.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Noch keine Expose-Einträge verfügbar
          </p>
          <Button onClick={() => router.push("/")} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Startseite
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#e8e6e3]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="grid grid-cols-3 items-center">
            {/* Zurück-Button links */}
            <div className="flex justify-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="text-[#6b6a66] hover:text-[#2c2a26] hover:bg-[#f5f4f2]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
              </Button>
            </div>
            {/* Titel zentriert */}
            <div className="flex justify-center">
              <h1 className="text-2xl font-light tracking-tight text-[#2c2a26]">
                Exposé
              </h1>
            </div>
            {/* Platzhalter rechts für Balance */}
            <div></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-7xl">
        {sections.length === 0 && (
          <div className="mb-16 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            Noch keine Abschnitte vorhanden.
          </div>
        )}

        {sections.length > 0 &&
          sections.map((section, index) => {
            const images = sectionImagesMap.get(section.id) ?? { above: [], below: [] };
            const hasTitle = Boolean(section.title && section.title.trim().length > 0);

            return (
              <div key={section.id} className="mb-16">
                {images.above.length > 0 && (
                  <div className="mb-8">{renderImages(images.above, `${section.id}-above`)}</div>
                )}

                {hasTitle && (
                  <h2 className="text-xl font-light text-[#2c2a26] mb-4 tracking-tight">
                    {section.title}
                  </h2>
                )}

                <div>{renderSectionContent(section.content, section.id)}</div>

                {images.below.length > 0 && (
                  <div className="mt-8">{renderImages(images.below, `${section.id}-below`)}</div>
                )}
              </div>
            );
          })}

        {/* Kontaktdaten */}
        {contacts && (
          <div className="mb-16 pt-8 border-t border-[#e8e6e3]">
            <h2 className="text-xl font-light text-[#2c2a26] mb-6 tracking-tight">Kontakt</h2>
            <div className="space-y-6">
              {/* Haus-Adresse */}
              {contacts.houseAddress && (
                <div>
                  <h3 className="text-sm font-medium text-[#6b6a66] mb-2">Adresse</h3>
                  <p className="text-[#4a4844] font-light">{contacts.houseAddress}</p>
                  {contacts.housePhone && (
                    <p className="text-[#4a4844] font-light mt-1">T {contacts.housePhone}</p>
                  )}
                </div>
              )}

              {/* Kontakt 1 */}
              {(contacts.contact1Name || contacts.contact1Email) && (
                <div>
                  <h3 className="text-sm font-medium text-[#6b6a66] mb-2">{contacts.contact1Name || "Kontakt 1"}</h3>
                  <div className="space-y-1 text-[#4a4844] font-light">
                    {contacts.contact1Phone && <p>T {contacts.contact1Phone}</p>}
                    {contacts.contact1Mobile && <p>M {contacts.contact1Mobile}</p>}
                    {contacts.contact1Email && (
                      <p>
                        <a href={`mailto:${contacts.contact1Email}`} className="text-[#8b7355] hover:underline">
                          {contacts.contact1Email}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Kontakt 2 */}
              {(contacts.contact2Name || contacts.contact2Email) && (
                <div>
                  <h3 className="text-sm font-medium text-[#6b6a66] mb-2">{contacts.contact2Name || "Kontakt 2"}</h3>
                  <div className="space-y-1 text-[#4a4844] font-light">
                    {contacts.contact2Phone && <p>T {contacts.contact2Phone}</p>}
                    {contacts.contact2Mobile && <p>M {contacts.contact2Mobile}</p>}
                    {contacts.contact2Email && (
                      <p>
                        <a href={`mailto:${contacts.contact2Email}`} className="text-[#8b7355] hover:underline">
                          {contacts.contact2Email}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Galerie-Bilder am Ende */}
        {galleryImages.length > 0 && (
          <div className="mb-16 pt-8 border-t border-[#e8e6e3]">
            <h2 className="text-xl font-light text-[#2c2a26] mb-8 tracking-tight">Galerie</h2>
            {renderImages(galleryImages, "gallery")}
          </div>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent 
          className="max-w-7xl w-full h-[95vh] p-0 bg-[#faf9f7] border-none"
          hideClose
        >
          <div className="relative w-full h-full flex items-center justify-center bg-[#faf9f7]">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-[#2c2a26] bg-white/80 hover:bg-white shadow-lg border border-[#e8e6e3] rounded-full"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Navigation Buttons */}
            {exposes.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 z-50 text-[#2c2a26] bg-white/80 hover:bg-white shadow-lg border border-[#e8e6e3] h-12 w-12 rounded-full"
                  onClick={() => navigateLightbox('prev')}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 z-50 text-[#2c2a26] bg-white/80 hover:bg-white shadow-lg border border-[#e8e6e3] h-12 w-12 rounded-full"
                  onClick={() => navigateLightbox('next')}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Image */}
            {exposes[lightboxIndex] && (
              <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
                <img
                  src={exposes[lightboxIndex].imageUrl}
                  alt={exposes[lightboxIndex].title || "Expose"}
                  className="max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] md:max-w-[calc(100%-4rem)] md:max-h-[calc(100%-4rem)] object-contain"
                  style={{ width: "auto", height: "auto" }}
                />
              </div>
            )}

            {/* Image Info */}
            {exposes[lightboxIndex] && (exposes[lightboxIndex].title || exposes[lightboxIndex].imageText) && (
              <div className="absolute bottom-0 left-0 right-0 bg-[#faf9f7]/95 backdrop-blur-sm border-t border-[#e8e6e3] text-[#2c2a26] p-6">
                {exposes[lightboxIndex].title && (
                  <h3 className="text-xl font-light mb-2 text-[#2c2a26]">
                    {exposes[lightboxIndex].title}
                  </h3>
                )}
                {exposes[lightboxIndex].imageText && (
                  <p className="text-sm font-light text-[#4a4844]">
                    {exposes[lightboxIndex].imageText}
                  </p>
                )}
                {exposes.length > 1 && (
                  <p className="text-xs text-[#6b6a66] mt-3">
                    {lightboxIndex + 1} / {exposes.length}
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

