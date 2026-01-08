/**
 * Barcode decoder for DataMatrix codes in prescription images
 * Uses @zxing/library for barcode detection
 */

// Note: ZXing library works best in browser environment
// For server-side, consider using a different library or API
// This is a simplified implementation
// Use dynamic import for sharp to avoid build issues
let sharp: any
async function getSharp() {
  if (!sharp) {
    sharp = (await import('sharp')).default
  }
  return sharp
}

export interface BarcodeResult {
  data: string
  format: string
}

/**
 * Preprocess image for better barcode detection
 */
async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const sharpLib = await getSharp()
    // Convert to grayscale, enhance contrast, resize if too large
    // Don't resize down too much - barcodes need resolution
    const processed = await sharpLib(imageBuffer)
      .greyscale()
      .normalize() // Enhance contrast
      .sharpen() // Sharpen edges for better barcode detection
      .resize(3000, 3000, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()
    
    return processed
  } catch (error) {
    console.error('Image preprocessing failed:', error)
    return imageBuffer // Return original if preprocessing fails
  }
}

/**
 * Try to decode DataMatrix/QR code from image using ZXing
 * 
 * Uses @zxing/library with proper server-side image processing
 */
export async function tryDecodeBarcode(imageBuffer: Buffer): Promise<BarcodeResult | null> {
  try {
    // Preprocess image for better detection
    const processedBuffer = await preprocessImage(imageBuffer)
    
    // Use @zxing/library with proper image data conversion
    try {
      const { 
        BarcodeFormat,
        DecodeHintType,
        RGBLuminanceSource,
        BinaryBitmap,
        HybridBinarizer,
        MultiFormatReader
      } = await import('@zxing/library')
      
      const sharpLib = await getSharp()
      
      // Try multiple preprocessing approaches for better detection
      const attempts = [
        // Attempt 1: Original processed buffer
        processedBuffer,
        // Attempt 2: Higher contrast
        await sharpLib(processedBuffer).greyscale().normalize({ lower: 5, upper: 95 }).toBuffer().catch(() => null),
        // Attempt 3: Inverted (for white-on-black barcodes)
        await sharpLib(processedBuffer).greyscale().negate().toBuffer().catch(() => null),
        // Attempt 4: Original image without preprocessing
        imageBuffer
      ].filter(Boolean) as Buffer[]
      
      for (let attemptIdx = 0; attemptIdx < attempts.length; attemptIdx++) {
        const attemptBuffer = attempts[attemptIdx]
        try {
          const { data, info } = await sharpLib(attemptBuffer)
            .raw()
            .ensureAlpha()
            .toBuffer({ resolveWithObject: true })
          
          // Convert to grayscale luminance data for ZXing
          // RGBLuminanceSource expects luminance values as Uint8ClampedArray or number array
          const luminanceData = new Uint8ClampedArray(info.width * info.height)
          for (let i = 0; i < data.length; i += 4) {
            // Convert RGBA to grayscale using standard formula
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
            luminanceData[i / 4] = gray
          }
          
          console.log(`Attempt ${attemptIdx + 1}: Luminance data created, size: ${luminanceData.length}, sample values: [${luminanceData[0]}, ${luminanceData[100]}, ${luminanceData[1000]}]`)
          
          // Create ZXing luminance source
          // RGBLuminanceSource constructor: (luminances, width, height, dataWidth?, dataHeight?)
          // Try both Uint8ClampedArray and regular array
          let luminanceSource: any
          try {
            luminanceSource = new RGBLuminanceSource(
              luminanceData,
              info.width,
              info.height
            )
            console.log(`Attempt ${attemptIdx + 1}: RGBLuminanceSource created successfully`)
          } catch (sourceError: any) {
            console.log(`Attempt ${attemptIdx + 1}: RGBLuminanceSource creation failed:`, sourceError.message)
            throw sourceError // Re-throw if creation fails
          }
          
          // Create binary bitmap with different binarizers
          const binarizers: Array<{ name: string; binarizer: any }> = [
            { name: 'HybridBinarizer', binarizer: new HybridBinarizer(luminanceSource) }
          ]
          
          // Try GlobalHistogramBinarizer if available
          try {
            const { GlobalHistogramBinarizer } = await import('@zxing/library')
            binarizers.push({ name: 'GlobalHistogramBinarizer', binarizer: new GlobalHistogramBinarizer(luminanceSource) })
          } catch {
            console.log(`Attempt ${attemptIdx + 1}: GlobalHistogramBinarizer not available`)
          }
          
          for (const { name: binarizerName, binarizer } of binarizers) {
            try {
              console.log(`Attempt ${attemptIdx + 1}: Trying ${binarizerName}...`)
              const binaryBitmap = new BinaryBitmap(binarizer)
              
              // Create reader with hints
              const hints = new Map()
              hints.set(DecodeHintType.POSSIBLE_FORMATS, [
                BarcodeFormat.QR_CODE,
                BarcodeFormat.DATA_MATRIX,
                BarcodeFormat.AZTEC,
                BarcodeFormat.PDF_417,
                BarcodeFormat.CODE_128,
                BarcodeFormat.CODE_39,
                BarcodeFormat.EAN_13,
                BarcodeFormat.EAN_8
              ])
              hints.set(DecodeHintType.TRY_HARDER, true)
              hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8')
              
              const reader = new MultiFormatReader()
              reader.setHints(hints)
              
              console.log(`Attempt ${attemptIdx + 1}: Decoding with ${binarizerName}...`)
              const result = reader.decode(binaryBitmap)
              if (result && result.getText()) {
                console.log(`✅ Successfully decoded barcode using ZXing (attempt ${attemptIdx + 1}, ${binarizerName}):`, result.getBarcodeFormat().toString(), '- Length:', result.getText().length)
                return {
                  data: result.getText(),
                  format: result.getBarcodeFormat().toString()
                }
              }
            } catch (decodeError: any) {
              if (decodeError.name === 'NotFoundException') {
                console.log(`Attempt ${attemptIdx + 1} (${binarizerName}): NotFoundException - no barcode found`)
                // Continue to next binarizer/attempt
                continue
              } else {
                console.log(`Attempt ${attemptIdx + 1} (${binarizerName}) decode failed:`, decodeError.name || decodeError.constructor?.name, '-', decodeError.message || String(decodeError))
              }
            }
          }
        } catch (attemptError: any) {
          console.log(`Image processing attempt ${attemptIdx + 1} failed:`, attemptError.message || attemptError)
          continue
        }
      }
      
      console.log('All ZXing decode attempts failed - no barcode found')
    } catch (zxingError: any) {
      console.log('ZXing library import or initialization failed:', zxingError.message || zxingError)
    }
    
    return null
  } catch (error) {
    console.error('Barcode decoding error:', error)
    return null
  }
}

/**
 * Parse DataMatrix content to PrescriptionData structure
 * DataMatrix format for Muster 13 follows a specific structure
 */
export function parseBarcodeData(barcodeData: string): Partial<any> {
  // Muster 13 DataMatrix format is typically structured
  // This is a simplified parser - actual format may vary
  const data: any = {
    rawSource: 'BARCODE' as const
  }
  
  try {
    // Split by common delimiters
    const parts = barcodeData.split(/[|;,\n]/)
    
    // Try to extract common fields
    // This is a placeholder - actual parsing depends on exact DataMatrix format
    parts.forEach((part) => {
      const trimmed = part.trim()
      
      // Try to identify fields by position or pattern
      if (trimmed.match(/^\d{10}$/)) {
        // Could be insurance number
        if (!data.patient) data.patient = {}
        data.patient.insuranceNo = trimmed
      } else if (trimmed.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
        // Date format
        if (!data.prescriber) data.prescriber = {}
        if (!data.prescriber.issueDate) {
          data.prescriber.issueDate = trimmed
        }
      } else if (trimmed.match(/^[A-Z]\d{2}\.\d$/)) {
        // ICD-10 code
        if (!data.diagnosis) data.diagnosis = {}
        data.diagnosis.icd10 = trimmed
      }
    })
    
    return data
  } catch (error) {
    console.error('Barcode parsing error:', error)
    return { rawSource: 'BARCODE' as const }
  }
}

