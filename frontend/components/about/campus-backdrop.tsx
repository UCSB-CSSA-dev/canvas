import Image, { type StaticImageData } from "next/image";
import campusPoint from "@/assets/campus/campus-point.jpg";
import lagoon from "@/assets/campus/lagoon.jpg";
import storkeTower from "@/assets/campus/storke-tower.jpg";
import sunset from "@/assets/campus/sunset.jpg";

/** Wikimedia Commons photos; the CC BY / BY-SA ones must stay credited in the page footer. */
export const CAMPUS_PHOTOS: { src: StaticImageData; author: string; license: string; url: string }[] = [
  {
    src: lagoon,
    author: "Coolcaesar",
    license: "CC BY-SA 4.0",
    url: "https://commons.wikimedia.org/wiki/File:UCSB_University_Center_and_Storke_Tower_(cropped).jpg",
  },
  {
    src: campusPoint,
    author: "Julianibarra",
    license: "CC0",
    url: "https://commons.wikimedia.org/wiki/File:Scene_from_UCSB_Hike.jpg",
  },
  {
    src: storkeTower,
    author: "Mys 721tx",
    license: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Storke_Tower,_northwest_view,_UCSB,_June_2021.jpg",
  },
  {
    src: sunset,
    author: "Glenn Beltz",
    license: "CC BY 2.0",
    url: "https://commons.wikimedia.org/wiki/File:View_from_the_Davidson_Library_4th_floor_deck.jpg",
  },
];

/** Slowly cross-fading campus photos behind the hero, darkened so the text stays readable. */
export function CampusBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {CAMPUS_PHOTOS.map((photo, i) => (
        <Image
          key={photo.url}
          src={photo.src}
          alt=""
          fill
          priority={i === 0}
          sizes="100vw"
          placeholder="blur"
          className={
            i === 0
              ? "campus-slide object-cover motion-reduce:animate-none motion-reduce:opacity-100"
              : "campus-slide object-cover motion-reduce:hidden"
          }
          // Starting 2s into the cycle shows the first photo immediately instead of fading in from black.
          style={{ animationDelay: `${i * 7 - 2}s` }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/70 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent)]" />
    </div>
  );
}
