import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { lang: string } }
) {
  try {
    const lang = params.lang;
    
    // Validiere Sprache
    if (!["de", "en", "nl"].includes(lang)) {
      return NextResponse.json(
        { error: "Unsupported language" },
        { status: 400 }
      );
    }

    // Lese Locale-Datei
    // Im standalone mode sind die Dateien im public Ordner
    const filePath = join(process.cwd(), "public", "locales", `${lang}.json`);
    
    try {
      const fileContent = await readFile(filePath, "utf-8");
      const translations = JSON.parse(fileContent);
      
      return NextResponse.json(translations, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600", // Cache für 1 Stunde
        },
      });
    } catch (error: any) {
      console.error(`Error reading locale file for ${lang}:`, error);
      return NextResponse.json(
        { error: "Translation file not found" },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error("Error loading locale:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

