import sys
from PIL import Image
import io

def compress_image_to_webp(image_bytes, quality=75):
    """
    Función de referencia para compresión de imágenes estipulada en el plan v2.
    """
    img = Image.open(io.BytesIO(image_bytes))
    
    # Conservar el canal alfa (transparencia). Convertir solo modos incompatibles (ej. P o CMYK) a RGBA o RGB.
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "transparency" in img.info else "RGB")
        
    output_io = io.BytesIO()
    # Exportar comprimida en WebP
    img.save(output_io, format="WEBP", quality=quality, method=4)
    
    return output_io.getvalue()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python compress_image.py input.png output.webp")
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    with open(input_path, "rb") as f:
        img_bytes = f.read()
        
    webp_bytes = compress_image_to_webp(img_bytes, quality=75)
    
    with open(output_path, "wb") as f:
        f.write(webp_bytes)
        
    print(f"Imagen comprimida y guardada exitosamente en {output_path}")
