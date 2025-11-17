#!/usr/bin/env python3
"""
Generatore automatico icone PWA
Crea tutte le dimensioni necessarie da un'immagine base
"""

from PIL import Image, ImageDraw, ImageFont
import os

def crea_icona_base(testo="MO", colore_bg="#4A90E2", colore_testo="#FFFFFF"):
    """
    Crea un'icona base con le iniziali del progetto
    """
    size = 512
    img = Image.new('RGB', (size, size), colore_bg)
    draw = ImageDraw.Draw(img)
    
    # Tenta di usare un font, altrimenti usa il default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 200)
    except:
        font = ImageFont.load_default()
    
    # Calcola posizione centrata del testo
    bbox = draw.textbbox((0, 0), testo, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    position = ((size - text_width) // 2, (size - text_height) // 2 - 20)
    
    # Disegna il testo
    draw.text(position, testo, fill=colore_testo, font=font)
    
    # Aggiungi un bordo arrotondato (opzionale)
    draw.rounded_rectangle([(10, 10), (size-10, size-10)], 
                          radius=50, 
                          outline=colore_testo, 
                          width=8)
    
    return img

def genera_icone_pwa(immagine_base, output_dir="icons"):
    """
    Genera tutte le dimensioni di icone necessarie per la PWA
    """
    # Dimensioni richieste per PWA
    dimensioni = [72, 96, 128, 144, 152, 192, 384, 512]
    
    # Crea directory se non esiste
    os.makedirs(output_dir, exist_ok=True)
    
    print("🎨 Generazione icone PWA in corso...")
    
    for dim in dimensioni:
        # Ridimensiona l'immagine
        icona_ridimensionata = immagine_base.resize((dim, dim), Image.Resampling.LANCZOS)
        
        # Salva l'icona
        output_path = os.path.join(output_dir, f"icon-{dim}x{dim}.png")
        icona_ridimensionata.save(output_path, "PNG", optimize=True)
        
        print(f"  ✅ Creata: icon-{dim}x{dim}.png")
    
    print(f"\n🎉 {len(dimensioni)} icone generate con successo nella cartella '{output_dir}'!")

def genera_favicon(immagine_base, output_dir="."):
    """
    Genera il favicon.ico (16x16 e 32x32)
    """
    dimensioni_favicon = [16, 32]
    icone = []
    
    for dim in dimensioni_favicon:
        icona = immagine_base.resize((dim, dim), Image.Resampling.LANCZOS)
        icone.append(icona)
    
    # Salva come .ico multi-size
    output_path = os.path.join(output_dir, "favicon.ico")
    icone[0].save(output_path, format='ICO', sizes=[(16, 16), (32, 32)])
    
    print(f"  ✅ Creato: favicon.ico")

def main():
    """
    Funzione principale
    """
    print("=" * 50)
    print("🚀 GENERATORE ICONE PWA")
    print("   Metodologie Operative Lab")
    print("=" * 50)
    print()
    
    # Scegli modalità
    print("Scegli un'opzione:")
    print("1️⃣  Crea icone con iniziali 'MO'")
    print("2️⃣  Usa un'immagine esistente")
    print()
    
    scelta = input("Scelta (1 o 2): ").strip()
    
    if scelta == "1":
        # Crea icona base con iniziali
        print("\n📝 Personalizza l'icona:")
        testo = input("Testo da mostrare [MO]: ").strip() or "MO"
        colore_bg = input("Colore sfondo [#4A90E2]: ").strip() or "#4A90E2"
        colore_testo = input("Colore testo [#FFFFFF]: ").strip() or "#FFFFFF"
        
        print("\n🎨 Creazione icona base...")
        immagine_base = crea_icona_base(testo, colore_bg, colore_testo)
        
        # Salva anche l'icona base
        immagine_base.save("icons/icon-base-512.png", "PNG")
        print("  ✅ Salvata icona base: icon-base-512.png")
        
    elif scelta == "2":
        # Usa immagine esistente
        path_immagine = input("\n📁 Percorso immagine: ").strip()
        
        if not os.path.exists(path_immagine):
            print("❌ Errore: File non trovato!")
            return
        
        try:
            immagine_base = Image.open(path_immagine)
            
            # Converti in RGB se necessario
            if immagine_base.mode != 'RGB':
                immagine_base = immagine_base.convert('RGB')
            
            # Assicurati che sia quadrata
            larghezza, altezza = immagine_base.size
            if larghezza != altezza:
                print(f"⚠️  Immagine non quadrata ({larghezza}x{altezza})")
                print("🔄 Ritaglio al centro per renderla quadrata...")
                
                dimensione = min(larghezza, altezza)
                left = (larghezza - dimensione) // 2
                top = (altezza - dimensione) // 2
                right = left + dimensione
                bottom = top + dimensione
                
                immagine_base = immagine_base.crop((left, top, right, bottom))
                print(f"  ✅ Ritagliata a {dimensione}x{dimensione}")
            
            # Ridimensiona a 512x512 se più grande
            if immagine_base.size[0] > 512:
                immagine_base = immagine_base.resize((512, 512), Image.Resampling.LANCZOS)
                print(f"  ✅ Ridimensionata a 512x512")
                
        except Exception as e:
            print(f"❌ Errore apertura immagine: {e}")
            return
    else:
        print("❌ Scelta non valida!")
        return
    
    # Genera tutte le icone
    print()
    genera_icone_pwa(immagine_base)
    
    # Genera favicon
    print()
    genera_favicon(immagine_base)
    
    print("\n" + "=" * 50)
    print("✨ COMPLETATO!")
    print("=" * 50)
    print("\n📂 Carica la cartella 'icons' nel tuo repository GitHub")
    print("   in: /metodologieoperative/icons/")
    print()

if __name__ == "__main__":
    main()
