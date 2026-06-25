// Gallery images. Drop real photos into client/public/images/gallery/
// as 1.jpg, 2.jpg, ... 6.jpg (or more) and they will appear automatically.
// Update the alt text below to describe each photo for accessibility (IS 5568).
export interface GalleryItem {
  src: string;
  alt: string;
}

export const GALLERY: GalleryItem[] = [
  { src: '/images/gallery/1.jpg', alt: 'תמונה 1 מגלריית העבודות' },
  { src: '/images/gallery/2.jpg', alt: 'תמונה 2 מגלריית העבודות' },
  { src: '/images/gallery/3.jpg', alt: 'תמונה 3 מגלריית העבודות' },
  { src: '/images/gallery/4.jpg', alt: 'תמונה 4 מגלריית העבודות' },
  { src: '/images/gallery/5.jpg', alt: 'תמונה 5 מגלריית העבודות' },
  { src: '/images/gallery/6.jpg', alt: 'תמונה 6 מגלריית העבודות' },
];
