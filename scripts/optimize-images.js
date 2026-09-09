const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, '../images');
const backupDir = path.join(imagesDir, 'originals');

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

fs.readdirSync(imagesDir).forEach((file) => {
  const filePath = path.join(imagesDir, file);
  const ext = path.extname(file).toLowerCase();

  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
    const backupPath = path.join(backupDir, file);
    const tempJpegPath = path.join(imagesDir, `opt-${file}`);
    const webpPath = path.join(imagesDir, `${path.basename(file, ext)}.webp`);

    // Keep an untouched copy the first time this file is processed,
    // so re-running the script doesn't keep re-compressing an
    // already-compressed image (quality loss compounds each pass).
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
    }
    const source = sharp(backupPath).resize({ width: 1200, withoutEnlargement: true });

    source
      .clone()
      .jpeg({ quality: 80 })
      .toFile(tempJpegPath)
      .then(() => {
        fs.renameSync(tempJpegPath, filePath);
        console.log(`Optimized: ${file}`);
      })
      .catch((err) => console.error(`Error optimizing ${file}:`, err));

    source
      .clone()
      .webp({ quality: 78 })
      .toFile(webpPath)
      .then(() => console.log(`WebP created: ${path.basename(webpPath)}`))
      .catch((err) => console.error(`Error creating webp for ${file}:`, err));
  }
});